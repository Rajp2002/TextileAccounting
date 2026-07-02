import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('PAY-006: attendance RLS/date/access-code boundary', () => {
    const pageCode = readProjectFile('app/(dashboard)/supervisor/attendance/page.tsx')
    const actionsCode = readProjectFile('app/(dashboard)/supervisor/actions.ts')

    // Find the migration file dynamically under supabase/migrations/
    const migrationDir = join(root, 'supabase/migrations')
    const migrationFiles = readdirSync(migrationDir)
    const targetMigrationFile = migrationFiles.find((f: string) => f.includes('harden_attendance_rls_date_bounds'))

    it('finds migration file', () => {
        expect(targetMigrationFile).toBeDefined()
    })

    if (targetMigrationFile) {
        const migrationContent = readFileSync(join(migrationDir, targetMigrationFile), 'utf8')

        it('migration drops old permissive attendance policies', () => {
            expect(migrationContent).toContain('DROP POLICY IF EXISTS "Supervisor/Owner Insert Attendance" ON public.attendance;')
            expect(migrationContent).toContain('DROP POLICY IF EXISTS "Supervisor/Owner Update Attendance" ON public.attendance;')
            expect(migrationContent).toContain('DROP POLICY IF EXISTS "Owner Insert Attendance Any Date" ON public.attendance;')
            expect(migrationContent).toContain('DROP POLICY IF EXISTS "Owner Update Attendance" ON public.attendance;')
        })

        it('migration enforces supervisor direct writes only for today (Surat timezone)', () => {
            // INSERT policy has WITH CHECK
            expect(migrationContent).toContain('CREATE POLICY "Supervisor Insert Attendance Today" ON public.attendance')
            expect(migrationContent).toContain('date = (now() AT TIME ZONE \'Asia/Kolkata\')::date')
            expect(migrationContent).toMatch(/CREATE POLICY "Supervisor Insert Attendance Today"[\s\S]*?WITH CHECK/i)

            // UPDATE policy has USING and WITH CHECK
            expect(migrationContent).toContain('CREATE POLICY "Supervisor Update Attendance Today" ON public.attendance')
            const updateSupervisorPolicy = migrationContent.slice(migrationContent.indexOf('CREATE POLICY "Supervisor Update Attendance Today"'))
            expect(updateSupervisorPolicy).toContain('USING (')
            expect(updateSupervisorPolicy).toContain('WITH CHECK (')
            expect(updateSupervisorPolicy).toContain("(auth.jwt() ->> 'user_role') = 'supervisor'")
            expect(updateSupervisorPolicy).toContain("org_id = (auth.jwt() ->> 'org_id')::uuid")
            expect(updateSupervisorPolicy).toContain("date = (now() AT TIME ZONE 'Asia/Kolkata')::date")
        })

        it('migration enforces owner direct writes only for today or past', () => {
            // INSERT policy has WITH CHECK
            expect(migrationContent).toContain('CREATE POLICY "Owner Insert Attendance Past/Today" ON public.attendance')
            expect(migrationContent).toContain('date <= (now() AT TIME ZONE \'Asia/Kolkata\')::date')
            expect(migrationContent).toMatch(/CREATE POLICY "Owner Insert Attendance Past\/Today"[\s\S]*?WITH CHECK/i)

            // UPDATE policy has USING and WITH CHECK
            expect(migrationContent).toContain('CREATE POLICY "Owner Update Attendance Past/Today" ON public.attendance')
            const updateOwnerPolicy = migrationContent.slice(migrationContent.indexOf('CREATE POLICY "Owner Update Attendance Past/Today"'))
            expect(updateOwnerPolicy).toContain('USING (')
            expect(updateOwnerPolicy).toContain('WITH CHECK (')
            expect(updateOwnerPolicy).toContain("(auth.jwt() ->> 'user_role') = 'owner'")
            expect(updateOwnerPolicy).toContain("org_id = (auth.jwt() ->> 'org_id')::uuid")
            expect(updateOwnerPolicy).toContain("date <= (now() AT TIME ZONE 'Asia/Kolkata')::date")
        })

        it('migration blocks direct future writes for both roles at RLS layer', () => {
            // Asserting date boundaries block future dates (> today is blocked since checks are = today or <= today)
            expect(migrationContent).not.toContain('date >= (now() AT TIME ZONE')
        })

        it('migration preserves org/tenant and role checks', () => {
            expect(migrationContent).toContain("org_id = (auth.jwt() ->> 'org_id')::uuid")
            expect(migrationContent).toContain("(auth.jwt() ->> 'user_role') = 'supervisor'")
            expect(migrationContent).toContain("(auth.jwt() ->> 'user_role') = 'owner'")
        })

        it('migration is forward-only and non-destructive', () => {
            expect(migrationContent).not.toContain('DROP TABLE')
            expect(migrationContent).not.toContain('TRUNCATE')
            expect(migrationContent).not.toContain('DELETE FROM')
        })
    }

    it('supervisor page locks direct client-side past edits and does not verify immediately', () => {
        // The page should not import verifyAccessCode
        expect(pageCode).not.toContain('verifyAccessCode')
        expect(pageCode).not.toContain('handleUnlockSubmit')

        // prepareSaveFlow must trigger dialog for past dates
        expect(pageCode).toContain('if (isPastDate && userProfile?.role === \'supervisor\') {')
        expect(pageCode).toContain('setVerificationOpen(true)')
    })

    it('supervisor page saves past dates via savePastAttendance server action with code', () => {
        expect(pageCode).toContain('savePastAttendance(selectedDate, recordsToSave, codeToUse)')
        expect(pageCode).toContain('executeSave(accessCode)')
    })

    it('server actions validate and consume access codes server-side', () => {
        expect(actionsCode).toContain('export async function savePastAttendance')
        expect(actionsCode).toContain('validateAndConsumeAccessCode(user.id, orgId, parsed.data.accessCode)')
    })

    it('same-day normal path remains intact for direct client upsert', () => {
        expect(pageCode).toContain('executeSave()')
        expect(pageCode).toContain(".from('attendance')")
        expect(pageCode).toContain('.upsert({')
        expect(pageCode).toContain('date: selectedDate')
    })
})
