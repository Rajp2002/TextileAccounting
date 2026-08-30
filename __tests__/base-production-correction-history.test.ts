import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Base production correction history', () => {
    const migration = read('supabase/migrations/20260901110000_base_production_correction_history.sql')
    const actions = read('app/(dashboard)/owner/production/actions.ts')
    const loader = read('app/(dashboard)/owner/production/loaders.ts')
    const sheet = read('app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx')

    it('records the production write and immutable correction receipt atomically', () => {
        expect(migration).toContain('CREATE TABLE public.base_production_batch_revisions')
        expect(migration).toContain('before_snapshot jsonb')
        expect(migration).toContain('after_snapshot jsonb NOT NULL')
        expect(migration).toContain('public.save_base_daily_production_with_reason')
        expect(migration).toContain('v_result := public.save_base_daily_production(')
        expect(migration).toContain("'revision_number', v_revision_number")
        expect(migration).toContain('UNIQUE (batch_id, revision_number)')
    })

    it('requires an explanation for corrections and preserves idempotent retries', () => {
        expect(migration).toContain('Explain why this saved production sheet is being corrected')
        expect(migration).toContain("IF COALESCE((v_result ->> 'idempotent')::boolean, false) THEN")
        expect(migration).toContain("change_kind IN ('created', 'corrected')")
        expect(actions).toContain('BaseCorrectionReasonSchema')
        expect(actions).toContain('p_correction_reason: correctionReason?.data ?? null')
    })

    it('keeps the legacy writer internal and exposes only tenant-scoped receipts', () => {
        expect(migration).toContain('ALTER TABLE public.base_production_batch_revisions ENABLE ROW LEVEL SECURITY')
        expect(migration).toContain('base_production_batch_revisions_owner_read')
        expect(migration).toContain('private.base_production_core_access(org_id)')
        expect(migration).toContain('require_base_production_correction_reason')
        expect(migration).toContain("current_setting('app.base_correction_reason', true)")
        expect(migration).toContain("set_config('app.base_correction_reason'")
        expect(migration).toContain('Cascading workspace/batch deletion is not a production correction')
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.save_base_daily_production_with_reason')
        expect(migration).toContain('REVOKE ALL ON FUNCTION private.base_production_batch_snapshot')
    })

    it('shows the reason, before/after totals, and permanent receipt in the owner UI', () => {
        expect(loader).toContain("from('base_production_batch_revisions')")
        expect(sheet).toContain('Reason for correction')
        expect(sheet).toContain('This explanation stays with the production record.')
        expect(sheet).toContain('Production audit trail')
        expect(sheet).toContain('Corrections never overwrite their explanation.')
        expect(sheet).toContain('beforeMeters')
        expect(sheet).toContain('afterMeters')
    })
})
