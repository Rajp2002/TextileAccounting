/**
 * Batch 3D — /owner/advances server-loaded first view
 *
 * Primary roster and pending-recovery data must arrive with the server render.
 * Selected-worker ledger and earnings remain intentionally user-triggered.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildPendingAdvanceOverview } from '../app/(dashboard)/owner/advances/read-model'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Batch 3D — owner advances server initial load', () => {
    const page = read('app/(dashboard)/owner/advances/page.tsx')
    const client = read('app/(dashboard)/owner/advances/AdvancesClient.tsx')
    const loader = read('app/(dashboard)/owner/advances/loaders.ts')
    const readModel = read('app/(dashboard)/owner/advances/read-model.ts')

    it('keeps owner authorization and the initial overview on the server', () => {
        expect(page.trimStart()).not.toMatch(/^['"]use client['"]/)
        expect(page).toContain("requireRole(['owner'])")
        expect(page).toContain('loadOwnerAdvancesInitialData(profile.org_id)')
        expect(page).toContain("createPerfTimer('/owner/advances')")
        expect(page).toContain('selected-worker detail remains deferred')
    })

    it('loads the active roster and pending overview in one parallel server payload', () => {
        expect(loader).toContain("import 'server-only'")
        expect(loader).toContain('Promise.all([')
        expect(loader).toContain('traceAdvancesQuery')
        expect(loader).toContain('[advances/query]')
        expect(loader).toContain("from('workers')")
        expect(loader).toContain("from('fixed_workers')")
        expect(loader).toContain("from('worker_advances')")
        expect(loader).toContain(".eq('status', 'pending')")
        expect(loader).toContain("requireRows(meterWorkersResult, 'meter workers')")
        expect(loader).toContain("requireRows(fixedWorkersResult, 'fixed workers')")
        expect(loader).toContain("requireRows(pendingAdvancesResult, 'pending advances')")
        expect(readModel).toContain('buildWorkers')
        expect(readModel).toContain('buildPendingAdvanceOverview')
    })

    it('seeds primary React Query keys without client profile hydration or a mount refetch', () => {
        expect(client).not.toContain('useUserProfile')
        expect(client).toContain('initialData.orgId')
        expect(client).toContain('initialData: initialData.workers')
        expect(client).toContain('initialData: initialData.pendingAdvances')
        expect(client).toContain('refetchOnMount: false')
        expect(client).toContain("enabled: !!selectedWorker")
        expect(client).toContain("label: 'advances.selected_worker'")
        expect(client).toContain("label: 'advances.typical_monthly_meter'")
    })

    it('normalizes Supabase relation joins whether the worker relation is singular or an array', () => {
        const overview = buildPendingAdvanceOverview([
            {
                id: 1,
                amount: 500,
                description: null,
                status: 'pending',
                created_at: '2026-07-10T00:00:00.000Z',
                deducted_at: null,
                deducted_in_month: null,
                meter_worker_id: 10,
                fixed_worker_id: null,
                workers: [{ name: 'Meter Worker' }],
                fixed_workers: null,
            },
            {
                id: 2,
                amount: 750,
                description: null,
                status: 'pending',
                created_at: '2026-07-10T00:00:00.000Z',
                deducted_at: null,
                deducted_in_month: null,
                meter_worker_id: null,
                fixed_worker_id: 20,
                workers: null,
                fixed_workers: { name: 'Fixed Worker' },
            },
        ])

        expect(overview).toMatchObject([
            { workerName: 'Meter Worker', workerType: 'meter' },
            { workerName: 'Fixed Worker', workerType: 'fixed' },
        ])
    })
})
