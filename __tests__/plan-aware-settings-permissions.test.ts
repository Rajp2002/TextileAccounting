import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { hasCapability } from '../lib/subscription-access'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Plan-Aware Settings & Factory Defaults Permissions (ST01–ST18)', () => {
    const actions = read('app/(dashboard)/owner/settings/actions.ts')
    const settingsPage = read('app/(dashboard)/owner/settings/page.tsx')
    const freeAccountPage = read('app/free/account/FreeAccount.tsx')
    const settingsView = read('components/settings/plan-aware/plan-aware-settings-view.tsx')
    const costingDefaultsCard = read('components/settings/plan-aware/costing-defaults-card.tsx')
    const personalInfoCard = read('components/settings/plan-aware/personal-information-card.tsx')
    const factoryDetailsCard = read('components/settings/plan-aware/factory-details-card.tsx')
    const deletionReviewCard = read('components/settings/plan-aware/deletion-review-card.tsx')

    it('ST01: Enforces entitlement matrix for costing_defaults capability', () => {
        expect(hasCapability('free', 'costing_defaults')).toBe(false)
        expect(hasCapability('lite', 'costing_defaults')).toBe(true)
        expect(hasCapability('base', 'costing_defaults')).toBe(true)
    })

    it('ST02: saveCostingDefaults action validates plan capability before updating', () => {
        expect(actions).toContain("hasCapability(planAccess.effectiveTier, 'costing_defaults')")
        expect(actions).toContain('Costing defaults require a Weavly Lite or Base plan.')
    })

    it('ST03: saveCostingDefaults enforces strict schema boundaries on CD01-CD05', () => {
        expect(actions).toContain('CostingDefaultsInputSchema = z.object({')
        expect(actions).toContain(".strict()")

        // CD01: yarn wastage % (0-100)
        expect(actions).toContain(".min(0, 'Wastage percentage cannot be negative')")
        expect(actions).toContain(".max(100, 'Wastage percentage cannot exceed 100%')")

        // CD02: target margin % (0-99.99)
        expect(actions).toContain(".min(0, 'Target margin cannot be negative')")
        expect(actions).toContain(".max(99.99, 'Target margin must be less than 100%')")

        // CD03: overheadMode ('direct' | 'monthly_expenses')
        expect(actions).toContain("overheadMode: z.enum(['direct', 'monthly_expenses']")

        // CD04: warpingMode ('in_house' | 'outsourced')
        expect(actions).toContain("warpingMode: z.enum(['in_house', 'outsourced']")

        // CD05: sizingMode ('in_house' | 'outsourced')
        expect(actions).toContain("sizingMode: z.enum(['in_house', 'outsourced']")
    })

    it('ST04: saveCostingDefaults supports optimistic concurrency and rejects stale saves', () => {
        expect(actions).toContain('validateExpectedTimestamp(parsed.data.expectedUpdatedAt')
        expect(actions).toContain('These settings changed elsewhere. Review the latest values before saving.')
        expect(actions).toContain('stale: true')
    })

    it('ST05: Personal info updates only allow fullName and reject privilege escalation', () => {
        expect(actions).toContain('UpdatePersonalInputSchema = z.object({')
        expect(actions).toContain("fullName: z")
        expect(actions).toContain('.strict()')
        expect(actions).toContain(".update({ full_name: parsed.data.fullName })")
        expect(actions).not.toContain(".update({ role:")
        expect(actions).not.toContain(".update({ email:")
        expect(actions).not.toContain(".update({ phone:")
    })

    it('ST06: Factory details updates only allow name and protect join_code', () => {
        expect(actions).toContain('UpdateFactoryInputSchema = z.object({')
        expect(actions).toContain("name: z")
        expect(actions).toContain('.strict()')
        expect(actions).toContain(".update({ name: parsed.data.name })")
        expect(actions).not.toContain(".update({ join_code:")
        expect(actions).not.toContain(".update({ id:")
    })

    it('ST07: Security password reset triggers honest email reset with rate limiting', () => {
        expect(actions).toContain('export async function requestSecurityPasswordReset()')
        expect(actions).toContain('checkAuthRateLimit(`pwd-reset:${user.id}`)')
        expect(actions).toContain('requestPasswordReset({ email: user.email })')
        expect(actions).toContain('Password reset link was recently sent.')
    })

    it('ST08: PlanAwareSettingsView conditionally mounts defaults based on canEditDefaults', () => {
        expect(settingsView).toContain('canEditDefaults: boolean')
        expect(settingsView).toMatch(/\{canEditDefaults && <div className=\{[^}]+\}><FreeSettingsGroup[^>]*><CostingDefaultsCard/)
        expect(settingsView).toContain('<CostingDefaultsCard')
    })

    it('ST09: Free tier passes canEditDefaults={false} to omit paid defaults form', () => {
        expect(freeAccountPage).toContain('PlanAwareSettingsView')
        expect(freeAccountPage).toContain('tier="free"')
        expect(freeAccountPage).toContain('canEditDefaults={false}')
    })

    it('ST10: Lite and Base pass canEditDefaults={true} and wire factory defaults', () => {
        expect(settingsPage).toContain('PlanAwareSettingsView')
        expect(settingsPage).toContain('tier={tier}')
        expect(settingsPage).toContain('canEditDefaults')
        expect(settingsPage).toContain('yarnShortagePct: Number(costProfileData.yarn_shortage_pct ?? 0)')
        expect(settingsPage).toContain('defaultMarginPct: Number(costProfileData.default_margin_pct ?? 10)')
    })

    it('ST11: All modular plan-aware cards exist with independent save/discard controls', () => {
        expect(existsSync(join(root, 'components/settings/plan-aware/personal-information-card.tsx'))).toBe(true)
        expect(existsSync(join(root, 'components/settings/plan-aware/factory-details-card.tsx'))).toBe(true)
        expect(existsSync(join(root, 'components/settings/plan-aware/costing-defaults-card.tsx'))).toBe(true)
        expect(existsSync(join(root, 'components/settings/plan-aware/security-card.tsx'))).toBe(true)
        expect(existsSync(join(root, 'components/settings/plan-aware/deletion-review-card.tsx'))).toBe(true)
        expect(existsSync(join(root, 'components/settings/plan-aware/unsaved-changes-dialog.tsx'))).toBe(true)

        // Independent Discard & Save buttons per section
        expect(personalInfoCard).toContain('Discard')
        expect(personalInfoCard).toContain('Save personal info')
        expect(factoryDetailsCard).toContain('Discard')
        expect(factoryDetailsCard).toContain('Save factory details')
        expect(costingDefaultsCard).toContain('Discard')
        expect(costingDefaultsCard).toContain('Save costing defaults')
    })

    it('ST12: Deletion review card presents comprehensive scope before permanent deletion', () => {
        expect(deletionReviewCard).toContain('Review deletion…')
        expect(deletionReviewCard).toContain('deleteAccountPermanently')
        expect(deletionReviewCard).toContain('ACCOUNT_DELETION_CONFIRMATION_PHRASE')
        expect(deletionReviewCard).toContain('clearClientSessionState')
    })
})
