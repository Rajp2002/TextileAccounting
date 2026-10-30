/**
 * Paid-plan pilot rules (spec 2026-10-30 section C2). Weavly takes no real money
 * until the founder goes live. Pure and client-safe; the server reads the state
 * in lib/paid-plans.server.ts.
 */
export const PAID_PLAN_INTEREST_SOURCES = ['billing', 'plan_card', 'upgrade_preview'] as const
export type PaidPlanInterestSource = typeof PAID_PLAN_INTEREST_SOURCES[number]

export type PaidPlansState = { live: boolean; goLiveAt: string | null; checkoutOpen: boolean }

/**
 * Real accounts may pay only after go-live with live keys. Test, demo and internal
 * accounts may use test keys at any time, so the founder can keep testing payments.
 */
export function computeCheckoutOpen(goLiveAt: string | null, testAccount: boolean, mode: 'test' | 'live' | 'blocked'): boolean {
    return (goLiveAt !== null && mode === 'live') || (testAccount && mode === 'test')
}
