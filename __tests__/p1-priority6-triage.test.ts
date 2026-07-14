import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 priority 6 triage', () => {
    it('persists zero-meter supervisor reasons with production rows', () => {
        const actions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
        const dashboard = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
        const migration = readProjectFile('supabase/migrations/20260514112000_persist_zero_meter_reason.sql')

        expect(actions).toContain('zero_meter_reason')
        expect(actions).toContain("e.meters > 0 || Boolean(e.zero_meter_reason?.trim())")
        expect(dashboard).toContain("ZERO_METER_REASON_LABELS")
        expect(migration).toContain('ADD COLUMN IF NOT EXISTS zero_meter_reason TEXT')
    })

    it('shows pending advances before a worker is selected', () => {
        const client = readProjectFile('app/(dashboard)/owner/advances/AdvancesClient.tsx')
        expect(client).toContain("queryKey: ['all_pending_advances'")
        expect(client).toContain('Pending Upaad')
    })
})
