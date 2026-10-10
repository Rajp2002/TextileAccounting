import { en } from '../../lib/i18n/locales/en'
import { hi } from '../../lib/i18n/locales/hi'
import { gu } from '../../lib/i18n/locales/gu'
import { legacyPhraseTranslations } from '../../lib/i18n/legacy'
import { generatedLegacyPhraseTranslations } from '../../lib/i18n/legacy-generated'
import { BASE_PLAN_PHRASES } from '../../lib/i18n/base-plan-phrases'
import { createTemplatePhraseMatcher } from '../../lib/i18n/runtime'
import { collectLiteCopy, type LiteCopy } from './lite-copy-audit'
import { LITE_COPY_NOT_SHOWN } from './lite-copy-not-shown'

type Tree = { [key: string]: string | Tree }

/** The same phrase map the i18n provider builds for a language. */
export function livePhraseMap(language: 'hi' | 'gu') {
    const map = new Map<string, string>()
    const visit = (source: Tree, target: Tree) => {
        for (const key of Object.keys(source)) {
            const from = source[key]
            const to = target?.[key]
            if (typeof from === 'string' && typeof to === 'string') map.set(from, to)
            else if (from && to && typeof from === 'object' && typeof to === 'object') visit(from, to)
        }
    }
    visit(en as Tree, (language === 'hi' ? hi : gu) as Tree)
    for (const [source, target] of Object.entries(generatedLegacyPhraseTranslations[language])) map.set(source, target)
    for (const [source, target] of Object.entries(legacyPhraseTranslations[language])) map.set(source, target)
    for (const [source, target] of Object.entries(BASE_PLAN_PHRASES[language])) map.set(source, target)
    return map
}

/** Template values (`{0}`) stand for runtime text; a sample keeps the template matcher honest. */
const sample = (text: string) => text.replace(/\{\d+\}/g, '7')

export function findUntranslatedLiteCopy(copy: LiteCopy[] = collectLiteCopy()): LiteCopy[] {
    const checks = (['hi', 'gu'] as const).map(language => {
        const map = livePhraseMap(language)
        const matcher = createTemplatePhraseMatcher(map)
        return (text: string) => map.has(text) || matcher(sample(text)) !== undefined
    })
    return copy.filter(item => !LITE_COPY_NOT_SHOWN.has(item.text) && !checks.every(check => check(item.text)))
}
