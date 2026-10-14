import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { productionTutorialCopy } from '@/lib/i18n/production-tutorial'

// Yarn Stock was deleted on 2026-10-14. Activating a quality no longer checks yarn, so the production page has no
// yarn gate and the production tour no longer says yarn stock is needed.
const read = (path: string) => readFileSync(path, 'utf8')
const qualities = read('app/(dashboard)/owner/production/BaseActiveQualities.tsx')
const actions = read('app/(dashboard)/owner/production/actions.ts')

describe('quality activation without yarn stock', () => {
    it('the active qualities panel has no yarn gate or inline yarn entry', () => {
        for (const token of ['yarn-actions', 'mutateYarnStock', 'validateQualityActivationYarnAction', 'yarnGateModal', 'inlineAddYarn', 'Yarn required before production']) {
            expect(qualities, token).not.toContain(token)
        }
    })

    it('the production actions never check yarn or report a blocked activation', () => {
        expect(actions).not.toContain('validate_quality_activation_yarn')
        expect(actions).not.toContain('validateQualityActivationYarnAction')
        expect(actions).not.toContain('result.blocked')
    })

    it('never reports success when the database says the activation did not happen', () => {
        // Until the 20261014120000 migration is applied, the old RPC can still answer { success: false, blocked: true }.
        expect(actions).toContain("if ((data as { success?: boolean } | null)?.success === false) return { error: 'Saved quality could not be activated for production. Please try again.' }")
    })

    it('the production tour does not ask for yarn stock in any language', () => {
        const yarn = { en: /yarn/i, hi: /धाग/, gu: /યાર્ન/ } as const
        for (const language of ['en', 'hi', 'gu'] as const) {
            const { prereq, activate } = productionTutorialCopy[language]
            for (const text of [prereq.title, prereq.body, prereq.detail ?? '', activate.body, activate.detail ?? '']) {
                expect(text, `${language}: ${text}`).not.toMatch(yarn[language])
            }
        }
    })
})
