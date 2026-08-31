import { describe, expect, it } from 'vitest'
import { readCompleteBaseRows } from '../lib/base-complete-query'

describe('complete Base financial inputs', () => {
    it('continues past both the API row cap and short pages', async () => {
        const rows = Array.from({ length: 1201 }, (_, id) => ({ id }))
        const result = await readCompleteBaseRows(async (from) => ({ data: rows.slice(from, from + 100), error: null, count: from === 0 ? rows.length : null }))
        expect(result.data).toEqual(rows)
    })
    it('does not return partial data when a later page fails', async () => {
        const result = await readCompleteBaseRows(async (from) => from === 0 ? { data: [{ id: 1 }], count: 2, error: null } : { data: null, error: { message: 'network error' } })
        expect(result).toEqual({ data: null, error: { message: 'network error' } })
    })
    it('fails closed if the history ends before the counted total', async () => {
        const result = await readCompleteBaseRows(async (from) => ({ data: from === 0 ? [{ id: 1 }] : [], count: 2, error: null }))
        expect(result.data).toBeNull()
        expect(result.error?.message).toContain('Reload')
    })
})
