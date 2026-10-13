import { describe, expect, it } from 'vitest'

import { isSavedCostingArchived, savedQualityIdsWithOnlyArchivedCostings } from '../lib/saved-costings'

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

    it('finds the qualities whose every costing is archived, so the default view can leave them out', () => {
        const costings = [
            { template_id: 'silk', is_archived: true },
            { template_id: 'silk', is_archived: true },
            { template_id: 'poplin', is_archived: true },
            { template_id: 'poplin', is_archived: false },
            { template_id: null, is_archived: true },
            { template_id: 'linen', is_archived: false },
        ]
        expect([...savedQualityIdsWithOnlyArchivedCostings(costings)]).toEqual(['silk'])
        expect(savedQualityIdsWithOnlyArchivedCostings([]).size).toBe(0)
    })
})
