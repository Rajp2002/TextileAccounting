import { createAdminClient } from '@/lib/supabase/admin'
import type { FactoryReadiness } from './base-onboarding'

/**
 * Centralized factory readiness evaluation.
 * Returns readiness of defaults, machines, workers, and payroll.
 */
export async function getFactoryReadiness(orgId: string): Promise<FactoryReadiness> {
    const admin = createAdminClient()

    const [
        costProfileResult,
        machinesResult,
        workersResult,
        payrollConfigResult,
    ] = await Promise.all([
        admin
            .from('factory_cost_profile')
            .select('yarn_shortage_pct, default_margin_pct')
            .eq('factory_id', orgId)
            .maybeSingle(),
        admin
            .from('base_production_machines')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .eq('is_active', true),
        admin
            .from('base_production_workers')
            .select('id, pay_type')
            .eq('org_id', orgId)
            .eq('is_active', true),
        admin
            .from('base_payroll_cycle_configs')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .is('effective_until', null),
    ])

    const defaultsConfigured = Boolean(
        costProfileResult.data &&
        typeof costProfileResult.data.yarn_shortage_pct === 'number' &&
        typeof costProfileResult.data.default_margin_pct === 'number'
    )

    const machineCount = machinesResult.count ?? 0
    const machinesConfigured = machineCount > 0

    const workers = workersResult.data ?? []
    let pieceRateCount = 0
    let fixedSalaryCount = 0
    for (const w of workers) {
        if (w.pay_type === 'fixed_monthly') fixedSalaryCount += 1
        else pieceRateCount += 1
    }
    const workersConfigured = workers.length > 0

    const payrollConfigured = (payrollConfigResult.count ?? 0) > 0

    const isFactoryReady = defaultsConfigured && machinesConfigured && workersConfigured && payrollConfigured

    return {
        defaultsConfigured,
        machinesConfigured,
        workersConfigured,
        payrollConfigured,
        isFactoryReady,
        machineCount,
        workerCount: {
            pieceRate: pieceRateCount,
            fixedSalary: fixedSalaryCount,
            total: workers.length,
        },
    }
}

/**
 * Check if the organization has completed Base onboarding.
 */
export async function isBaseOnboardingComplete(orgId: string): Promise<boolean> {
    const admin = createAdminClient()
    const { data, error } = await admin
        .from('organizations')
        .select('base_onboarding, onboarding_complete')
        .eq('id', orgId)
        .maybeSingle()

    if (error && (error.code === '42703' || error.message?.includes('base_onboarding'))) {
        const { data: fallbackData } = await admin
            .from('organizations')
            .select('onboarding_complete')
            .eq('id', orgId)
            .maybeSingle()
        return fallbackData?.onboarding_complete === true
    }

    if (!data) return false
    const baseOnboarding = data.base_onboarding as Record<string, unknown> | null
    if (baseOnboarding?.status === 'completed') return true
    if (data.onboarding_complete === true) return true
    return false
}
