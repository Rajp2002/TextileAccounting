'use client'

import { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast, userFacingError } from '@/lib/app-notifications'
import { downloadBlob } from '@/lib/browser-download'
import { useTranslation } from '@/lib/i18n/context'
import type { AccountantCsvArea } from '@/lib/accountant-csv-areas'
import { exportAccountantCsv } from './csv-actions'

type CsvItem = { area: AccountantCsvArea; title: string; description: string }

const GROUPS: { title: string; items: CsvItem[] }[] = [
    {
        title: 'Costing',
        items: [
            { area: 'costings', title: 'Saved costings', description: 'Every saved costing version with its cost per metre, selling price and margin. Includes Free costings kept after an upgrade.' },
            { area: 'qualities', title: 'Qualities', description: 'Each saved quality with its warp and weft yarns, rates and GST.' },
            { area: 'rate_book', title: 'Rate Book with history', description: 'Every rate and each recorded change, with dates and sources.' },
        ],
    },
    {
        title: 'Base production and dispatch',
        items: [
            { area: 'challans', title: 'Delivery challans', description: 'Every challan with party, metres, rate, paid amount and balance.' },
            { area: 'challan_payments', title: 'Challan payments', description: 'Payments, refunds, adjustments and reversals, one row each.' },
            { area: 'daily_production', title: 'Daily production', description: 'Metres by date, shift, worker, machine and quality.' },
        ],
    },
]

export function AccountantCsvExports() {
    const { tx } = useTranslation()
    const [pendingArea, setPendingArea] = useState<AccountantCsvArea | null>(null)

    const download = async (item: CsvItem) => {
        setPendingArea(item.area)
        try {
            const { filename, csv } = await exportAccountantCsv(item.area)
            downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
            toast.success(tx('Spreadsheet downloaded'), { description: tx(`Download requested: ${filename}`) })
        } catch (error) {
            toast.error(tx(userFacingError(error, 'This spreadsheet could not be prepared. Nothing was downloaded; please try again.')))
        } finally {
            setPendingArea(null)
        }
    }

    return (
        <section aria-labelledby="accountant-csv-heading" className="mt-8 border-t border-hairline pt-6" data-testid="owner-accountant-csv">
            <h2 id="accountant-csv-heading" className="text-base font-semibold text-ink">{tx('Spreadsheets for your accountant')}</h2>
            <p className="mt-1 text-sm leading-6 text-body">
                {tx('CSV files that open in Excel or Google Sheets. Each file is one table, with dates in India time.')}
            </p>
            {GROUPS.map(group => (
                <div key={group.title} className="mt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">{tx(group.title)}</h3>
                    <ul className="mt-2 divide-y divide-hairline border-y border-hairline">
                        {group.items.map(item => (
                            <li key={item.area} className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-ink">{tx(item.title)}</p>
                                    <p className="mt-1 text-sm leading-5 text-body">{tx(item.description)}</p>
                                </div>
                                <Button
                                    variant="outline"
                                    data-testid={`owner-csv-${item.area}`}
                                    onClick={() => download(item)}
                                    disabled={pendingArea !== null}
                                    className="min-h-[44px] w-full shrink-0 sm:min-h-10 sm:w-auto"
                                >
                                    {pendingArea === item.area ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="size-4" aria-hidden="true" />}
                                    {pendingArea === item.area ? tx('Preparing') : tx('Download CSV')}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
            <p className="mt-4 text-xs leading-5 text-subtle">
                {tx('Payroll CSVs stay on the Payroll page while Base is active. All of these records are also in the complete export above.')}
            </p>
        </section>
    )
}
