import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function read(relPath: string) {
    return readFileSync(join(process.cwd(), relPath), 'utf8')
}

describe('Active Qualities Production Simplification Flow', () => {
    const migrationPath = 'supabase/migrations/20260914100000_active_qualities_production_simplification.sql'
    const actionsPath = 'app/(dashboard)/owner/production/actions.ts'
    const clientPath = 'app/(dashboard)/owner/production/BaseProductionClient.tsx'
    const activeQualitiesPath = 'app/(dashboard)/owner/production/BaseActiveQualities.tsx'
    const machineBoardPath = 'app/(dashboard)/owner/production/BaseMachineBoard.tsx'
    const qualityDialogPath = 'app/(dashboard)/owner/production/MachineQualityDialog.tsx'
    const assignmentWorkspacePath = 'app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx'
    const quotesClientPath = 'app/(dashboard)/owner/quotes/QuotesClient.tsx'

    it('creates database migration with essential RPCs preserving workers and enforcing single active quality', () => {
        expect(existsSync(join(process.cwd(), migrationPath))).toBe(true)
        const migration = read(migrationPath)

        // Verifies activation RPC
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.activate_saved_costing_for_production')
        expect(migration).toContain('base_production_jobs')
        expect(migration).toContain("status IN ('planned', 'active')")
        expect(migration).toContain("'active',")

        // Verifies deactivation RPC
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.deactivate_quality_production')
        expect(migration).toContain("status = 'completed'")
        // Must close machine contexts but NOT delete worker assignments
        expect(migration).toContain('UPDATE public.base_machine_job_contexts')
        expect(migration).not.toMatch(/DELETE FROM public\.base_worker_machine_assignments[\s\S]*deactivate_quality_production/)

        // Verifies atomic quality switch RPC
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.switch_base_machine_quality')
        expect(migration).toContain('set_base_machine_job_context')

        // Verifies bulk loom assignment RPC
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.bulk_assign_machines_to_quality')

        // Verifies updated set_base_machine_job_context does NOT delete worker assignments when job is cleared
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.set_base_machine_job_context')
        expect(migration).not.toMatch(/DELETE FROM public\.base_worker_machine_assignments\s+WHERE machine_id = p_machine_id;/)
    })

    it('exports all simplified workflow server actions in production actions.ts', () => {
        const actions = read(actionsPath)

        expect(actions).toContain('export async function activateSavedCostingForProduction(')
        expect(actions).toContain("supabase.rpc('activate_saved_costing_for_production'")

        expect(actions).toContain('export async function deactivateQualityProduction(')
        expect(actions).toContain("supabase.rpc('deactivate_quality_production'")

        expect(actions).toContain('export async function switchBaseMachineQuality(')
        expect(actions).toContain("supabase.rpc('switch_base_machine_quality'")

        expect(actions).toContain('export async function bulkAssignMachinesToQuality(')
        expect(actions).toContain("supabase.rpc('bulk_assign_machines_to_quality'")
    })

    it('renders the BaseActiveQualities component with activation, loom assignment, and deactivation controls', () => {
        expect(existsSync(join(process.cwd(), activeQualitiesPath))).toBe(true)
        const component = read(activeQualitiesPath)

        expect(component).toContain('Active Qualities')
        expect(component).toContain('Activate Quality')
        expect(component).toContain('Assign Looms')
        expect(component).toContain('Deactivate Quality')
        expect(component).toContain('activateSavedCostingForProduction')
        expect(component).toContain('bulkAssignMachinesToQuality')
        expect(component).toContain('This quality is currently running on')
        expect(component).toContain('0 Looms assigned')
    })

    it('puts a loom\'s quality in a dialog opened from its machine card in Machine Assignments, not on a Production board', () => {
        // The Production overview no longer carries a per-loom board.
        expect(existsSync(join(process.cwd(), machineBoardPath))).toBe(false)

        expect(existsSync(join(process.cwd(), qualityDialogPath))).toBe(true)
        const dialog = read(qualityDialogPath)
        // A loom with a quality is switched, one without gets its first quality; both read the active qualities.
        expect(dialog).toContain('switchBaseMachineQuality')
        expect(dialog).toContain('setBaseMachineJobContext')
        expect(dialog).toContain('currentJobId ?')
        expect(dialog).toContain('type="radio"')

        const workspace = read(assignmentWorkspacePath)
        expect(workspace).toContain("import MachineQualityDialog from './MachineQualityDialog'")
        expect(workspace).toContain('<MachineQualityDialog')
        expect(workspace).toContain('onClick={() => openQualityDialog(machine)}')
        // Only qualities that are planned or running can be chosen.
        expect(workspace).toContain('jobs={activeJobs}')
        // The same card renders on the desktop board and the phone machine list.
        expect(workspace.match(/renderMachineIdentity\(machine\)/g)).toHaveLength(2)
    })

    it('embeds BaseActiveQualities in BaseProductionClient with 4 KPI summary cards', () => {
        const client = read(clientPath)

        // KPI cards
        expect(client).toContain('Active Qualities')
        expect(client).toContain('Machines Running')
        expect(client).toContain('Looms Available')
        expect(client).toContain('Workers Assigned')

        // Separate route content and components
        expect(client).toContain('<BaseActiveQualities')
        expect(client).not.toContain('BaseMachineBoard')
        expect(client).not.toContain("<TabsList")
        expect(client).toContain("/daily-sheet")

        // No residual manual job creation form
        expect(client).not.toContain('New production job')
        expect(client).not.toContain('base-job-costing')
        expect(client).not.toContain('base-job-target')
    })

    it('updates Saved Costings page to feature Activate for Production CTA', () => {
        const quotesClient = read(quotesClientPath)

        expect(quotesClient).toContain('Activate for Production')
        expect(quotesClient).toContain('/owner/production?tab=jobs&costingId=')
    })
})
