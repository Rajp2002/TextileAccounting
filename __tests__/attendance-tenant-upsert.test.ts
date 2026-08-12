import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

const actions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
const attendancePage = readProjectFile('app/(dashboard)/supervisor/attendance/page.tsx')
const migration = readProjectFile(
    'supabase/migrations/20260812134658_harden_attendance_tenant_scope.sql'
)

describe('P1 attendance tenant boundary', () => {
    it('validates every submitted worker against the authenticated organization', () => {
        expect(actions).toContain(
            'const fixedWorkerIds = [...new Set(parsed.data.records.map(record => record.fixed_worker_id))]'
        )
        expect(actions).toContain(".from('fixed_workers')")
        expect(actions).toContain(".select('id')")
        expect(actions).toContain('.eq(\'org_id\', orgId)')
        expect(actions).toContain('.in(\'id\', fixedWorkerIds)')
        expect(actions).toContain(
            "if ((ownedFixedWorkers?.length ?? 0) !== fixedWorkerIds.length)"
        )
        expect(actions).toContain("onConflict: 'org_id,fixed_worker_id,date'")
        expect(actions).not.toContain("onConflict: 'fixed_worker_id,date'")
    })

    it('uses the tenant-scoped conflict target for direct browser writes', () => {
        expect(attendancePage).toContain("org_id: userProfile.org_id")
        expect(attendancePage).toContain("onConflict: 'org_id,fixed_worker_id,date'")
        expect(attendancePage).not.toContain("onConflict: 'fixed_worker_id,date'")
    })

    it('replaces the globally keyed attendance constraint', () => {
        expect(migration).toContain(
            'DROP CONSTRAINT IF EXISTS attendance_fixed_worker_id_date_key;'
        )
        expect(migration).toContain(
            'ADD CONSTRAINT attendance_org_id_fixed_worker_id_date_key'
        )
        expect(migration).toContain('UNIQUE (org_id, fixed_worker_id, date);')
    })

    it('checks fixed-worker ownership in every authenticated attendance write policy', () => {
        expect(migration.match(/fixed_worker_id IN \(/g)).toHaveLength(6)
        expect(migration.match(/SELECT p\.org_id FROM public\.profiles AS p/g)).toHaveLength(6)

        for (const policy of [
            'Supervisor Insert Attendance Today',
            'Supervisor Update Attendance Today',
            'Owner Insert Attendance Past/Today',
            'Owner Update Attendance Past/Today',
        ]) {
            const policyStart = migration.indexOf(`CREATE POLICY "${policy}"`)
            expect(policyStart).toBeGreaterThanOrEqual(0)
            const nextPolicy = migration.indexOf('CREATE POLICY "', policyStart + 1)
            const policyBlock = migration.slice(
                policyStart,
                nextPolicy === -1 ? undefined : nextPolicy
            )
            expect(policyBlock).toContain('fixed_worker_id IN (')
        }

        expect(migration).toContain("org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid")
        expect(migration).toContain("(SELECT p.org_id FROM public.profiles AS p WHERE p.id = auth.uid())")
    })
})
