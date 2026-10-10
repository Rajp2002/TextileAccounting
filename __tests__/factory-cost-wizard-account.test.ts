import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Factory cost wizard account-level persistence & dismissal', () => {
    const actionsSrc = read('app/(dashboard)/owner/estimator/actions.ts')
    const pageSrc = read('app/(dashboard)/owner/estimator/page.tsx')
    const wizardSrc = read('app/(dashboard)/owner/estimator/FactoryCostWizard.tsx')
    const estimatorSrc = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

    describe('dismissFactoryCostWizard action contract', () => {
        it('exports dismissFactoryCostWizard and enforces owner role', () => {
            expect(actionsSrc).toContain('export async function dismissFactoryCostWizard(): Promise<{ success: boolean }> {')
            expect(actionsSrc).toMatch(/dismissFactoryCostWizard[\s\S]*?requireRole\(\['owner'\]\)/)
        })

        it('persists wizard dismissal to user_metadata and database', () => {
            expect(actionsSrc).toContain('factory_cost_wizard_dismissed: true')
            expect(actionsSrc).toMatch(/dismissFactoryCostWizard[\s\S]*?supabase\.auth\.updateUser/)
            expect(actionsSrc).toMatch(/dismissFactoryCostWizard[\s\S]*?from\('factory_cost_profile'\)\s*\.upsert\(\{\s*factory_id:\s*profile\.org_id,\s*is_configured:\s*true/)
            expect(actionsSrc).toMatch(/dismissFactoryCostWizard[\s\S]*?revalidatePath\('\/owner\/estimator'\)/)
        })

        it('updates user_metadata upon saving cost profile', () => {
            expect(actionsSrc).toMatch(/upsertFactoryCostProfile[\s\S]*?factory_cost_wizard_dismissed: true/)
        })
    })

    describe('Active account auto-detection in getFactoryCostProfile', () => {
        it('checks account-level metadata or existing rates/qualities to auto-heal is_configured', () => {
            expect(actionsSrc).toContain('user.user_metadata?.factory_cost_wizard_dismissed === true')
            expect(actionsSrc).toContain(".from('cost_rate_book')")
            expect(actionsSrc).toContain(".from('estimator_templates')")
            expect(actionsSrc).toContain('shouldMarkConfigured = true')
            expect(actionsSrc).toMatch(/shouldMarkConfigured[\s\S]*?from\('factory_cost_profile'\)\s*\.update\(\{\s*is_configured:\s*true\s*\}\)/)
        })
    })

    describe('EstimatorClient reducer and state safety', () => {
        it('prevents RESET from reverting isConfigured back to false', () => {
            expect(estimatorSrc).toContain('isConfigured: state.isConfigured || next.isConfigured')
        })

        it('prevents RESTORE_DRAFT from reverting isConfigured back to false', () => {
            expect(estimatorSrc).toContain('isConfigured: state.isConfigured || Boolean(action.draftState.isConfigured)')
        })

        it('tracks live profile in currentProfileRef across session resets', () => {
            expect(estimatorSrc).toContain('const currentProfileRef = useRef<FactoryCostProfile | null | undefined>(initialProfile)')
            expect(estimatorSrc).toContain('handleNewQualityConfirm')
            expect(estimatorSrc).toContain('currentProfileRef.current ?? initialProfile')
            expect(estimatorSrc).toContain('currentProfileRef.current = pRes.data')
        })

        it('gates FactoryCostWizard with !wizardDismissed and wires onDismiss handler', () => {
            expect(estimatorSrc).toContain('{!state.isConfigured && !wizardDismissed && factoryWizardOpen && (')
            expect(estimatorSrc).toContain('{!state.isConfigured && !wizardDismissed && !factoryPromptHidden && !factoryWizardOpen && (')
            expect(estimatorSrc).toContain('onDismiss={async () => {')
            expect(estimatorSrc).toContain('dismissFactoryCostWizard()')
        })
    })

    describe('First-run setup lets the owner cost first', () => {
        it('offers the wizard inline instead of opening it over the estimator', () => {
            expect(estimatorSrc).toContain('const [factoryWizardOpen, setFactoryWizardOpen] = useState(false)')
            expect(estimatorSrc).toContain('<FactorySetupPrompt')
            expect(estimatorSrc).toContain('hasResult={hasValidCostResult}')
            expect(estimatorSrc).toContain('onClose={() => setFactoryWizardOpen(false)}')
        })

        it('closing the wizard does not record a dismissal; Skip still does', () => {
            expect(wizardSrc).toContain('onClick={onClose ?? onDismiss}')
            expect(wizardSrc).toContain('onClick={onDismiss}')
        })
    })

    describe('FactoryCostWizard dismiss and skip affordances', () => {
        it('provides a top-right close X button with an accessible label', () => {
            expect(wizardSrc).toContain('onDismiss?: () => void')
            expect(wizardSrc).toContain('aria-label="Close setup wizard"')
            expect(wizardSrc).toContain('<X className="h-5 w-5" />')
        })

        it('provides a Skip for now action on the intro step', () => {
            expect(wizardSrc).toContain("Skip for now · I&apos;ve already set this up")
        })
    })

    describe('Server page passes account-level dismissal to client', () => {
        it('extracts wizardDismissed from user_metadata and passes it to EstimatorClient', () => {
            expect(pageSrc).toContain('const wizardDismissed = user.user_metadata?.factory_cost_wizard_dismissed === true')
            expect(pageSrc).toContain('wizardDismissed={wizardDismissed}')
        })
    })
})
