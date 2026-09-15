import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
    validateCycleRule,
    WEEKDAYS,
    type WeekdayName,
} from '@/lib/payroll-cycle-engine'
import type { PayrollCycleInput } from '@/lib/base-onboarding'

const root = process.cwd()
function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('Base Onboarding — Step 5 Payroll Presets & Input Atomicity', () => {
    const step5Source = readProjectFile('components/onboarding/base/Step5Payroll.tsx')

    it('uses an atomic updatePayroll helper to prevent state clobbering', () => {
        expect(step5Source).toContain('const updatePayroll = (fields: Partial<PayrollCycleInput>) => {')
        expect(step5Source).toContain('onChangePayroll({')
        expect(step5Source).toContain('...payroll,')
        expect(step5Source).toContain('...fields,')
    })

    it('sets Every 14 days preset atomically with intervalDays: 14', () => {
        expect(step5Source).toContain("cycleType: 'interval_days'")
        expect(step5Source).toContain('intervalDays: 14')
    })

    it('sets Custom preset atomically with default or existing interval', () => {
        expect(step5Source).toContain("cycleType: 'interval_days'")
        expect(step5Source).toContain('intervalDays: (payroll.intervalDays && payroll.intervalDays !== 14) ? payroll.intervalDays : 24')
    })

    it('accurately identifies active preset states', () => {
        expect(step5Source).toContain("const isFortnightly = currentType === 'interval_days' && (payroll.intervalDays === 14 || !payroll.intervalDays)")
        expect(step5Source).toContain("const isCustom = currentType === 'interval_days' && Boolean(payroll.intervalDays && payroll.intervalDays !== 14)")
    })

    it('validates rules for Monthly, Weekly, Every 14 days, and Custom 24 days', () => {
        // Monthly (11th of month)
        const monthly = validateCycleRule({ type: 'monthly', anchorDay: 11 })
        expect(monthly.valid).toBe(true)
        expect(monthly.normalizedRule).toEqual({ type: 'monthly', anchorDay: 11 })

        // Weekly (Wednesday)
        const weekly = validateCycleRule({ type: 'weekly', anchorWeekday: 'wednesday' })
        expect(weekly.valid).toBe(true)
        expect(weekly.normalizedRule).toEqual({ type: 'weekly', anchorWeekday: 'wednesday' })

        // Every 14 days
        const fortnightly = validateCycleRule({
            type: 'interval_days',
            interval: 14,
            anchorDate: '2026-09-15',
        })
        expect(fortnightly.valid).toBe(true)
        expect(fortnightly.normalizedRule).toEqual({
            type: 'interval_days',
            interval: 14,
            anchorDate: '2026-09-15',
        })

        // Custom (24 days)
        const custom = validateCycleRule({
            type: 'interval_days',
            interval: 24,
            anchorDate: '2026-09-15',
        })
        expect(custom.valid).toBe(true)
        expect(custom.normalizedRule).toEqual({
            type: 'interval_days',
            interval: 24,
            anchorDate: '2026-09-15',
        })
    })
})

describe('Base Onboarding — Payroll Persistence Contract & Same-Day Updates', () => {
    const actionsSource = readProjectFile('app/(auth)/onboarding/base/actions.ts')

    it('checks for existing active configurations before updating', () => {
        expect(actionsSource).toContain("from('base_payroll_cycle_configs')")
        expect(actionsSource).toContain(".is('effective_until', null)")
    })

    it('handles same-day modifications in-place to preserve date monotonicity', () => {
        expect(actionsSource).toContain('existingConfig.effective_from >= today')
        expect(actionsSource).toContain('.update({')
        expect(actionsSource).toContain('cycle_type: cycleType,')
        expect(actionsSource).toContain('rule: validation.normalizedRule,')
    })

    it('includes authenticated and admin client fallbacks with error diagnostics', () => {
        expect(actionsSource).toContain('const admin = createAdminClient()')
        expect(actionsSource).toContain('console.warn(')
        expect(actionsSource).toContain('console.error(')
    })
})

describe('Base Onboarding — Database Migration for Same-Day Updates & Service Role', () => {
    const migration = readProjectFile('supabase/migrations/20260915120000_fix_base_payroll_same_day_update_and_service_grants.sql')

    it('grants table permissions on base_payroll_cycle_configs and base_payroll_periods to service_role', () => {
        expect(migration).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.base_payroll_cycle_configs TO service_role;')
        expect(migration).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.base_payroll_periods TO service_role;')
    })

    it('grants function execute permissions on update_base_payroll_cycle to service_role and authenticated', () => {
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.update_base_payroll_cycle(text, jsonb, date) TO authenticated, service_role;')
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.complete_base_payroll_period(date, date, uuid, text) TO authenticated, service_role;')
    })

    it('supports same-day in-place update in update_base_payroll_cycle RPC', () => {
        expect(migration).toContain('IF p_effective_from = v_existing_effective_from THEN')
        expect(migration).toContain('UPDATE public.base_payroll_cycle_configs')
        expect(migration).toContain('SET cycle_type = p_cycle_type,')
        expect(migration).toContain('rule = p_rule,')
        expect(migration).toContain('updated_at = now()')
        expect(migration).toContain('WHERE id = v_existing_id;')
    })
})
