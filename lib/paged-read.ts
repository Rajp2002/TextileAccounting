export type PagedReadError = { message: string; code?: string }
export type PageResult<T> = { data: T[] | null; error: PagedReadError | null }

const DEFAULT_MAX_PAGES = 10_000

/**
 * Reads a whole result set by keyset pages. `fetchPage(after)` returns the
 * rows that sort after `after` (null for the first page) in a deterministic
 * order on a unique key. Reading stops at the first empty page rather than at
 * a short one, so a server row cap smaller than the requested page size can
 * never end the read early. Rows added ahead of the cursor while reading are
 * not repeated, and none behind it are skipped. Any page error fails the read.
 */
export async function readAllPages<T>(
    fetchPage: (after: T | null) => PromiseLike<PageResult<T>>,
    options: { maxPages?: number } = {},
): Promise<{ data: T[]; error: null } | { data: null; error: PagedReadError }> {
    const rows: T[] = []
    let after: T | null = null
    for (let page = 0; page < (options.maxPages ?? DEFAULT_MAX_PAGES); page += 1) {
        const { data, error } = await fetchPage(after)
        if (error) return { data: null, error }
        const pageRows = data ?? []
        if (pageRows.length === 0) return { data: rows, error: null }
        const last = pageRows[pageRows.length - 1]
        if (after !== null && JSON.stringify(last) === JSON.stringify(after)) {
            return { data: null, error: { message: 'The paged read did not advance; no complete result was produced.' } }
        }
        rows.push(...pageRows)
        after = last
    }
    return { data: null, error: { message: 'The paged read exceeded its page limit; no complete result was produced.' } }
}

function quotedFilterValue(value: unknown) {
    return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

/** PostgREST `or` filter for rows after `after` in (created_at desc, id desc) order. */
export function createdAtDescendingAfter(after: { created_at: unknown; id: unknown }) {
    const createdAt = quotedFilterValue(after.created_at)
    return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${quotedFilterValue(after.id)})`
}
