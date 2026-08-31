type PageResult<T> = { data: T[] | null; error: { message?: string } | null; count?: number | null }

/** Do not calculate payroll from a silently capped PostgREST result. */
export async function readCompleteBaseRows<T>(
    readPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<PageResult<T>> {
    const rows: T[] = []
    let expected: number | null = null
    for (let page = 0; page < 1000; page += 1) {
        const result = await readPage(rows.length, rows.length + 499)
        if (result.error) return { data: null, error: result.error }
        if (page === 0) expected = result.count ?? null
        const chunk = result.data ?? []
        rows.push(...chunk)
        if (expected !== null && rows.length >= expected) return { data: rows, error: null }
        if (chunk.length === 0) {
            return expected === null
                ? { data: rows, error: null }
                : { data: null, error: { message: 'Production history changed while loading. Reload before continuing.' } }
        }
        // Continue even with a short page: the API's cap can be below 500.
    }
    return { data: null, error: { message: 'Production history could not be loaded completely. No partial totals were used.' } }
}
