import 'server-only'

import type { createAdminClient } from '@/lib/supabase/admin'
import { readAllPages } from '@/lib/paged-read'

export const EXPORT_PAGE_SIZE = 1000
export const EXPORT_LOOKUP_BATCH = 200

export type ExportRecord = Record<string, unknown>
export type ExportQueryResult = { data: ExportRecord[] | null; error: { message: string; code?: string } | null }

/** The PostgREST filter methods the paged export reads use, for any table. */
type ExportTableQuery = PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }> & {
    eq(column: string, value: unknown): ExportTableQuery
    in(column: string, values: readonly unknown[]): ExportTableQuery
    or(filters: string): ExportTableQuery
    gt(column: string, value: unknown): ExportTableQuery
    order(column: string, options: { ascending: boolean }): ExportTableQuery
    limit(count: number): ExportTableQuery
    range(from: number, to: number): ExportTableQuery
}

/**
 * Complete, tenant-scoped reads for the owner's archive and CSV downloads.
 * The service-role client bypasses RLS, so every read filters on the
 * organization (or on ids already read for it). LT07: each read pages by a
 * unique key until an empty page, so a table larger than the server's row cap
 * is never cut short, and any failed page fails the read.
 */
export function createOrgExportReader(supabase: ReturnType<typeof createAdminClient>, orgId: string) {
    // Table names are catalog strings here, so the typed client cannot help;
    // ExportTableQuery names the few filter methods these reads use.
    const tableQuery = (table: string) => supabase.from(table).select('*') as unknown as ExportTableQuery

    const readByKey = (
        table: string,
        scope: (query: ExportTableQuery) => ExportTableQuery,
        keyColumn = 'id',
    ): Promise<ExportQueryResult> => readAllPages<ExportRecord>(after => {
        let query = scope(tableQuery(table))
        if (after) query = query.gt(keyColumn, after[keyColumn] as string)
        return query
            .order(keyColumn, { ascending: true })
            .limit(EXPORT_PAGE_SIZE)
            .then(({ data, error }) => ({ data: data as ExportRecord[] | null, error }))
    })

    const scoped = (table: string, column = 'org_id', keyColumn = 'id') => () =>
        readByKey(table, query => query.eq(column, orgId), keyColumn)

    // Tables with only a composite key are read in ordered offset pages.
    const readOrderedPages = async (table: string, orderColumns: string[], column = 'org_id'): Promise<ExportQueryResult> => {
        const rows: ExportRecord[] = []
        for (;;) {
            let query = tableQuery(table).eq(column, orgId)
            for (const orderColumn of orderColumns) query = query.order(orderColumn, { ascending: true })
            const { data, error } = await query.range(rows.length, rows.length + EXPORT_PAGE_SIZE - 1)
            if (error) return { data: null, error }
            const page = (data ?? []) as ExportRecord[]
            if (page.length === 0) return { data: rows, error: null }
            rows.push(...page)
        }
    }

    // Lookups by a parent's ids are batched so a long id list never makes
    // one oversized request.
    const readByParentIds = async (table: string, column: string, ids: string[]): Promise<ExportQueryResult> => {
        const rows: ExportRecord[] = []
        for (let start = 0; start < ids.length; start += EXPORT_LOOKUP_BATCH) {
            const batch = ids.slice(start, start + EXPORT_LOOKUP_BATCH)
            const result = await readByKey(table, query => query.in(column, batch))
            if (result.error) return result
            rows.push(...(result.data ?? []))
        }
        return { data: rows, error: null }
    }

    return { readByKey, scoped, readOrderedPages, readByParentIds }
}

export function exportRecordIds(rows: ExportRecord[] | null | undefined) {
    return (rows ?? [])
        .map(row => row.id)
        .filter((id): id is string => typeof id === 'string')
}
