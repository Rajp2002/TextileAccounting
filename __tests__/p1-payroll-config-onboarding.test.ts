import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 payroll config onboarding save', () => {
    const payrollActions = readProjectFile('app/(dashboard)/owner/payroll/actions.ts')
    const auditMigration = readProjectFile('supabase/migrations/20260514110000_fix_audit_record_id_fallback.sql')
    const onboardingChecklist = readProjectFile('app/(auth)/onboarding/checklist.tsx')

    it('upserts payroll_configs by org_id', () => {
        expect(payrollActions).toContain(".from('payroll_configs')")
        expect(payrollActions).toContain("onConflict: 'org_id'")
    })

    it('keeps auditability for org_id-keyed payroll_configs', () => {
        expect(auditMigration).toContain("COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'org_id')")
        expect(auditMigration).toContain("COALESCE(to_jsonb(OLD)->>'id', to_jsonb(OLD)->>'org_id')")
        expect(auditMigration).not.toContain('NEW.id::TEXT')
    })

    it('shows a retryable onboarding error instead of a dead step', () => {
        expect(onboardingChecklist).toContain('setError(res.error)')
        expect(onboardingChecklist).toContain('Retry Payroll Config')
    })
})
