import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LEGAL_DOCUMENTS, SIGNUP_LEGAL_ACCEPTANCE } from '../lib/legal-documents'
import { CreateOrgSchema } from '../lib/schemas'

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const validSignup = {
    ownerName: 'Raj Patel',
    email: 'owner@example.com',
    password: 'StrongPass1!',
    confirmPassword: 'StrongPass1!',
    factoryName: 'Example Factory',
    phone: '9876543210',
    legalAcceptance: {
        accepted: true,
        ...SIGNUP_LEGAL_ACCEPTANCE,
    },
}

describe('durable signup legal acceptance', () => {
    it('rejects missing, refused, and stale legal acceptance on the server', () => {
        expect(CreateOrgSchema.safeParse({
            ...validSignup,
            legalAcceptance: undefined,
        }).success).toBe(false)

        expect(CreateOrgSchema.safeParse({
            ...validSignup,
            legalAcceptance: {
                ...validSignup.legalAcceptance,
                accepted: false,
            },
        }).success).toBe(false)

        expect(CreateOrgSchema.safeParse({
            ...validSignup,
            legalAcceptance: {
                ...validSignup.legalAcceptance,
                termsVersion: 'stale-version',
            },
        }).success).toBe(false)
    })

    it('uses one canonical version for the signup UI, legal pages, and server evidence', () => {
        expect(LEGAL_DOCUMENTS.terms.identifier).toBe(`terms:${LEGAL_DOCUMENTS.terms.version}`)
        expect(LEGAL_DOCUMENTS.privacy.identifier).toBe(`privacy:${LEGAL_DOCUMENTS.privacy.version}`)

        const signup = source('app/(auth)/signup/page.tsx')
        const terms = source('app/terms/page.tsx')
        const privacy = source('app/privacy/page.tsx')

        expect(signup).toContain('...SIGNUP_LEGAL_ACCEPTANCE')
        expect(terms).toContain('LEGAL_DOCUMENTS.terms.displayDate')
        expect(privacy).toContain('LEGAL_DOCUMENTS.privacy.displayDate')
    })

    it('records both documents before profile creation and fails closed on evidence errors', () => {
        const action = source('app/(auth)/actions/auth.ts')

        expect(action).toContain(".from('legal_document_acceptances')")
        expect(action).toContain('LEGAL_DOCUMENTS.terms.identifier')
        expect(action).toContain('LEGAL_DOCUMENTS.privacy.identifier')
        expect(action).toContain("acceptance_method: 'signup_checkbox'")
        expect(action).toContain('Unable to record legal acceptance. Your account was not created.')
        const finishStart = action.indexOf('const finishOrganizationCreation')
        const recordCall = action.indexOf('await recordSignupLegalAcceptances(', finishStart)
        const profileCall = action.indexOf('await _createOwnerProfile(', finishStart)

        expect(finishStart).toBeGreaterThan(-1)
        expect(recordCall).toBeGreaterThan(finishStart)
        expect(recordCall).toBeLessThan(profileCall)
    })

    it('keeps acceptance evidence inaccessible to browser roles', () => {
        const migration = source(
            'supabase/migrations/20260823203156_record_signup_legal_acceptance.sql',
        )

        expect(migration).toContain('ALTER TABLE public.legal_document_acceptances ENABLE ROW LEVEL SECURITY')
        expect(migration).toContain(
            'REVOKE ALL ON TABLE public.legal_document_acceptances FROM PUBLIC, anon, authenticated',
        )
        expect(migration).toContain(
            'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.legal_document_acceptances TO service_role',
        )
        expect(migration).toContain('UNIQUE (actor_user_id, document_identifier)')
    })

    it('includes legal acceptance in the owner organization export', () => {
        const dataExport = source('app/(dashboard)/owner/settings/data-export.ts')

        expect(dataExport).toContain(
            "{ key: 'legal_document_acceptances', query: scoped('legal_document_acceptances') }",
        )
        expect(dataExport).toContain(
            "legal_document_acceptances: '20260823203156_record_signup_legal_acceptance.sql'",
        )
        expect(dataExport).toContain("schema_version: 'base-legal-v1'")
    })
})
