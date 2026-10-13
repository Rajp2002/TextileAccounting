'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createOrgExportReader, type ExportQueryResult, type ExportRecord } from '@/lib/org-export-reads'
import { requireRetainedArchiveOwner } from '@/lib/retained-archive-owner'
import { isAccountantCsvArea, type AccountantCsvArea } from '@/lib/accountant-csv-areas'
import {
    buildChallanPaymentsCsv,
    buildChallansCsv,
    buildCostingsCsv,
    buildDailyProductionCsv,
    buildQualitiesCsv,
    buildRateBookCsv,
} from '@/lib/accountant-csv'
import { formatToSurat } from '@/lib/time'

const CSV_FAILURE = 'This spreadsheet could not be prepared. Nothing was downloaded; please try again.'

const FILENAME_STEMS: Record<AccountantCsvArea, string> = {
    costings: 'costings',
    qualities: 'qualities',
    rate_book: 'rate-book',
    challans: 'challans',
    challan_payments: 'challan-payments',
    daily_production: 'daily-production',
}

class CsvReadError extends Error {
    constructor(readonly table: string, readonly code: string | undefined) {
        super(CSV_FAILURE)
    }
}

/**
 * One spreadsheet for the owner's munim or accountant. Same access as the
 * JSON archive (retained after paid access ends, not for a pure Free account),
 * same complete tenant-scoped reads, and the same EXPORT audit entry. Any
 * failed read fails the download rather than handing over a partial file.
 */
export async function exportAccountantCsv(area: AccountantCsvArea) {
    const { user, profile } = await requireRetainedArchiveOwner()
    if (!isAccountantCsvArea(area)) throw new Error(CSV_FAILURE)
    const orgId = profile.org_id
    const supabase = createAdminClient()
    const { scoped } = createOrgExportReader(supabase, orgId)

    const read = async (table: string): Promise<ExportRecord[]> => {
        const result: ExportQueryResult = await scoped(table)()
        if (result.error) throw new CsvReadError(table, result.error.code)
        return result.data ?? []
    }

    let csv: string
    try {
        csv = await buildAreaCsv(area, read)
    } catch (error) {
        console.error('Accountant CSV export failed', {
            area,
            table: error instanceof CsvReadError ? error.table : undefined,
            code: error instanceof CsvReadError ? error.code : undefined,
        })
        throw new Error(CSV_FAILURE)
    }

    const exportedAt = new Date()
    const filename = `weavly-${FILENAME_STEMS[area]}-${formatToSurat(exportedAt, 'yyyyMMdd-HHmm')}.csv`
    const { error: auditError } = await supabase.rpc('log_export_event', {
        p_org_id: orgId,
        p_table_name: 'owner_csv_export',
        p_record_id: area,
        p_description: `Owner CSV export generated at ${exportedAt.toISOString()}; filename ${filename}`,
        p_actor_id: user.id,
    })
    if (auditError) {
        console.error('Failed to audit accountant CSV export:', auditError.message)
        throw new Error(CSV_FAILURE)
    }

    return { filename, csv }
}

async function buildAreaCsv(area: AccountantCsvArea, read: (table: string) => Promise<ExportRecord[]>) {
    switch (area) {
        case 'costings': {
            const [quotes, freeCostings] = await Promise.all([read('estimator_quotes'), read('free_saved_costings')])
            return buildCostingsCsv({ quotes, freeCostings })
        }
        case 'qualities':
            return buildQualitiesCsv(await read('estimator_templates'))
        case 'rate_book': {
            const [rates, history] = await Promise.all([read('cost_rate_book'), read('cost_rate_history')])
            return buildRateBookCsv({ rates, history })
        }
        case 'challans':
            return buildChallansCsv(await read('delivery_challans'))
        case 'challan_payments': {
            const [challans, events] = await Promise.all([read('delivery_challans'), read('delivery_challan_events')])
            return buildChallanPaymentsCsv({ challans, events })
        }
        case 'daily_production': {
            const [batches, entries, allocations, workers, legacyEntries, jobs] = await Promise.all([
                read('base_production_batches'),
                read('base_daily_production_entries'),
                read('base_daily_production_allocations'),
                read('base_production_workers'),
                read('base_production_entries'),
                read('base_production_jobs'),
            ])
            return buildDailyProductionCsv({ batches, entries, allocations, workers, legacyEntries, jobs })
        }
    }
}
