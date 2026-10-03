import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { costEstimateTutorialCopy, estimatorControlLabels, estimatorStepCopy } from '../lib/i18n/cost-estimate-tutorial'
import { estimatorTourSteps } from '../lib/estimator-tour'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
import { BASE_PLAN_PHRASES, isBasePlanSurfacePath } from '../lib/i18n/base-plan-phrases'
import { legacyPhraseTranslations } from '../lib/i18n/legacy'
import { generatedLegacyPhraseTranslations } from '../lib/i18n/legacy-generated'
import { applyTranslationGuards, translateStrictBasePlanText } from '../lib/i18n/runtime'

const locales = { en, gu, hi }
const spec = readFileSync('docs/guided-tours/pages/cost-estimator.md', 'utf8')
const rows = spec.split('### F.1')[1].split('### F.2')[0].split('\n').filter(row => row.startsWith('| `')).map(row => row.split('|').slice(1, -1).map(cell => cell.trim()))
const tokenRows = spec.split('### F.2')[1].split('### F.3')[0].split('\n').filter(row => row.startsWith('| `')).map(row => row.split('|').slice(1, -1).map(cell => cell.trim()))
const provider = readFileSync('lib/i18n/context.tsx', 'utf8')
const resolverSource = provider.slice(provider.indexOf('function collectPhraseMap('), provider.indexOf('function getReversePhraseMap('))
const compiled = ts.transpileModule(resolverSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
// Exercise the real provider precedence/guards without a browser or changing its exports.
const resolvers = new Function('en', 'BASE_PLAN_PHRASES', 'applyTranslationGuards', 'translateStrictBasePlanText', 'translationCache', `${compiled}; return { collectPhraseMap, translateSourceText }`)(en, BASE_PLAN_PHRASES, applyTranslationGuards, translateStrictBasePlanText, new WeakMap())

describe('Estimator approved copy and live-label parity', () => {
    it.each(['en', 'gu', 'hi'] as const)('transcribes every F.1 string exactly in %s with native script and matching keys', language => {
        const copy = costEstimateTutorialCopy[language]
        expect(Object.keys(copy)).toEqual(Object.keys(costEstimateTutorialCopy.en))
        for (const row of rows) {
            const text = copy[row[0].replaceAll('`', '') as keyof typeof copy]
            expect(text).toBe(row[['en', 'gu', 'hi'].indexOf(language) + 1])
            expect(text.trim()).not.toBe('')
            if (language !== 'en') expect(text).toMatch(language === 'gu' ? /\p{Script=Gujarati}/u : /\p{Script=Devanagari}/u)
        }
    })
    it.each(['en', 'gu', 'hi'] as const)('resolves actual controls and every plan/version variant in %s', language => {
        const dictionary = locales[language]
        const t = (key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dictionary) as string
        const map = resolvers.collectPhraseMap(language, language === 'en' ? undefined : { translation: dictionary, legacy: legacyPhraseTranslations[language], generatedLegacy: generatedLegacyPhraseTranslations[language] })
        for (const route of ['/owner/estimator', '/free']) {
            const strict = isBasePlanSurfacePath(route)
            expect(strict).toBe(true)
            const tx = (text: string) => resolvers.translateSourceText(text, language, map, strict) ?? text
            const fresh = estimatorControlLabels(t, tx, false)
            if (language !== 'en') for (const row of tokenRows) expect(fresh[row[0].replaceAll('`', '') as keyof typeof fresh]).toBe(row[language === 'gu' ? 3 : 4])
            const existing = estimatorControlLabels(t, tx, true)
            expect(existing.saveCosting).toBe(dictionary.tourControls.estimator.saveNewVersion)
            expect(spec).toContain(existing.saveCosting)
            for (const controls of [fresh, existing]) for (const freePlan of [true, false]) for (const productionPipeline of [true, false]) for (const step of estimatorTourSteps) {
                const copy = estimatorStepCopy(language, step.id, { freePlan, productionPipeline, controls })
                expect([copy.title, copy.body, copy.detail].join(' ')).not.toMatch(/\{[^}]+\}/)
                if (language === 'en') {
                    expect(copy.title.length).toBeLessThanOrEqual(48)
                    expect(copy.body.length).toBeLessThanOrEqual(190)
                }
            }
        }
    })
    it('pins the owner-supplied navi wording and shared save-quality key', () => {
        expect(gu.tourControls.estimator.saveNewVersion).toBe('નવી વર્ઝન સાચવો')
        expect(hi.tourControls.estimator.saveNewVersion).toBe('नया वर्ज़न सेव करें')
        const page = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
        for (const key of ['tourControls.estimator.saveCosting', 'tourControls.estimator.saveNewVersion', 'estimator.quality.saveQualityAndCosting']) expect(page).toContain(`t('${key}')`)
        expect(page).toContain("freeMeter.completed ? 'recalculateSave' : 'calculateSave'")
        for (const label of ['Live cost', 'Change quality', 'Start Production', 'Detailed']) expect(page).toContain(`tx('${label}')`)
    })
})
