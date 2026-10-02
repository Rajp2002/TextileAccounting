/**
 * Ids in `ids` that have never been seen before, in list order and without
 * duplicates. "Seen" covers every id since the list mounted, so a row that a
 * filter hid and later shows again is not mistaken for a new one.
 */
export function detectArrivals(seen: ReadonlySet<string>, ids: readonly string[]): string[] {
    const fresh: string[] = []
    for (const id of ids) {
        if (!seen.has(id) && !fresh.includes(id)) fresh.push(id)
    }
    return fresh
}
