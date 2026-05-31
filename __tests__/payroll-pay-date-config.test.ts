import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('payroll pay date configuration', () => {
    const migration = readProjectFile('supabase/migrations/20260530220517_payroll_pay_date_config.sql')
    const schemas = readProjectFile('lib/schemas.ts')
    const payrollPage = readProjectFile('app/(dashboard)/owner/payroll/page.tsx')
    const todayActions = readProjectFile('app/(dashboard)/owner/today/actions.ts')

    it('adds pay date and reminder columns to payroll_configs', () => {
        expect(migration).toContain('ADD COLUMN IF NOT EXISTS pay_date_day')
        expect(migration).toContain('ADD COLUMN IF NOT EXISTS pay_reminder_days')
        expect(migration).toContain('pay_date_day >= 1 AND pay_date_day <= 28')
        expect(migration).toContain('pay_reminder_days >= 0 AND pay_reminder_days <= 14')
    })

    it('validates pay date settings on the server action schema', () => {
        expect(schemas).toContain('payDateDay')
        expect(schemas).toContain('Pay date must be between 1 and 28')
        expect(schemas).toContain('payReminderDays')
        expect(schemas).toContain('Reminder window must be between 0 and 14 days')
    })

    it('defaults payroll to current cycle while surfacing previous pay-date cycle', () => {
        expect(payrollPage).toContain('setSelectedMonth(currentMonth)')
        expect(payrollPage).toContain('PayDateOverview')
        expect(payrollPage).toContain('payDateCycleMonth')
        expect(payrollPage).toContain('selectedCycleStatus.is_payroll_window_open')
        expect(todayActions).toContain('getPayrollMonthForDate')
        expect(todayActions).toContain('getPreviousPayrollMonth')
        expect(todayActions).toContain('isPayWindowOpen')
    })
})
