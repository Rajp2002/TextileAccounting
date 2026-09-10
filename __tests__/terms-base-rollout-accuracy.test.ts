import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BILLING_PLANS, BILLING_SELF_SERVE_PLAN_TIERS } from '../lib/billing-constants'
import { LEGAL_DOCUMENTS } from '../lib/legal-documents'
import { LEGAL_OPERATOR } from '../lib/legal-operator'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TermsOfServicePage from '../app/terms/page'
import RefundPolicyPage from '../app/refund-policy/page'
import LandingPricing from '../components/landing/pricing'
import { formatINR } from '../lib/finance'

const root = process.cwd()
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('Free, Lite, and Base commercial policy accuracy', () => {
    const terms = source('app/terms/page.tsx')
    const refunds = source('app/refund-policy/page.tsx')
    const publicPrices = [TermsOfServicePage, RefundPolicyPage, LandingPricing].map(
        (page) => renderToStaticMarkup(createElement(page)),
    )

    it('publishes a new version that identifies the pre-incorporation operator', () => {
        expect(LEGAL_DOCUMENTS.terms.version).toBe('2026-09-11')
        expect(LEGAL_DOCUMENTS.terms.identifier).toBe('terms:2026-09-11')
        expect(LEGAL_OPERATOR.displayName).toBe('Raj Patel, operating under the Weavly name')
        expect(terms).toContain('LEGAL_DOCUMENTS.terms.displayDate')
        expect(terms).toContain('LEGAL_OPERATOR.displayName')
        expect(terms).toContain('LEGAL_OPERATOR.postalAddress')
        expect(terms).toContain('LEGAL_OPERATOR.contactEmail')
        expect(terms).not.toContain('legal@weavly.app')
    })

    it('matches the server-authoritative Base catalog and self-serve boundary', () => {
        expect(BILLING_SELF_SERVE_PLAN_TIERS).toEqual(['lite', 'base'])
        expect(BILLING_PLANS.lite.firstYearTotalPaise).toBe(299_900)
        expect(BILLING_PLANS.lite.renewalTotalPaise).toBe(149_900)
        expect(BILLING_PLANS.base.firstYearTotalPaise).toBe(999_900)
        expect(BILLING_PLANS.base.renewalTotalPaise).toBe(499_900)
        for (const page of publicPrices) {
            expect(page).toContain('Weavly Free')
            for (const tier of BILLING_SELF_SERVE_PLAN_TIERS) {
                const plan = BILLING_PLANS[tier]
                expect(page).toContain(plan.name)
                expect(page).toContain(formatINR(plan.firstYearTotalPaise / 100, { hideDecimals: true }))
                expect(page).toContain(formatINR(plan.renewalTotalPaise / 100, { hideDecimals: true }))
            }
            expect(page).not.toContain('/month')
        }
        expect(terms).toContain('one Customer organization or factory workspace')
    })

    it('keeps the Base production core separate from broader future scope', () => {
        expect(terms).toContain('other broader operational modules')
        expect(terms).toContain('production jobs created from saved costings')
        expect(terms).toContain('are outside the current Lite and Base catalog')
        expect(terms).toContain('are not promised under these Terms')
        expect(refunds).toContain('Other operational modules outside the current catalog')
    })

    it('describes manual renewal and actual post-expiry export behavior', () => {
        expect(terms).toContain('We do not automatically charge a Lite or Base renewal')
        expect(terms).toContain('no cancellation action is required')
        expect(terms).toContain('owner-only organization export remains available while the account is retained')
        expect(terms).not.toContain('30-day window to export')
        expect(terms).not.toContain('Account information is retained for 180 days per IT Intermediary Guidelines')
        expect(refunds).toContain('No cancellation switch or cancellation request is required')
        expect(refunds).not.toContain('support@weavly.app')
    })

    it('covers Free allowance and distinguishes expiry from a Free downgrade', () => {
        expect(terms).toContain('two successful costings per week')
        expect(terms).toContain('every Monday at 12:00 am India Standard Time')
        expect(terms).toContain('Unused allowance does not roll over')
        expect(terms).toContain('automatically revert to Free')
        expect(refunds).toContain('Free has no subscription payment to cancel or refund')
        expect(refunds).toContain('Use of Free before purchasing a paid plan does not by itself count')
    })

    it('uses the privacy policy data-role allocation and qualified liability terms', () => {
        expect(terms).toContain('Weavly is responsible for account, authentication, billing, security, support')
        expect(terms).not.toContain('We act solely as a data processor')
        expect(terms).toContain('Except for liability that cannot lawfully be limited')
        expect(terms).toContain('fraud, wilful misconduct')
        expect(terms).toContain('does not require indemnification to the extent a claim was caused by Weavly')
    })

    it('uses mutual arbitrator selection and preserves non-waivable remedies', () => {
        expect(terms).toContain('sole arbitrator mutually appointed by the parties')
        expect(terms).toContain('seat and legal place of arbitration is Surat, Gujarat, India')
        expect(terms).toContain('statutory forum or remedy that cannot lawfully be waived')
    })
})
