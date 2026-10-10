import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeSignupPlan } from '../lib/base-plan-visibility'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

const BASE_CLOSED_MESSAGE = 'Weavly Base is not available for new accounts yet.'
const CREATE_ORDER = 'app/api/billing/create-order/route.ts'

describe('create-order refuses Base for orgs that cannot view Base', () => {
    it('returns a 403 with the Base-unavailable message when the org has no Base visibility', () => {
        const route = read(CREATE_ORDER)
        expect(route).toContain(`{ error: '${BASE_CLOSED_MESSAGE}' }`)
        expect(route).toMatch(
            /if \(access\.baseVisible !== true\) \{\s*return NextResponse\.json\(\s*\{ error: 'Weavly Base is not available for new accounts yet\.' \},\s*\{ status: 403 \},?\s*\)/,
        )
    })

    it('loads plan access only for Base, after the self-serve tier allowlist', () => {
        const route = read(CREATE_ORDER)
        const tierGuard = route.indexOf('if (!isSelfServePlanTier(planTier))')
        const baseGate = route.indexOf("if (planTier === 'base') {")
        const accessLoad = route.indexOf('const access = await getOrgPlanAccess(orgId)')

        expect(route).toContain("import { getOrgPlanAccess } from '@/lib/subscription'")
        expect(route.match(/getOrgPlanAccess\(/g)).toHaveLength(1)
        expect(tierGuard).toBeGreaterThan(-1)
        expect(baseGate).toBeGreaterThan(tierGuard)
        expect(accessLoad).toBeGreaterThan(baseGate)
    })

    it('rejects Base before pricing, lifecycle, claim creation and any Razorpay call', () => {
        const route = read(CREATE_ORDER)
        const rejection = route.indexOf(BASE_CLOSED_MESSAGE)
        const lifecycle = route.indexOf('resolveBillingPurchase(')
        const claim = route.indexOf("rpc('claim_billing_checkout_attempt'")
        const pricing = route.indexOf('getBillingPlan(planTier)')
        const provider = route.indexOf('razorpay.orders.create')

        expect(rejection).toBeGreaterThan(-1)
        expect(rejection).toBeLessThan(pricing)
        expect(rejection).toBeLessThan(lifecycle)
        expect(rejection).toBeLessThan(claim)
        expect(rejection).toBeLessThan(provider)
    })
})

describe('createOrganization normalises the requested plan before the Free decision', () => {
    it('normalises input.selectedPlan before computing freeSignup', () => {
        const action = read('app/(auth)/actions/auth.ts')
        const normalise = action.indexOf('normalizeSignupPlan(input.selectedPlan)')
        const freeSignup = action.indexOf("const freeSignup = selectedPlan === 'free'")

        expect(action).toContain("import { normalizeSignupPlan } from '@/lib/base-plan-visibility'")
        expect(normalise).toBeGreaterThan(-1)
        expect(freeSignup).toBeGreaterThan(normalise)
        expect(action.match(/input\.selectedPlan/g)).toHaveLength(1)
    })

    it('keeps the plans redirect after signup unchanged', () => {
        expect(read('app/(auth)/actions/auth.ts')).toContain("redirect('/plans?from=onboarding')")
    })
})

describe('signup page maps ?plan= through normalizeSignupPlan', () => {
    it('derives selectedPlan from the normalised request so plan=base behaves as Free', () => {
        const page = read('app/(auth)/signup/page.tsx')
        expect(page).toContain("import { normalizeSignupPlan } from '@/lib/base-plan-visibility'")
        expect(page).toMatch(
            /const selectedPlan = normalizeSignupPlan\(requestedPlan === 'lite' \? 'lite' as const : requestedPlan === 'base' \? 'base' as const : 'free' as const\)/,
        )
        expect(page).toContain("const compactMobile = selectedPlan === 'free' || selectedPlan === 'lite'")
    })
})

describe('normalizeSignupPlan (pure)', () => {
    it('turns a Base signup into Free while Base is closed', () => {
        expect(normalizeSignupPlan('base')).toBe('free')
    })

    it('keeps Lite and defaults a missing plan to Free', () => {
        expect(normalizeSignupPlan('lite')).toBe('lite')
        expect(normalizeSignupPlan(undefined)).toBe('free')
    })
})

describe('public root metadata does not promote Base', () => {
    it('the site-wide description offers Free and Lite, not Base', () => {
        const description = read('app/layout.tsx').match(/description: "([^"]*)"/)?.[1] ?? ''
        expect(description).toContain('Start with Free, choose Lite for unlimited costings and yarn rates.')
        expect(description).not.toMatch(/\bBase\b/)
    })
})
