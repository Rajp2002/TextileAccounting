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
  const authActions = readProjectFile('app/(auth)/actions/auth.ts')

    it('upserts payroll_configs by org_id', () => {
        expect(payrollActions).toContain(".from('payroll_configs')")
        expect(payrollActions).toContain("onConflict: 'org_id'")
    })

  it('saves pay date and reminder settings with the cycle config', () => {
    expect(payrollActions).toContain('pay_date_day: parsed.data.payDateDay')
    expect(payrollActions).toContain('pay_reminder_days: parsed.data.payReminderDays')
    expect(onboardingChecklist).toContain('payroll can be added later from the workflow that needs them.')
    })

    it('keeps auditability for org_id-keyed payroll_configs', () => {
        expect(auditMigration).toContain("COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'org_id')")
        expect(auditMigration).toContain("COALESCE(to_jsonb(OLD)->>'id', to_jsonb(OLD)->>'org_id')")
        expect(auditMigration).not.toContain('NEW.id::TEXT')
    })

  it('keeps payroll setup out of the blocking onboarding gate', () => {
    expect(onboardingChecklist).not.toContain("from '@/app/(dashboard)/owner/payroll/actions'")
    expect(onboardingChecklist).not.toContain('function PayrollCycleForm')
    expect(onboardingChecklist).toContain('Set these up when you need them')
  })

  it('completes onboarding with production mode and plan only', () => {
    expect(authActions).toContain('const isComplete = hasProductionMode && hasPlan')
    expect(authActions).not.toContain('const isComplete = hasProductionMode && hasMachine && hasWorker && hasPayrollConfig && hasPlan')
  })
})
