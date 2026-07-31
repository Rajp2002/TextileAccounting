import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Base rate-book production boundaries', () => {
    it('uses an optimistic version token for edited rates', () => {
        const actions = read('app/(dashboard)/owner/rates/actions.ts')
        const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')
        const migration = read('supabase/migrations/20260731123000_version_base_rate_updates.sql')

        expect(actions).toContain('expectedUpdatedAt?: string')
        expect(actions).toContain("supabase.rpc('save_cost_rate_atomic_versioned'")
        expect(actions).toContain('p_expected_updated_at: input.expectedUpdatedAt ?? null')
        expect(client).toContain('expectedUpdatedAt: rate.updated_at')
        expect(migration).toContain('FOR UPDATE')
        expect(migration).toContain('v_existing.updated_at IS DISTINCT FROM p_expected_updated_at')
        expect(migration).toContain('This rate changed in another tab or was archived.')
    })

    it('keeps duplicate and stale rate-save errors visible in the form', () => {
        const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')

        expect(client).toContain('const [saveError, setSaveError]')
        expect(client).toContain("setSaveError(result.error ?? 'Rate could not be saved.')")
        expect(client).toContain('id="cost-rate-save-error" role="alert"')
        expect(client).toContain('aria-describedby={saveError ? \'cost-rate-save-error\' : undefined}')
    })
})
