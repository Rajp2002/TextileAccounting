import { createHash } from 'node:crypto'
import { z } from 'zod'
import { type FactoryFilters, type FactoryRow, matchesFactory } from './metrics'

const cursorSchema = z.object({ asOf: z.iso.datetime(), id: z.uuid(), value: z.string().max(240), filter: z.string().length(64) }).strict()
function filterKey(filters: FactoryFilters) {
    // Page size may change; all filters and ordering must remain identical.
    const query: Partial<FactoryFilters> = { ...filters }
    delete query.cursor
    delete query.limit
    return createHash('sha256').update(JSON.stringify(query)).digest('hex')
}
export function decodeFactoryCursor(filters: FactoryFilters) {
    if (!filters.cursor) return null
    try {
        const cursor = cursorSchema.parse(JSON.parse(Buffer.from(filters.cursor, 'base64url').toString('utf8')))
        if (cursor.filter !== filterKey(filters) || Date.parse(cursor.asOf) > Date.now() + 1000 || Date.parse(cursor.asOf) < Date.now() - 86_400_000) throw new Error('cursor')
        return cursor
    } catch { throw new Error('INVALID_FACTORY_CURSOR') }
}
function sortValue(row: FactoryRow, sort: FactoryFilters['sort']) {
    return sort === 'name_asc' ? row.name.toLowerCase() : row.joinedAt
}
function compare(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0 }
export function paginateFactories(rows: FactoryRow[], filters: FactoryFilters, asOf: string) {
    const cursor = decodeFactoryCursor(filters)
    const direction = filters.sort === 'name_asc' ? 1 : -1
    const sorted = rows.filter(row => matchesFactory(row, filters, asOf)).sort((a, b) =>
        direction * compare(sortValue(a, filters.sort), sortValue(b, filters.sort)) || compare(a.id, b.id))
    const after = cursor ? sorted.filter(row => {
        const delta = direction * compare(sortValue(row, filters.sort), cursor.value)
        return delta > 0 || (delta === 0 && compare(row.id, cursor.id) > 0)
    }) : sorted
    const items = after.slice(0, filters.limit)
    const last = items.at(-1)
    const nextCursor = after.length > filters.limit && last ? Buffer.from(JSON.stringify({
        asOf, id: last.id, value: sortValue(last, filters.sort), filter: filterKey(filters),
    })).toString('base64url') : null
    return { items, nextCursor, totalMatching: sorted.length }
}
