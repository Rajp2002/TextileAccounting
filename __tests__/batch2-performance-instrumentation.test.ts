/**
 * Batch 2 — Route performance instrumentation
 *
 * These tests are intentionally source-level. The production behavior is
 * unchanged; the goal is to ensure the lightweight dev-only timing hooks stay
 * attached to the routes that Batch 2 measures.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('Batch 2 — perf utility', () => {
    const perf = read('lib/perf.ts')

    it('is development-only unless WEAVLY_PERF_LOGS is explicitly enabled on the server', () => {
        expect(perf).toContain("env?.NODE_ENV === 'development'")
        expect(perf).toContain("env?.WEAVLY_PERF_LOGS === 'true'")
        expect(perf).toContain("typeof window === 'undefined'")
    })

    it('logs the required route-level fields', () => {
        expect(perf).toContain('route: this.route')
        expect(perf).toContain('auth_session_ms')
        expect(perf).toContain('profile_org_tier_ms')
        expect(perf).toContain('business_data_ms')
        expect(perf).toContain('total_server_load_ms')
        expect(perf).toContain('supabase_calls')
    })
})

describe('Batch 2 — server route instrumentation', () => {
    it('measures owner layout auth/profile/org loading', () => {
        const layout = read('app/(dashboard)/owner/layout.tsx')
        expect(layout).toContain("createPerfTimer('/owner/* layout')")
        expect(layout).toContain("perf.measure('authSession'")
        expect(layout).toContain("perf.measure(\n        'profileOrgTier'")
    })

    it('measures AccessGate tier loading with route labels', () => {
        const gate = read('components/billing/AccessGate.tsx')
        expect(gate).toContain('routeName?: string')
        expect(gate).toContain("createPerfTimer(routeName)")
        expect(gate).toContain("perf.measure('authSession'")
        expect(gate).toContain("perf.measure(\n        'profileOrgTier'")

        for (const route of ['dispatches', 'payroll', 'machines', 'advances', 'commercials']) {
            const layout = read(`app/(dashboard)/owner/${route}/layout.tsx`)
            expect(layout).toContain(`routeName="/owner/${route}"`)
        }
    })

    it('measures server data loaders for today, dispatches, and commercials', () => {
        const todayActions = read('app/(dashboard)/owner/today/actions.ts')
        expect(todayActions).toContain("createPerfTimer('/owner/today')")
        expect(todayActions).toContain("perf.measure('authSession'")
        expect(todayActions).toContain("'businessData'")
        expect(todayActions).toContain('24')
        expect(todayActions).toContain('24-query fanout plus payroll cycle')

        const dispatchesPage = read('app/(dashboard)/owner/dispatches/page.tsx')
        const dispatchesLoader = read('app/(dashboard)/owner/dispatches/loaders.ts')
        expect(dispatchesPage).toContain("createPerfTimer('/owner/dispatches')")
        expect(dispatchesPage).toContain('loadOwnerDispatchesInitialData')
        expect(dispatchesLoader).toContain('getAllDispatches')
        expect(dispatchesLoader).toContain('getDispatchOverviewStats')
        expect(dispatchesLoader).toContain('getPendingStockSales')

        const commercialsPage = read('app/(dashboard)/owner/commercials/page.tsx')
        expect(commercialsPage).toContain("createPerfTimer('/owner/commercials')")
        expect(commercialsPage).toContain('getCommercialsData()')
        expect(commercialsPage).toContain('getCommercialReceivables()')
        expect(commercialsPage).toContain('getCollectedThisMonth()')
        expect(commercialsPage).toContain('getCommercialPartyInsights()')
    })
})

describe('Batch 2 — client bootstrap instrumentation', () => {
    it('measures profile bootstrap only when a route opts in', () => {
        const hook = read('hooks/use-user-profile.ts')
        expect(hook).toContain('perfRouteName?: string')
        expect(hook).toContain("label: 'useUserProfile.auth_user_id'")
        expect(hook).toContain("label: 'useUserProfile.profile'")

        const payrollPage = read('app/(dashboard)/owner/payroll/page.tsx')
        const payrollClient = read('app/(dashboard)/owner/payroll/PayrollClient.tsx')
        const advancesPage = read('app/(dashboard)/owner/advances/page.tsx')
        const advancesClient = read('app/(dashboard)/owner/advances/AdvancesClient.tsx')
        expect(payrollPage).toContain("requireRole(['owner'])")
        expect(payrollClient).not.toContain('useUserProfile')
        expect(read('app/(dashboard)/owner/machines/page.tsx')).toContain("useUserProfile('/owner/machines')")
        expect(advancesPage).toContain("requireRole(['owner'])")
        expect(advancesClient).not.toContain('useUserProfile')
    })

    it('measures payroll, machines, and advances client business queries', () => {
        const payroll = read('app/(dashboard)/owner/payroll/PayrollClient.tsx')
        expect(payroll).toContain("label: 'payroll.config'")
        expect(payroll).toContain("label: 'payroll.org_name'")
        expect(payroll).toContain('payroll.meter.')
        expect(payroll).toContain('payroll.fixed.')
        expect(payroll).toContain('payroll.pay_date_meter.')
        expect(payroll).toContain('payroll.pay_date_fixed.')

        const machines = read('components/MachineManagement.tsx')
        expect(machines).toContain("label: 'machines.list'")
        expect(machines).toContain("label: 'machines.meter_workers'")
        expect(machines).toContain("label: 'machines.fixed_workers'")
        expect(machines).toContain("label: 'machines.production_targets'")
        expect(machines).toContain("label: 'machines.assignments'")

        const advances = read('app/(dashboard)/owner/advances/AdvancesClient.tsx')
        expect(advances).toContain("label: 'advances.workers'")
        expect(advances).toContain("label: 'advances.all_pending'")
        expect(advances).toContain("label: 'advances.selected_worker'")
        expect(advances).toContain("label: 'advances.typical_monthly_meter'")
    })
})
