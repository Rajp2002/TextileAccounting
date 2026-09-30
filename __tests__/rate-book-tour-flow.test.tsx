import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { rateBookTutorialCopy, rateBookControlLabels, rateBookStepCopy } from '../lib/i18n/rate-book-tutorial'
import { RATE_BOOK_TOUR_STEPS } from '../lib/rate-book-tour'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
import { BASE_PLAN_PHRASES } from '../lib/i18n/base-plan-phrases'
import { legacyPhraseTranslations } from '../lib/i18n/legacy'
import { generatedLegacyPhraseTranslations } from '../lib/i18n/legacy-generated'
import { applyTranslationGuards, translateStrictBasePlanText } from '../lib/i18n/runtime'

const state = vi.hoisted(() => ({ language: 'en' as 'en' | 'hi' | 'gu' }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: state.language, tx: (text: string) => text }) }))
vi.mock('@/components/tours/TourInvitation', () => ({ TourInvitation: () => null }))
import { RateBookHelp, rateBookHelpCopy, formatRateBookHelpText } from '../components/rates/RateBookTutorial'

const rates = readFileSync('app/(dashboard)/owner/rates/RatesClient.tsx', 'utf8')
const provider = readFileSync('lib/i18n/context.tsx', 'utf8')
const phraseFunctions = provider.slice(provider.indexOf('function collectPhraseMap('), provider.indexOf('function getReversePhraseMap('))
const compiled = ts.transpileModule(phraseFunctions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const phraseResolver = new Function('en', 'BASE_PLAN_PHRASES', 'applyTranslationGuards', 'translateStrictBasePlanText', 'translationCache', 'language', 'resources', `${compiled}; const map = collectPhraseMap(language, resources); return text => translateSourceText(text, language, map, true) ?? text`)
const locales = { en, gu, hi }

describe('Rate Book approved copy and control parity', () => {
    it.each(['en', 'gu', 'hi'] as const)('matches every approved §F string, script, token and control in %s', language => {
        const copy = rateBookTutorialCopy[language]
        const index = ['en', 'gu', 'hi'].indexOf(language) + 2
        const rows = readFileSync('docs/guided-tours/pages/rate-book.md', 'utf8').split('\n').filter(line => /^\| `(purpose|find|update|review|usage|handoff|rows|guide)\./.test(line))
        expect(Object.keys(copy)).toHaveLength(rows.length)
        for (const row of rows) {
            const parts = row.split('|').map(value => value.trim())
            const text = copy[parts[1].replaceAll('`', '') as keyof typeof copy]
            expect(text).toBe(parts[index])
            if (language !== 'en') {
                expect(text).toMatch(language === 'gu' ? /[\u0A80-\u0AFF]/ : /[\u0900-\u097F]/)
                expect(text.replace(/\{c:[^}]+\}|Weavly/g, '')).not.toMatch(/[A-Za-z]/)
            }
        }
        const resources = { translation: locales[language], legacy: language === 'en' ? {} : legacyPhraseTranslations[language], generatedLegacy: language === 'en' ? {} : generatedLegacyPhraseTranslations[language] }
        const tx = phraseResolver(en, BASE_PLAN_PHRASES, applyTranslationGuards, translateStrictBasePlanText, new WeakMap(), language, resources)
        const controls = rateBookControlLabels(key => {
            expect(key).toBe('tourControls.rateBook.addRate')
            return locales[language].tourControls.rateBook.addRate
        }, tx)
        const approved = { en: ['Add Yarn Rate', 'Needs Review', 'Edit rate', 'Advanced edit'], gu: ['યાર્ન ભાવ ઉમેરો', 'સમીક્ષા બાકી', 'ભાવ બદલો', 'વિગતવાર ફેરફાર'], hi: ['धागा रेट जोड़ें', 'समीक्षा बाकी', 'रेट बदलें', 'विस्तृत बदलाव'] }
        expect(Object.values(controls)).toEqual(approved[language])
        for (const populated of [false, true]) for (const step of RATE_BOOK_TOUR_STEPS) {
            const text = rateBookStepCopy(language, step, populated, controls)
            expect(text.title).toBeTruthy()
            expect(text.body).toBeTruthy()
            expect(JSON.stringify(text)).not.toMatch(/\{c:/)
            if (language === 'en') {
                expect(text.title.length).toBeLessThanOrEqual(48)
                expect(text.body.length).toBeLessThanOrEqual(190)
                expect(text.detail?.length ?? 0).toBeLessThanOrEqual(260)
            }
            expect(text.unavailable).toBe(['rb-update', 'rb-review', 'rb-usage'].includes(step) ? copy['rows.unavailable'] : undefined)
        }
        expect(rateBookStepCopy(language, 'rb-purpose', false, controls).body).toContain(`“${controls.addRate}”`)
        expect(rateBookStepCopy(language, 'rb-find', false, controls).body).toContain(`“${controls.needsReview}”`)
        expect(rateBookStepCopy(language, 'rb-update', false, controls).detail).toContain(`“${controls.advancedEdit}”`)
    })
    it('uses the same approved resolvers at live controls and preserves the bulk-confirm caveat', () => {
        expect(rates.match(/t\('tourControls.rateBook.addRate'\)/g)).toHaveLength(2)
        for (const label of ['Needs Review', 'Edit rate', 'Advanced edit']) expect(rates).toContain(`tx('${label}')`)
        expect(rateBookTutorialCopy.en['review.detail']).toContain('including ones hidden by your search or filters')
        expect(rateBookTutorialCopy.en['usage.body']).toContain('costings already saved keep their numbers')
        expect(rateBookTutorialCopy.en['update.body']).not.toContain('₹200')
    })
    it.each(['en', 'gu', 'hi'] as const)('keeps the six existing help topics and principles in %s', language => {
        state.language = language
        const copy = rateBookHelpCopy[language]
        expect(Object.keys(copy.fields)).toEqual(['directionFilter', 'quickReviewAction', 'rateAndTrend', 'rateDrawerFields', 'reviewRailWidget', 'activityAndArchive'])
        const html = renderToStaticMarkup(<RateBookHelp />)
        expect(html).toContain(`lang="${language}"`)
        expect(html).toContain(copy.helpTitle)
        expect(html.match(/<details\b/g)).toHaveLength(7)
        expect(html).not.toContain('<details open')
        for (const field of Object.values(copy.fields)) {
            expect(html).toContain(formatRateBookHelpText(field.title, text => text))
            expect(formatRateBookHelpText(field.description, text => text)).not.toMatch(/\{\w+\}/)
        }
        expect(copy.principles).toHaveLength(3)
        expect(rates).toContain('<RateBookHelp />')
        expect(rates).toContain('copy.principles.map')
    })
})
