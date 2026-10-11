import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEGAL_DOCUMENTS } from '../lib/legal-documents'
import { LEGAL_OPERATOR } from '../lib/legal-operator'

const root = process.cwd()
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('Free, Lite, and Base privacy policy accuracy', () => {
    const privacy = source('app/privacy/page.tsx')

    it('publishes a new version for the corrected privacy notice', () => {
        expect(LEGAL_DOCUMENTS.privacy.version).toBe('2026-10-11')
        expect(LEGAL_DOCUMENTS.privacy.identifier).toBe('privacy:2026-10-11')
        expect(privacy).toContain('LEGAL_DOCUMENTS.privacy.displayDate')
    })

    it('discloses saved Free costings separately from temporary inputs and allowance records', () => {
        expect(privacy).toContain('Completed Free costings are saved to your account')
        expect(privacy).toContain('Unfinished Free inputs are held in page memory')
        expect(privacy).toContain('monthly allowance and usage')
        expect(privacy).toContain('This cleanup does not delete saved Free costings')
        expect(privacy).toContain('These events do not contain costing inputs or calculated results')
    })

    it('identifies the confirmed pre-incorporation operator and grievance channel', () => {
        expect(LEGAL_OPERATOR.displayName).toBe('Raj Patel, operating under the Weavly name')
        expect(LEGAL_OPERATOR.contactEmail).toBe('rajpatel86420@gmail.com')
        expect(LEGAL_OPERATOR.postalAddress).toBe(
            'A.K. 395008, Ankur Char Rasta, Surat, Gujarat 395008',
        )
        expect(privacy).toContain('LEGAL_OPERATOR.displayName')
        expect(privacy).toContain('LEGAL_OPERATOR.contactEmail')
        expect(privacy).toContain('LEGAL_OPERATOR.postalAddress')
        expect(privacy).not.toContain('privacy@weavly.app')
    })

    it('matches the configured grievance officer defaults', () => {
        const grievanceMigration = source('supabase/migrations/20260426134500_update_gro_final.sql')

        expect(grievanceMigration).toContain("gro_name = 'Raj Patel'")
        expect(grievanceMigration).toContain("gro_email = 'rajpatel86420@gmail.com'")
    })

    it('describes Weavly responsibility separately from customer-provided business data', () => {
        expect(privacy).toContain('Weavly determines why and how personal information is processed')
        expect(privacy).toContain('the account owner decides what to enter and why')
        expect(privacy).not.toContain('Weavly acts solely as a Data Processor')
    })

    it('discloses implemented providers and diagnostic collection', () => {
        for (const provider of ['Supabase', 'Vercel', 'Razorpay', 'Sentry', 'Upstash']) {
            expect(privacy).toContain(`<strong>${provider}</strong>`)
        }
        expect(privacy).toContain('masked error-session replay')
        expect(privacy).toContain('IP address, request time, browser and device information')
        expect(privacy).toContain('essential authentication cookies')
    })

    it('removes unsupported absolute security and retention promises', () => {
        expect(privacy).toContain('do not make unauthorized access impossible')
        expect(privacy).not.toContain('Cross-organization data access is architecturally impossible')
        expect(privacy).not.toContain('permanently and irreversibly deleted from our systems')
        expect(privacy).not.toContain('Retained for 180 days after account deletion')
        expect(privacy).toContain('rolling period of 180 days in India')
    })

    it('states the current and phased incident and grievance positions accurately', () => {
        expect(privacy).toContain("CERT-In&apos;s six-hour reporting direction")
        expect(privacy).not.toContain('all affected users within <strong>72 hours</strong>')
        expect(privacy).toContain('within one month of receipt')
        expect(privacy).not.toContain("value: '7 working days'")
        expect(privacy).toContain('does not represent that every DPDP provision is already in force')
        expect(privacy).toContain('Lite and Base')
        expect(privacy).toContain('Product-usage events are first-party service analytics')
    })
})
