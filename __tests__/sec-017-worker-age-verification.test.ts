import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

describe('SEC-017 durable worker age verification', () => {
    const migration = read('supabase/migrations/20260711172126_worker_age_verification_provenance.sql')
    const dialog = read('components/AddWorkerDialog.tsx')
    const onboarding = read('app/(auth)/onboarding/checklist.tsx')
    const actions = read('app/(dashboard)/supervisor/actions.ts')
    const ownerActions = read('app/(dashboard)/owner/actions.ts')
    const fixedWorkerPage = read('app/(dashboard)/owner/fixed-workers/page.tsx')

    it('requires durable provenance on every new meter and fixed worker row', () => {
        expect(migration).toContain('date_of_birth DATE')
        expect(migration).toContain('age_verification_method public.worker_age_verification_method')
        expect(migration).toContain('age_verification_reference TEXT')
        expect(migration).toContain('age_verified_at TIMESTAMPTZ')
        expect(migration).toContain('age_verified_by UUID REFERENCES auth.users(id)')
        expect(migration).toContain('BEFORE INSERT OR UPDATE OF date_of_birth')
        expect(migration).toContain('ON public.workers')
        expect(migration).toContain('ON public.fixed_workers')
    })

    it('rejects under-18 and incomplete evidence at the database boundary', () => {
        expect(migration).toContain("NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date")
        expect(migration).toContain("RAISE EXCEPTION 'worker must be at least 18 years old'")
        expect(migration).toContain('length(btrim(NEW.age_verification_reference)) < 4')
        expect(migration).toContain('NEW.age_verified_by IS NULL')
    })

    it('collects verified DOB and a non-sensitive evidence reference in both creation surfaces', () => {
        expect(dialog).toContain('Verified date of birth')
        expect(dialog).toContain('Do not enter a full Aadhaar or government ID number.')
        expect(dialog).not.toContain('I confirm this worker is 18 years of age or older')
        expect(onboarding).not.toContain('addMeterWorkersBulk')
        expect(onboarding).toContain('workers, and payroll can be added later from the workflow that needs them.')
        expect(fixedWorkerPage).toContain('fixed-worker-date-of-birth')
        expect(fixedWorkerPage).toContain('fixed-worker-age-reference')
    })

    it('persists verifier identity and timestamp atomically with worker insertion', () => {
        expect(actions).toContain('age_verified_at: new Date().toISOString()')
        expect(actions).toContain('age_verified_by: user.id')
        expect(actions).toContain('age_verification_reference: data.age_verification_reference.trim()')
        expect(ownerActions).toContain('updatePayload.age_verified_by = user.id')
        expect(ownerActions).toContain('updatePayload.age_verification_reference = data.age_verification_reference.trim()')
    })
})
