/**
 * Batch 3C — /owner/payroll server-loaded first ledger
 *
 * This guards the route-level performance contract without coupling it to a
 * particular tenant's payroll rows. Payroll math remains in the shared read
 * model; the route only changes where the first read happens and how duplicate
 * cycle reads are consolidated.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Batch 3C — owner payroll server initial load', () => {
    const page = read('app/(dashboard)/owner/payroll/page.tsx')
    const client = read('app/(dashboard)/owner/payroll/PayrollClient.tsx')
    const loader = read('app/(dashboard)/owner/payroll/loaders.ts')
    const readModel = read('app/(dashboard)/owner/payroll/read-model.ts')
    const actions = read('app/(dashboard)/owner/payroll/actions.ts')

    it('keeps owner authorization and the initial ledger on the server', () => {
        expect(page.trimStart()).not.toMatch(/^['"]use client['"]/)
        expect(page).toContain("requireRole(['owner'])")
        expect(page).toContain('loadOwnerPayrollInitialData(profile.org_id, requestedMonth)')
        expect(page).toContain("createPerfTimer('/owner/payroll')")
        expect(page).toContain('server initial payroll shares cycle logs')
    })

    it('consolidates overlapping current-cycle reads before rendering the client', () => {
        expect(loader).toContain("import 'server-only'")
        expect(loader).toContain('tracePayrollQuery')
        expect(loader).toContain('[payroll/query]')
        expect(loader).toContain("from('production_logs')")
        expect(loader).toContain("from('workers')")
        expect(loader).toContain("from('fixed_workers')")
        expect(loader).toContain("from('machines')")
        expect(loader).toContain("from('payroll_settlements')")
        expect(loader).toContain("from('worker_advances')")
        expect(loader).toContain("from('orders')")
        expect(loader).toContain("from('attendance')")
        expect(loader).toContain("from('machine_operator_assignments')")
        expect(loader).toContain(".in('worker_type', ['meter', 'fixed'])")
        expect(loader).toContain('buildMeterWorkerPayroll')
        expect(loader).toContain('buildFixedWorkerPayroll')
    })

    it('seeds the first ledger without profile hydration or mount refetches', () => {
        expect(client).not.toContain('useUserProfile')
        expect(client).toContain('initialData.orgId')
        expect(client).toContain('initialData: hasServerInitialCycle ? initialData.meterWorkers : undefined')
        expect(client).toContain('initialData: hasServerInitialCycle ? initialData.fixedWorkers : undefined')
        expect(client).toContain("refetchOnMount: hasServerInitialCycle ? false : 'always'")
        expect(client).toContain('hasHydrated &&')
        expect(client).toContain('!!meterWorkers')
        expect(client).toContain('!!fixedWorkers')
    })

    it('keeps the operator-schema fallback visible and preserves shared payroll math', () => {
        expect(loader).toContain('operatorSchemaWarning')
        expect(client).toContain('Worker Hisaab data needs attention')
        expect(readModel).toContain('calculateMeterOperatorGross')
        expect(readModel).toContain('calculateFixedMachineOperatorGross')
    })

    it('fails closed rather than settling a meter worker from an unavailable production-log projection', () => {
        expect(actions).toContain('const { data: logs, error: logsError }')
        expect(actions).toContain("if (logsError) return { error: 'Failed to load payroll production logs. Resolve the payroll schema issue before settling this worker.' }")
    })
})
