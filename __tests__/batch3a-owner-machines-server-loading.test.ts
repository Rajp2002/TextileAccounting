/**
 * Batch 3A — /owner/machines server-loaded initial data
 *
 * These source-level tests guard the performance contract: the owner machines
 * route must render meaningful loom data from the server instead of waiting for
 * hydration, useUserProfile(), or browser-side Supabase bootstrapping.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('Batch 3A — owner machines route server loading', () => {
    const page = read('app/(dashboard)/owner/machines/page.tsx') + read('app/(dashboard)/owner/machines/LegacyMachinesPage.tsx')
    const loader = read('app/(dashboard)/owner/machines/loaders.ts')
    const machineManagement = read('components/MachineManagement.tsx')

    it('/owner/machines/page.tsx is a Server Component', () => {
        expect(page.trimStart()).not.toMatch(/^['"]use client['"]/)
        expect(page).toContain("requireRole(['owner'])")
        expect(page).toContain("loadOwnerMachinesInitialData(profile.org_id)")
        expect(page).not.toContain('useUserProfile')
    })

    it('loads initial machine data server-side and passes it to the client board', () => {
        expect(loader).toContain("import 'server-only'")
        expect(loader).toContain("createClient as createServerClient")
        expect(loader).toContain(".from('machines')")
        expect(loader).toContain(".from('workers')")
        expect(loader).toContain(".from('fixed_workers')")
        expect(loader).toContain(".from('orders')")
        expect(loader).toContain(".from('market_run_summary')")
        expect(loader).toContain(".from('machine_operator_assignments')")
        expect(loader).toContain(".from('machine_assignments')")

        expect(page).toContain('initialData={initialData}')
        expect(machineManagement).toContain('initialData?: MachineManagementInitialData')
        expect(machineManagement).toContain('initialData: initialData?.machines')
        expect(machineManagement).toContain('initialData: initialData?.productionTargets')
        expect(machineManagement).toContain('initialData: initialData?.assignments')
        expect(machineManagement).toContain('refetchOnMount: hasServerInitialData ? false : undefined')
    })

    it('does not make primary machine loading depend on useUserProfile()', () => {
        expect(machineManagement).not.toContain("from '@/hooks/use-user-profile'")
        expect(machineManagement).not.toContain('useUserProfile()')
        expect(machineManagement).toContain('userRole: MachineUserRole')
        expect(machineManagement).toContain("enabled: !!orgId && (userRole === 'owner' || userRole === 'supervisor')")
    })

    it('keeps owner authorization server-enforced for the owner route', () => {
        expect(page).toContain("requireRole(['owner'])")
        expect(page).toContain('userRole="owner"')
        expect(loader).toContain(".eq('org_id', orgId)")
    })
})
