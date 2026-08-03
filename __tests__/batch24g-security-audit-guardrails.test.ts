import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationPath = 'supabase/migrations/20260705100000_batch_24g_security_audit_guardrails.sql'
const hardeningMigrationPath = 'supabase/migrations/20260705182406_harden_settings_audit_function.sql'

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function functionBody(source: string, name: string) {
    const start = source.indexOf(`export async function ${name}`)
    expect(start, `${name} exists`).toBeGreaterThanOrEqual(0)
    const next = source.indexOf('\nexport async function ', start + 1)
    return source.slice(start, next === -1 ? undefined : next)
}

describe('Batch 24G security and audit source guardrails', () => {
    const migration = readProjectFile(migrationPath)
    const hardeningMigration = readProjectFile(hardeningMigrationPath)
    const ownerActions = readProjectFile('app/(dashboard)/owner/actions.ts')
    const estimatorActions = readProjectFile('app/(dashboard)/owner/estimator/actions.ts')
    const authActions = readProjectFile('app/(auth)/actions/auth.ts')
    const complianceActions = readProjectFile('lib/actions/compliance.ts')
    const dataExport = readProjectFile('app/(dashboard)/owner/settings/data-export.ts')
    const settingsPage = readProjectFile('app/(dashboard)/owner/settings/page.tsx')
    const exportButton = readProjectFile('components/settings/organization-data-export-button.tsx')

    it('SEC-015 adds settings audit triggers for the scoped settings tables only', () => {
        for (const table of [
            'organizations',
            'factory_cost_profile',
            'compliance_settings',
            'notification_consents',
            'whatsapp_settings',
        ]) {
            expect(migration).toContain(`public.${table}`)
            expect(migration).toContain(`audit_settings_${table}`)
        }

        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.log_settings_audit_event()')
        expect(migration).toContain("v_row_data->>'org_id'")
        expect(migration).toContain("v_row_data->>'factory_id'")
        expect(migration).toContain("TG_TABLE_NAME = 'organizations'")
        expect(migration).toContain('old_data, new_data, changed_by')
    })

    it('SEC-015 keeps the settings audit migration non-destructive and secret-aware', () => {
        expect(migration).toContain('ALTER COLUMN org_id DROP NOT NULL')
        expect(migration).toContain('redact_settings_audit_payload')
        expect(migration).toContain("v_payload := v_payload - 'access_code_hash' - 'last_code_plain'")
        expect(migration).toContain("jsonb_set(v_payload, '{join_code}', '\"[REDACTED]\"'::jsonb")
        expect(migration).toContain("p_table_name = 'whatsapp_settings'")
        expect(migration).toContain("jsonb_set(v_payload, '{value}', '\"[REDACTED]\"'::jsonb")
        expect(migration).toContain("p_table_name = 'notification_consents'")
        expect(migration).toContain("jsonb_set(v_payload, '{phone}', '\"[REDACTED]\"'::jsonb")

        expect(migration).not.toMatch(/DROP\s+TABLE/i)
        expect(migration).not.toMatch(/TRUNCATE/i)
        expect(migration).not.toMatch(/DELETE\s+FROM/i)
        expect(migration).not.toMatch(/DROP\s+COLUMN/i)
    })

    it('SEC-015 hardens settings audit helper function search paths and direct grants', () => {
        expect(hardeningMigration).toContain(
            'ALTER FUNCTION public.redact_settings_audit_payload(TEXT, JSONB)'
        )
        expect(hardeningMigration).toContain(
            'ALTER FUNCTION public.log_settings_audit_event()'
        )
        expect(hardeningMigration).toContain('SET search_path = public, pg_temp')
        expect(hardeningMigration).toContain(
            'REVOKE ALL ON FUNCTION public.redact_settings_audit_payload(TEXT, JSONB)'
        )
        expect(hardeningMigration).toContain(
            'REVOKE ALL ON FUNCTION public.log_settings_audit_event()'
        )
        expect(hardeningMigration).toContain('FROM PUBLIC, anon, authenticated')
    })

    it('SEC-015 sets audit actors around settings mutations that rely on trigger coverage', () => {
        for (const name of [
            'updateOrganizationName',
            'updateOrganizationProductionMode',
            'setBeamTrackingEnabled',
        ]) {
            const body = functionBody(ownerActions, name)
            expect(body).toContain("const { user, profile } = await requireRole(['owner'])")
            expect(body).toContain('setAuditActorForMutation(supabase, user.id)')
        }

        expect(functionBody(estimatorActions, 'getFactoryCostProfile')).toContain("supabase.rpc('set_actor_for_audit'")
        expect(functionBody(estimatorActions, 'upsertFactoryCostProfile')).toContain("supabase.rpc('set_actor_for_audit'")
        expect(functionBody(complianceActions, 'updateGRODetails')).toContain("supabase.rpc('set_actor_for_audit'")

        const regenerateJoinCode = functionBody(authActions, 'regenerateJoinCode')
        expect(regenerateJoinCode).toContain("const { user, profile } = await requireRole(['owner'])")
        expect(regenerateJoinCode).toContain("const supabase = await createClient()")
        expect(regenerateJoinCode).toContain("supabase.rpc('set_actor_for_audit'")
        expect(regenerateJoinCode).not.toContain('createAdminClient()')
    })

    it('SEC-009 audits owner exports before returning the payload', () => {
        const body = functionBody(dataExport, 'exportOrganizationData')
        const auditIndex = body.indexOf("supabase.rpc('log_export_event'")
        const returnIndex = body.indexOf('return {')

        expect(body).toContain("const { user, profile } = await requireRole(['owner'])")
        expect(body).toContain("p_table_name: 'owner_data_export'")
        expect(body).toContain('p_record_id: exportRun.id')
        expect(body).toContain('p_actor_id: user.id')
        expect(body).toContain("throw new Error('Data export could not be audited.")
        expect(auditIndex).toBeGreaterThanOrEqual(0)
        expect(auditIndex).toBeLessThan(returnIndex)
    })

    it('SEC-009 scopes exports to the owner org and removes unnecessary sensitive fields', () => {
        const body = functionBody(dataExport, 'exportOrganizationData')

        expect(body).toContain("eq('org_id', orgId)")
        expect(body).toContain("eq('factory_id', orgId)")
        expect(body).toContain("eq('id', orgId)")
        expect(body).toContain("supabase.from('workers').select('id, org_id, name, is_active, start_date, pf_esi_eligible, pf_esi_enrolled')")
        expect(body).toContain("supabase.from('fixed_workers').select('id, org_id, name, role, monthly_salary, is_active, start_date, pf_esi_eligible, pf_esi_enrolled')")
        expect(body).toContain("supabase.from('profiles').select('id, full_name, role')")
        expect(body).not.toContain("supabase.from('workers').select('*')")
        expect(body).not.toContain("supabase.from('fixed_workers').select('*')")
        expect(body).not.toContain("select('id, full_name, role, phone')")
    })

    it('SEC-009 applies a central redaction review and excludes runtime secret sources', () => {
        expect(dataExport).toContain('const SENSITIVE_EXPORT_FIELD_NAMES = new Set')
        expect(dataExport).toContain("'service_role_key'")
        expect(dataExport).toContain("'authorization'")
        expect(dataExport).toContain("'cookie'")
        expect(dataExport).toContain("'tracking_token'")
        expect(dataExport).toContain('function redactSensitiveFields')
        expect(dataExport).toContain('redactRows(productionLogs as ExportRecord[] | null)')
        expect(dataExport).toContain('sensitive_fields_review')
        expect(dataExport).toContain("'environment variables'")
        expect(dataExport).toContain("'request headers'")
    })

    it('SEC-009 wires the owner data export into active settings UI', () => {
        expect(settingsPage).toContain("import { OrganizationDataExportButton } from '@/components/settings/organization-data-export-button'")
        expect(settingsPage).toContain('<OrganizationDataExportButton />')
        expect(exportButton).toContain('exportOrganizationData()')
        expect(exportButton).toContain('downloadJson(payload, payload.filename)')
        expect(exportButton).toContain("toast.success(tx('Data export generated'")
    })
})
