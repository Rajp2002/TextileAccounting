import { describe, expect, it } from 'vitest'
import { costEstimateTutorialCopy, isTutorialField } from '../lib/i18n/cost-estimate-tutorial'

describe('Cost Estimate tutorial translations', () => {
    const english = costEstimateTutorialCopy.en
    for (const language of ['en', 'hi', 'gu'] as const) {
        it(`provides every tutorial field and control in ${language}`, () => {
            const copy = costEstimateTutorialCopy[language]
            expect(Object.keys(copy).sort()).toEqual(Object.keys(english).sort())
            expect(Object.keys(copy.fields).sort()).toEqual(Object.keys(english.fields).sort())
            expect(copy.sections).toHaveLength(7)
            expect(copy.sectionProgress).toContain('{current}')
            expect(copy.sectionProgress).toContain('{total}')
            const strings = [
                ...copy.sections,
                ...Object.values(copy).filter((value): value is string => typeof value === 'string'),
                ...Object.values(copy.fields).flatMap(field => [field.title, field.description]),
            ]
            for (const text of strings) {
                expect(text.trim().length).toBeGreaterThan(0)
                if (language === 'hi') expect(text).toMatch(/\p{Script=Devanagari}/u)
                if (language === 'gu') expect(text).toMatch(/\p{Script=Gujarati}/u)
            }
        })
    }

    it('preserves critical units and quantities across translations', () => {
        for (const copy of Object.values(costEstimateTutorialCopy)) {
            expect(copy.fields.calcDenier.description).toContain('9,000')
            expect(copy.fields.manualKgPer100m.description).toContain('100')
            expect(copy.fields.shortagePct.description).toContain('0')
            expect(copy.fields.directOverheadMethod.description).toContain('₹/m')
            expect(copy.fields.warpingMode.description).toContain('₹/kg')
            expect(copy.fields.sizingMode.description).toContain('₹/kg')
        }
    })

    it('recognises stable field IDs regardless of the displayed language', () => {
        expect(isTutorialField('warpComponentCount')).toBe(true)
        expect(isTutorialField('monthlyOverheadMethod')).toBe(true)
        expect(isTutorialField('toString')).toBe(false)
        expect(isTutorialField('unknownField')).toBe(false)
    })
})
