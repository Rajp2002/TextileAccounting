import { describe, expect, it } from 'vitest'
import { translateKnownFragments } from '@/lib/i18n/known-fragments'

// The full scan lib/i18n/context.tsx used before the index (main@8a1dee0f).
function fullScan(source: string, phraseMap: Map<string, string>) {
    let translated = source
    const entries = Array.from(phraseMap.entries())
        .filter(([phrase, replacement]) => phrase.length >= 8 && phrase !== replacement && source.includes(phrase))
        .sort((a, b) => b[0].length - a[0].length)
    for (const [phrase, replacement] of entries) {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
        const startsWithWord = /^[A-Za-z0-9]/.test(phrase)
        const endsWithWord = /[A-Za-z0-9]$/.test(phrase)
        const pattern = new RegExp(`${startsWithWord ? '(^|[^A-Za-z0-9])' : ''}${escaped}${endsWithWord ? '(?=$|[^A-Za-z0-9])' : ''}`, 'g')
        translated = translated.replace(pattern, (match, prefix = '') => startsWithWord ? `${prefix}${replacement}` : replacement)
    }
    return translated === source ? undefined : translated
}

const phraseMap = new Map([
    ['Save costing', 'कॉस्टिंग सेव करें'],
    ['Save costing as new quality', 'नई क्वालिटी के रूप में सेव करें'],
    ['Warp yarn', 'ताना यार्न'],
    ['Weft yarn', 'बाना यार्न'],
    ['Yarn rate', 'यार्न रेट'],
    // Same length as "Yarn rate"-sized neighbours: ties keep map order.
    ['Rate book', 'रेट बुक'],
    ['Book rate', 'बुक रेट'],
    ['Total (Rs/m)', 'कुल (रु/मी)'],
    ['GST 5% included', 'GST 5% शामिल'],
    ['Unchanged phrase', 'Unchanged phrase'],
    ['Short', 'छोटा'],
    ['Loom output per day', 'लूम उत्पादन प्रति दिन'],
    ['Loom output', 'लूम उत्पादन'],
    ['meters  per   shift', 'मीटर प्रति शिफ्ट'],
])

const texts = [
    'Save costing as new quality',
    'Save costing',
    'Please Save costing now',
    'Unsave costing', // no word boundary before "Save"... but "save" is lowercase: unmatched
    'XSave costing', // not at a word boundary
    'Warp yarn and Weft yarn',
    'Warp yarnish',
    'Yarn rate book', // overlapping candidates
    'Rate book rate', // equal-length overlap: map order decides
    'Book rate book',
    'Total (Rs/m): 42',
    'GST 5% included in Total (Rs/m)',
    'Unchanged phrase only',
    'Short text',
    'Loom output per day: 50 m',
    'Loom output',
    'Loom 12 output',
    '20 meters per shift',
    'Nothing here',
    '',
    'abc',
]

describe('indexed known-fragment translation', () => {
    it('matches the full scan exactly', () => {
        for (const text of texts) expect(translateKnownFragments(text, phraseMap), text).toBe(fullScan(text, phraseMap))
    })

    it('reuses its index for the same phrase map and builds a new one for another', () => {
        expect(translateKnownFragments('Warp yarn', phraseMap)).toBe('ताना यार्न')
        const other = new Map([['Warp yarn', 'તાણા યાર્ન']])
        expect(translateKnownFragments('Warp yarn', other)).toBe('તાણા યાર્ન')
        expect(translateKnownFragments('Warp yarn', phraseMap)).toBe('ताना यार्न')
    })
})
