import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateCycleRule } from '@/lib/payroll-cycle-engine'

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
    const actionBody = (name: string) => {
        const start = actionsSource.indexOf(`export async function ${name}(`)
        const next = actionsSource.indexOf('export async function', start + 1)
        return actionsSource.slice(start, next === -1 ? undefined : next)
    }
    const payrollAction = actionBody('saveBaseOnboardingPayrollAction')

    // Refactor fix package F2 (AS-01): the earlier contract required a
    // service-role fallback, which let a refused write bypass the Base and
    // lock checks. Same-day edits are handled in place by the RPC
    // (20260915120000, asserted below), so the action now uses only the RPC.
    it('persists through the atomic update_base_payroll_cycle RPC effective today', () => {
        expect(payrollAction).toContain(".rpc('update_base_payroll_cycle', {")
        // Today, or go-live while the factory is still setting up (the current cycle starts there).
        expect(payrollAction).toContain('p_effective_from: inSetup ? goLive : today,')
        expect(payrollAction).toContain('rule: validation.normalizedRule')
    })

    it('has no service-role fallback or direct table write', () => {
        expect(payrollAction).not.toContain('createAdminClient')
        expect(payrollAction).not.toContain("from('base_payroll_cycle_configs')")
    })

    it('checks the organization lock in every mutating onboarding action', () => {
        for (const name of [
            'saveBaseOnboardingDraftAction', 'saveBaseOnboardingFactoryAction', 'saveBaseOnboardingDefaultsAction',
            'saveBaseOnboardingMachinesBulkAction', 'saveBaseOnboardingWorkersBulkAction',
            'saveBaseOnboardingPayrollAction', 'completeBaseOnboardingAction',
        ]) {
            expect(actionBody(name), name).toContain("requireWritableOrg(['owner'])")
        }
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
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.complete_base_payroll_period(date, date, jsonb, text[]) TO authenticated, service_role;')
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
