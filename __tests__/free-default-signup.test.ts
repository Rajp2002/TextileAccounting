import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Free is the default plan for new accounts', () => {
    it('turns Free signup and calculation on, and keeps them on for fresh databases', () => {
        const name = readdirSync(join(root, 'supabase/migrations')).find((file) => file.endsWith('_free_enrollment_default_on.sql'))
        expect(name).toBeTruthy()
        const migration = read(`supabase/migrations/${name}`)
        expect(migration).toContain('ALTER COLUMN enrollment_enabled SET DEFAULT true')
        expect(migration).toContain('ALTER COLUMN estimation_enabled SET DEFAULT true')
        expect(migration).toMatch(/SET enrollment_enabled = true,\s*estimation_enabled = true\s*WHERE singleton/)
    })

    it('signs up on Free unless Lite or Base was chosen explicitly', () => {
        const signup = read('app/(auth)/signup/page.tsx')
        expect(signup).toContain("requestedPlan === 'lite' ? 'lite' as const : requestedPlan === 'base' ? 'base' as const : 'free' as const")
    })

    it('still enforces the server-side enrollment switch at signup and in the plan chooser', () => {
        expect(read('app/(auth)/actions/auth.ts')).toContain('await canEnrollFree(parsed.data.email)')
        expect(read('app/(auth)/onboarding/plans/actions.ts')).toContain('await canEnrollFree(user.email)')
    })
})
