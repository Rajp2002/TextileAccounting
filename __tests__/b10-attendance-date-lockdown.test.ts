import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260714005500_b10_enforce_attendance_date_lockdown.sql'),
    'utf8'
)

describe('B10 attendance date and lockdown boundary', () => {
    it('removes the broad permissive policies that bypass date checks', () => {
        expect(migration).toContain('DROP POLICY IF EXISTS "attendance_insert_when_unlocked"')
        expect(migration).toContain('DROP POLICY IF EXISTS "attendance_update_when_unlocked"')
    })

    it('limits supervisors to the current India date', () => {
        const supervisorInsert = migration.slice(
            migration.indexOf('CREATE POLICY "Supervisor Insert Attendance Today"'),
            migration.indexOf('CREATE POLICY "Supervisor Update Attendance Today"')
        )
        expect(supervisorInsert).toContain("(auth.jwt() ->> 'user_role') = 'supervisor'")
        expect(supervisorInsert).toContain("date = (now() AT TIME ZONE 'Asia/Kolkata')::date")
        expect(supervisorInsert).toContain('NOT public.check_org_lockdown(org_id)')
    })

    it('allows owners only past or current India dates and preserves tenant lockdown', () => {
        const ownerPolicies = migration.slice(
            migration.indexOf('CREATE POLICY "Owner Insert Attendance Past/Today"')
        )
        expect(ownerPolicies).toContain("(auth.jwt() ->> 'user_role') = 'owner'")
        expect(ownerPolicies).toContain("date <= (now() AT TIME ZONE 'Asia/Kolkata')::date")
        expect(ownerPolicies).toContain("org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid")
        expect(ownerPolicies.match(/NOT public\.check_org_lockdown\(org_id\)/g)).toHaveLength(3)
    })

    it('is forward-only and does not mutate attendance data', () => {
        expect(migration).not.toMatch(/\b(?:DELETE|UPDATE|INSERT)\s+(?:FROM|INTO)?\s*public\.attendance\b/i)
        expect(migration).not.toMatch(/\b(?:TRUNCATE|DROP TABLE)\b/i)
    })

    it('exposes bounded, accessible attendance-day navigation', () => {
        const page = readFileSync(
            join(process.cwd(), 'app/(dashboard)/supervisor/attendance/page.tsx'),
            'utf8'
        )
        expect(page).toContain('aria-label="Previous attendance day"')
        expect(page).toContain('aria-label="Attendance date"')
        expect(page).toContain('aria-label="Next attendance day"')
        expect(page).toContain('disabled={selectedDate >= getSuratTodayString()}')
    })
})
