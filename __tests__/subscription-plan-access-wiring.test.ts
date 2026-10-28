/**
 * Task 4 — getOrgPlanAccess is wired to the trial-aware pure resolvers.
 *
 * Source contract over lib/subscription.ts:
 * 1. The organization read also selects the Base visibility and Lite trial
 *    eligibility flags, and the nested subscription select includes is_trial.
 * 2. Access is composed by resolveOrgAccessFromRows, not the legacy inline
 *    composition.
 * 3. The Free grant lookup stays lazy: getFreeGrant runs only when no tier
 *    resolved, so paid organizations pay no extra query.
 * 4. getSubscriptionDetail selects is_trial so billing can tell a trial from
 *    a paid term.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const subscription = readFileSync(join(root, 'lib/subscription.ts'), 'utf8')

/** Returns the source of one exported function, up to the next top-level export. */
function exportedFunctionSource(name: string): string {
    const start = subscription.indexOf(`export async function ${name}(`)
    expect(start, `${name} must be exported`).toBeGreaterThanOrEqual(0)
    const next = subscription.indexOf('\nexport ', start + 1)
    return subscription.slice(start, next === -1 ? undefined : next)
}

describe('getOrgPlanAccess trial-aware wiring', () => {
    const planAccess = exportedFunctionSource('getOrgPlanAccess')

    it('imports resolveOrgAccessFromRows and applyFreeGrantToAccess from subscription-access', () => {
        expect(subscription).toMatch(
            /import\s*\{[^}]*\bresolveOrgAccessFromRows\b[^}]*\}\s*from\s*'\.\/subscription-access'/,
        )
        expect(subscription).toMatch(
            /import\s*\{[^}]*\bapplyFreeGrantToAccess\b[^}]*\}\s*from\s*'\.\/subscription-access'/,
        )
    })

    it('selects base_plan_visible and lite_trial_eligible from organizations with is_trial in the nested select', () => {
        expect(planAccess).toContain(
            "'base_plan_visible, lite_trial_eligible, org_subscriptions(status, plan_tier, current_start, current_end, razorpay_payment_id, created_at, is_trial)'",
        )
    })

    it('reads the subscription rows once and composes access through resolveOrgAccessFromRows', () => {
        expect(planAccess).toContain('const subscriptionRows = data?.org_subscriptions ?? []')
        expect(planAccess).toMatch(
            /resolveOrgAccessFromRows\(\{\s*rows:\s*subscriptionRows,\s*baseFlag:\s*data\?\.base_plan_visible,\s*trialFlag:\s*data\?\.lite_trial_eligible,?\s*\}\)/,
        )
    })

    it('no longer composes the tier inline with the legacy resolvers', () => {
        expect(planAccess).not.toContain('resolveEffectiveSubscription(')
        expect(planAccess).not.toContain('resolveOrgPlanAccess(')
        expect(planAccess).not.toContain('hasPaidBaseHistory(')
        expect(planAccess).not.toContain('hasEstablishedPaidHistory(')
    })

    it('returns paid and trial access without touching the Free grant', () => {
        const earlyReturn = planAccess.indexOf("if (access.effectiveTier !== 'none') return access")
        expect(earlyReturn).toBeGreaterThan(-1)
    })

    it('looks up the Free grant only after the effective tier resolved to none', () => {
        const earlyReturn = planAccess.indexOf("if (access.effectiveTier !== 'none') return access")
        // A caller may pass a grant read it already started (freeContext); otherwise it is read here.
        const grantLookup = planAccess.indexOf('await (freeGrantRead ?? getFreeGrant(orgId))')
        expect(grantLookup).toBeGreaterThan(earlyReturn)
        expect(planAccess).toContain('return applyFreeGrantToAccess(access, subscriptionRows, Boolean(grant))')
    })
})

describe('getSubscriptionDetail trial column', () => {
    const detail = exportedFunctionSource('getSubscriptionDetail')

    it('selects is_trial from org_subscriptions', () => {
        expect(detail).toContain("created_at, is_trial')")
    })

    it('declares is_trial on the returned subscription object', () => {
        expect(detail).toContain('is_trial: boolean | null')
    })
})
