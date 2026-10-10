import { describe, expect, it } from 'vitest'
import { collectLiteCopy } from '../scripts/i18n/lite-copy-audit'
import { findUntranslatedLiteCopy, livePhraseMap } from '../scripts/i18n/lite-copy-coverage'
import { createTemplatePhraseMatcher } from '../lib/i18n/runtime'
import { isLiteCompleteSurfacePath } from '../lib/i18n/lite-surface'
import { isBasePlanSurfacePath } from '../lib/i18n/base-plan-surface'
import { LITE_SCREEN_PHRASES } from '../lib/i18n/lite-phrases'

describe('Lite Hindi and Gujarati coverage', () => {
    it('has a complete Hindi and Gujarati sentence for every string on Lite screens', () => {
        const missing = findUntranslatedLiteCopy().map(item => `${item.file}:${item.line}  ${item.text}`)
        // Add a row to lib/i18n/lite-phrases/<screen>.ts for each string listed here.
        expect(missing).toEqual([])
    }, 60_000)

    it('still finds the Lite copy it is meant to check', () => {
        const copy = collectLiteCopy().map(item => item.text)
        expect(copy.length).toBeGreaterThan(1000)
        expect(copy).toContain('Save as separate quality')
    }, 60_000)

    it('writes every phrase in the right script and keeps its placeholders', () => {
        for (const [language, script] of [['hi', /\p{Script=Devanagari}/u], ['gu', /\p{Script=Gujarati}/u]] as const) {
            for (const [english, translated] of Object.entries(LITE_SCREEN_PHRASES[language])) {
                expect(translated.trim(), english).not.toBe('')
                // Rows kept as written (plan names, brand terms) need no local script.
                if (/[a-z]{3}/.test(english) && translated !== english) expect(translated, english).toMatch(script)
                for (const token of translated.match(/\{\w+\}/g) ?? []) expect(english, `${language}: ${translated}`).toContain(token)
            }
        }
    })

    it('treats the Lite routes as complete-phrase surfaces', () => {
        for (const route of ['/owner/estimator', '/owner/quotes', '/owner/rates/history', '/owner/settings', '/owner/billing', '/onboarding', '/signup', '/plans']) {
            expect(isLiteCompleteSurfacePath(route)).toBe(true)
        }
        expect(isLiteCompleteSurfacePath('/owner/production')).toBe(false)
        expect(isBasePlanSurfacePath('/owner/production')).toBe(true)
    })
})

describe('template phrases', () => {
    const phrases = new Map([
        ['Updates future estimates for {0} saved {1}. Past costings stay the same.', 'આગળના અંદાજ {0} સાચવેલી ક્વોલિટી માટે બદલાશે. જૂની કોસ્ટિંગ એ જ રહેશે.'],
        ['Rate could not be {0}. Try again.', 'ભાવ {0} શક્યો નથી. ફરી પ્રયાસ કરો.'],
        ['archived', 'આર્કાઇવ'],
        ['v{version}', 'વર્ઝન {version}'],
    ])
    const match = createTemplatePhraseMatcher(phrases)

    it('translates a rendered sentence that carries numbers', () => {
        expect(match('Updates future estimates for 3 saved qualities. Past costings stay the same.')).toBe('આગળના અંદાજ 3 સાચવેલી ક્વોલિટી માટે બદલાશે. જૂની કોસ્ટિંગ એ જ રહેશે.')
    })

    it('translates a value that is itself a known phrase', () => {
        expect(match('Rate could not be archived. Try again.')).toBe('ભાવ આર્કાઇવ શક્યો નથી. ફરી પ્રયાસ કરો.')
    })

    it('leaves unknown text and placeholder-only templates alone', () => {
        expect(match('Something new on the screen')).toBeUndefined()
        expect(match('v12')).toBeUndefined()
    })
})

describe('provider phrase map', () => {
    it('includes the Lite rows for both languages', () => {
        expect(livePhraseMap('gu').get('Save as separate quality')).toMatch(/\p{Script=Gujarati}/u)
        expect(livePhraseMap('hi').get('Save as separate quality')).toMatch(/\p{Script=Devanagari}/u)
    })
})

describe('nested template values', () => {
    it('translates a layer label inside a validation message', () => {
        const match = createTemplatePhraseMatcher(new Map([
            ['{0} crimp %', '{0} ક્રિમ્પ %'],
            ['Weft layer {0}', 'ભરણ લેયર {0}'],
        ]))
        expect(match('Weft layer 2 crimp %')).toBe('ભરણ લેયર 2 ક્રિમ્પ %')
    })
})
