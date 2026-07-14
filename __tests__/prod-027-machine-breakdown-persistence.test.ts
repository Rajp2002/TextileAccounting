import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const actions = readFileSync(
    join(process.cwd(), 'app/(dashboard)/supervisor/actions.ts'),
    'utf8'
)
const dashboard = readFileSync(
    join(process.cwd(), 'app/(dashboard)/supervisor/dashboard/page.tsx'),
    'utf8'
)

describe('PROD-027 machine breakdown persistence', () => {
    it('does not report success from a zero-row update when no dated assignment exists', () => {
        const start = actions.indexOf('export async function updateMachineBreakdown')
        const end = actions.indexOf('\n/**', start)
        const implementation = actions.slice(start, end)

        expect(implementation).toContain(".from('shift_assignments')")
        expect(implementation).toContain(".maybeSingle()")
        expect(implementation).toContain(".insert({")
        expect(implementation).toContain("inserted.error?.code === '23505'")
        expect(implementation).toContain(".select('id')")
        expect(implementation).toContain("if (updated.error || !updated.data)")
        expect(implementation).toContain("if (racedUpdate.error || !racedUpdate.data)")
        expect(implementation).not.toContain(".update({\n            breakdown_category: params.category")
    })

    it('keeps breakdown writes tenant-scoped and validates the dated grain', () => {
        const start = actions.indexOf('export async function updateMachineBreakdown')
        const end = actions.indexOf('\n/**', start)
        const implementation = actions.slice(start, end)

        expect(implementation).toContain('org_id: profile.org_id')
        expect(implementation).toContain('machine_id: machineParsed.data')
        expect(implementation).toContain('date: params.date')
        expect(implementation).toContain('shift: shiftParsed.data')
        expect(implementation).toContain("safeParse(ShiftSchema, params.shift)")
        expect(implementation).toContain("!/^\\d{4}-\\d{2}-\\d{2}$/.test(params.date)")
        expect(implementation).toContain("!['warp', 'mech', 'elec'].includes(category)")
        expect(implementation).toContain('notes.length > 500')
    })

    it('gives the loom detail sheet an accessible title', () => {
        expect(dashboard).toContain('SheetTitle,')
        expect(dashboard).toContain('<SheetTitle className="text-2xl font-semibold text-ink">')
        expect(dashboard).toContain('{formatLoomName(machine.name)}')
    })

    it('keeps Copy previous reachable when placeholder assignment rows have no worker', () => {
        expect(dashboard).toContain('const hasShiftSetup = assignedCount > 0')
        expect(dashboard).not.toContain('const hasShiftSetup = assignments.length > 0')
    })
})
