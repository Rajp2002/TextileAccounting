import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    buildPrivacyRequestMailto,
    PRIVACY_REQUEST_CATEGORIES,
    PRIVACY_REQUEST_SERVICE_LEVEL,
} from '../lib/privacy-request'

const root = process.cwd()
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('Base Plan privacy-request workflow', () => {
    const page = source('app/privacy-request/page.tsx')
    const privacy = source('app/privacy/page.tsx')
    const footer = source('components/landing/footer.tsx')
    const ownerSettings = source('app/(dashboard)/owner/settings/page.tsx')
    const admin = source('app/(dashboard)/admin/admin-ui.tsx')
    const migration = source('supabase/migrations/20260824030000_base_privacy_request_workflow.sql')

    it('offers categorized requests through the monitored contact channel', () => {
        expect(PRIVACY_REQUEST_CATEGORIES.map((category) => category.value)).toEqual([
            'access',
            'correction',
            'deletion',
            'consent',
            'security',
            'grievance',
            'other',
        ])

        const mailto = buildPrivacyRequestMailto('Correct or update information')
        expect(mailto).toContain('mailto:rajpatel86420@gmail.com')
        expect(decodeURIComponent(mailto)).toContain('Weavly privacy request — Correct or update information')
        expect(decodeURIComponent(mailto)).toContain('do not include passwords')
    })

    it('publishes conservative internal service targets without calling them statutory deadlines', () => {
        expect(PRIVACY_REQUEST_SERVICE_LEVEL).toEqual({
            acknowledgementBusinessDays: 3,
            responseCalendarDays: 30,
        })
        expect(page).toContain('These are Weavly service targets')
        expect(page).not.toContain('DPDP Act Requirement')
        expect(privacy).toContain('within one month of receipt')
    })

    it('makes the request route readily available in public and owner surfaces', () => {
        expect(privacy).toContain('href="/privacy-request"')
        expect(footer).toContain("{ name: 'Privacy Request', href: '/privacy-request' }")
        expect(ownerSettings.match(/href="\/privacy-request"/g)).toHaveLength(1)
    })

    it('supersedes the incorrect seven-day clock with auditable Base operations', () => {
        expect(migration).toContain('ALTER COLUMN org_id DROP NOT NULL')
        expect(migration).toContain('requester_email TEXT')
        expect(migration).toContain('identity_verification_status TEXT')
        expect(migration).toContain('response_summary TEXT')
        expect(migration).toContain("NEW.grievance_type = 'DATA_PRIVACY'")
        expect(migration).toContain("::DATE + 30")
        expect(migration).not.toContain('::DATE + 7')
        expect(admin).toContain('internal target: respond to privacy grievances within 30 calendar days')
        expect(admin).not.toContain('DPDP Act Requirement: Resolve all grievances within 7 days')
        expect(admin).not.toContain("org_id: 'GLOBAL'")
    })
})
