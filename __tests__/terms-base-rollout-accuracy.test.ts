import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BILLING_PLANS, BILLING_SELF_SERVE_PLAN_TIERS } from '../lib/billing-constants'
import { LEGAL_DOCUMENTS } from '../lib/legal-documents'
import { LEGAL_OPERATOR } from '../lib/legal-operator'

const root = process.cwd()
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('Base Plan initial-rollout Terms accuracy', () => {
    const terms = source('app/terms/page.tsx')
    const refunds = source('app/refund-policy/page.tsx')

    it('publishes a new version that identifies the pre-incorporation operator', () => {
        expect(LEGAL_DOCUMENTS.terms.version).toBe('2026-08-29')
        expect(LEGAL_DOCUMENTS.terms.identifier).toBe('terms:2026-08-29')
        expect(LEGAL_OPERATOR.displayName).toBe('Raj Patel, operating under the Weavly name')
        expect(terms).toContain('LEGAL_DOCUMENTS.terms.displayDate')
        expect(terms).toContain('LEGAL_OPERATOR.displayName')
        expect(terms).toContain('LEGAL_OPERATOR.postalAddress')
        expect(terms).toContain('LEGAL_OPERATOR.contactEmail')
        expect(terms).not.toContain('legal@weavly.app')
    })

    it('matches the server-authoritative Base catalog and self-serve boundary', () => {
        expect(BILLING_SELF_SERVE_PLAN_TIERS).toEqual(['base'])
        expect(BILLING_PLANS.base.firstYearTotalPaise).toBe(826_000)
        expect(BILLING_PLANS.base.renewalTotalPaise).toBe(236_000)
        expect(terms).toContain('₹8,260 total')
        expect(terms).toContain('₹2,360 total/year')
        expect(terms).toContain('single-factory costing workspace')
    })

    it('keeps the Base production core separate from Full Suite scope', () => {
        expect(terms).toContain('Full Suite modules remain separate scope')
        expect(terms).toContain('Simple production jobs created from saved costings')
        expect(terms).toContain('are not available for purchase under these Terms')
        expect(terms).toContain('are not promised for any date')
        expect(terms).toContain('Any future Full Suite offering will require separate availability, pricing, and applicable terms')
        expect(refunds).toContain('A Base payment does not purchase those modules')
    })

    it('describes manual renewal and actual post-expiry export behavior', () => {
        expect(terms).toContain('We do not automatically charge the Base Plan renewal')
        expect(terms).toContain('no cancellation action is required')
        expect(terms).toContain('owner-only organization export remains available while the account is retained')
        expect(terms).not.toContain('30-day window to export')
        expect(terms).not.toContain('Account information is retained for 180 days per IT Intermediary Guidelines')
        expect(refunds).toContain('No cancellation switch or cancellation request is required')
        expect(refunds).not.toContain('support@weavly.app')
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
