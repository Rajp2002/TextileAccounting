import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const page = read('app/security-incident/page.tsx')
const policy = read('app/privacy/page.tsx')
const footer = read('components/landing/footer.tsx')
const settings = read('app/(dashboard)/owner/settings/page.tsx')
const constants = read('lib/security-incident.ts')
const actions = read('lib/actions/compliance.ts')
const adminPage = read('app/(admin-console)/admin/legacy/page.tsx')
const adminReads = read('lib/admin/legacy-read.ts')
const migration = read('supabase/migrations/20260824040000_base_security_incident_workflow.sql')
const runbook = read('docs/legal/base-security-incident-runbook.md')

describe('Base Plan security incident workflow', () => {
    it('provides a discoverable public reporting channel with safe-reporting guidance', () => {
        expect(page).toContain('Report a suspected security incident')
        const publicRoutes = read('proxy.ts').split('function isPublicRoute')[1].split('function logProxyPhase')[0]
        expect(publicRoutes).toContain("pathname === '/security-incident'")
        expect(publicRoutes).not.toContain("pathname.startsWith('/security')")
        expect(page).toContain('Do not send passwords, OTPs, card or bank credentials')
        expect(page).toContain('buildSecurityIncidentMailto')
        expect(footer).toContain("href: '/security-incident'")
        expect(policy).toContain('href="/security-incident"')
        expect(settings).toContain('href="/security-incident"')
    })

    it('keeps the initial workflow limited to current Lite/Base data', () => {
        expect(constants).toContain('Account and authentication data')
        expect(constants).toContain('Costings and associated business contacts')
        expect(constants).toContain('Billing references and subscription records')
        expect(constants).not.toContain('Worker payroll data')
        expect(page).toContain('Weavly Lite stores costing records')
        expect(page).toContain('Weavly Base additionally stores owner-run production records')
        expect(migration).toContain('security_incidents_base_categories_only')
    })

    it('keeps the incident register server-only', () => {
        expect(migration).toContain('ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY')
        expect(migration).toContain('ALTER TABLE public.security_incidents FORCE ROW LEVEL SECURITY')
        expect(migration).toContain('REVOKE ALL ON TABLE public.security_incidents FROM PUBLIC, anon, authenticated')
        expect(migration).toContain('TO service_role')
        expect(actions).toContain("const supabase = createAdminClient()")
        expect(adminPage).toContain('listLegacyRecords(query)')
        expect(adminReads).toContain("table: 'security_incidents'")
        expect(adminReads).toContain('await authorizeLegacyRead()')
        expect(adminReads).not.toContain("select('*')")
    })

    it('distinguishes the current CERT-In assessment clock from phased DPDP readiness', () => {
        expect(migration).toContain("aware_at + interval '6 hours'")
        expect(migration).toContain("DEFAULT 'not_yet_applicable'")
        expect(runbook).toContain('does not mean every support ticket')
        expect(runbook).toContain('not_yet_applicable')
        expect(runbook).toContain('within 72 hours')
        expect(runbook).toContain('future clock as a presently operative blanket deadline')
    })

    it('does not present the legacy export as a prescribed DPDP form', () => {
        expect(actions).not.toContain('FORM DPDP-BN1')
        expect(actions).not.toContain('PENDING_REGISTRATION')
        expect(actions).toContain('DRAFT_FOR_REVIEW_NOT_A_PRESCRIBED_FORM')
    })
})
