import { describe, expect, it } from 'vitest'
import { warpConstructionText, weftConstructionText } from '@/lib/estimator-construction'

describe('warpConstructionText', () => {
    it('joins the warp component names with " + "', () => {
        expect(warpConstructionText([{ label: 'Rainbow' }, { label: 'Jari' }])).toBe('Rainbow + Jari')
    })

    it('trims names and skips components that have no name yet', () => {
        expect(warpConstructionText([{ label: '  Rainbow ' }, { label: '' }, { label: undefined }, { label: 'Jari' }])).toBe('Rainbow + Jari')
    })

    it('is empty when no component is named', () => {
        expect(warpConstructionText([{ label: '' }])).toBe('')
        expect(warpConstructionText([])).toBe('')
    })
})

describe('weftConstructionText', () => {
    it('joins the weft component names and appends the total picks', () => {
        expect(weftConstructionText([
            { label: 'Rainbow', picks: 34 },
            { label: 'Jari', picks: 34 },
        ])).toBe('Rainbow + Jari - 68 Picks')
    })

    it('keeps the names alone while picks are not entered', () => {
        expect(weftConstructionText([{ label: 'Rainbow', picks: 0 }, { label: 'Jari' }])).toBe('Rainbow + Jari')
    })

    it('shows only the picks while no component is named', () => {
        expect(weftConstructionText([{ label: '', picks: 68 }])).toBe('68 Picks')
    })

    it('is empty when there is nothing to describe', () => {
        expect(weftConstructionText([{ label: '', picks: 0 }])).toBe('')
        expect(weftConstructionText([])).toBe('')
    })
})
