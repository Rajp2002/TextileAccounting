import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, freshDatabase, type Db } from './helpers'

// The owner's JSON archive and accountant CSVs read with the service-role
// client. A table or column it names that service_role cannot read fails the
// whole download for every owner, so each read in the two action files is
// replayed here, as service_role, against the migrated schema. Five tables
// needed 20261013120000_owner_archive_service_role_reads.sql for this.

const archive = readFileSync('app/(dashboard)/owner/settings/data-export.ts', 'utf8')
const csv = readFileSync('app/(dashboard)/owner/data-export/csv-actions.ts', 'utf8')

type Read = { table: string; columns: string[] }

function namedReads(): Read[] {
    const reads: Read[] = []
    const quoted = (list: string) => [...list.matchAll(/'(\w+)'/g)].map(match => match[1])
    for (const [, table, scope, key] of archive.matchAll(/scoped\('(\w+)'(?:, '(\w+)')?(?:, '(\w+)')?\)/g)) {
        reads.push({ table, columns: [scope ?? 'org_id', key ?? 'id'] })
    }
    for (const [, table, order] of archive.matchAll(/readOrderedPages\('(\w+)', \[([^\]]*)\]\)/g)) {
        reads.push({ table, columns: ['org_id', ...quoted(order)] })
    }
    for (const [, table, parent] of archive.matchAll(/readByParentIds\('(\w+)', '(\w+)'/g)) reads.push({ table, columns: [parent, 'id'] })
    for (const [, table] of archive.matchAll(/readByKey\('(\w+)'/g)) reads.push({ table, columns: ['org_id', 'id'] })
    for (const [, table] of csv.matchAll(/read\('(\w+)'\)/g)) reads.push({ table, columns: ['org_id', 'id'] })
    return reads
}

let db: Db

beforeAll(async () => { db = await freshDatabase() })
afterAll(async () => { await db?.end() })

describe('owner archive reads', () => {
    it('names only tables and columns the service role can read', async () => {
        const reads = namedReads()
        expect(reads.length).toBeGreaterThan(120)
        for (const table of ['base_worker_incentives', 'factory_supervisors', 'base_payroll_advance_recoveries', 'delivery_challan_events']) {
            expect(reads.map(read => read.table)).toContain(table)
        }
        await asServiceRole(db)
        const failures: string[] = []
        for (const { table, columns } of reads) {
            const list = [...new Set(columns)].map(column => `"${column}"`).join(', ')
            try {
                await db.query(`SELECT ${list} FROM public."${table}" LIMIT 0`)
            } catch (error) {
                failures.push(`${table} (${columns.join(', ')}): ${(error as { message?: string }).message}`)
            }
        }
        expect(failures).toEqual([])
    })
})
