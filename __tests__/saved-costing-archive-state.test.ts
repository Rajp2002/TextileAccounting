import { describe, expect, it } from 'vitest'

import { isSavedCostingArchived } from '../lib/saved-costings'

describe('Saved Costings archive state', () => {
    it('keeps active records under an archived quality out of the Active library', () => {
        expect(isSavedCostingArchived(
            { is_archived: false },
            { is_active: false },
        )).toBe(true)
    })

    it('treats either an archived snapshot or archived quality as archived', () => {
        expect(isSavedCostingArchived({ is_archived: true }, { is_active: true })).toBe(true)
        expect(isSavedCostingArchived({ is_archived: false }, { is_active: true })).toBe(false)
        expect(isSavedCostingArchived({ is_archived: false }, null)).toBe(false)
    })
})
