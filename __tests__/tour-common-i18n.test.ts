import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { tourCommonCopy } from '../lib/i18n/tour-common'
import { formatTourText } from '../lib/tours/tour-text'
it('matches every approved shared string in plan §9.3 exactly', () => {
    const section = readFileSync('docs/GUIDED_TOURS_REFINEMENT_PLAN.md', 'utf8').split('### 9.3 Shared tour copy (EC-11)')[1].split('### 9.4')[0]
    const rows = section.split('\n').filter(line => line.startsWith('| `')).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
    for (const [column, lang] of (['en', 'gu', 'hi'] as const).entries()) {
        expect(Object.keys(tourCommonCopy[lang]).sort()).toEqual(rows.map(row => row[0].replaceAll('`', '')).sort())
        for (const row of rows) expect(tourCommonCopy[lang][row[0].replaceAll('`', '') as keyof typeof tourCommonCopy.en]).toBe(row[column + 1])
    }
})
it.each(['gu', 'hi'] as const)('uses native script without unapproved English words in %s', lang => {
    for (const value of Object.values(tourCommonCopy[lang])) {
        const text = value.replace(/\{[^}]+\}/g, '').replace(/\b(?:m|kg|PDF|CSV|UPI|GST|Weavly)\b/g, '')
        expect(text).toMatch(lang === 'gu' ? /[\u0A80-\u0AFF]/ : /[\u0900-\u097F]/)
        expect(text).not.toMatch(/[A-Za-z]/)
        expect(() => formatTourText(value, {}, { n: 1, total: 6, title: '', name: '' })).not.toThrow()
    }
})
