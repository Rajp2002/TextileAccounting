import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = fs.readFileSync(
    path.join(
        process.cwd(),
        'supabase/migrations/20260710211355_repair_shift_log_safe_update_guard.sql'
    ),
    'utf8'
)

describe('production shift-log safe-update repair', () => {
    it('replaces the deployed RPC through a forward migration', () => {
        expect(migration).toContain(
            'CREATE OR REPLACE FUNCTION public.replace_shift_production_logs('
        )
        expect(migration).toContain('SECURITY DEFINER')
        expect(migration).toContain('SET search_path = public')
    })

    it('qualifies the intentional whole-temp-table normalization update', () => {
        const normalization = migration.slice(
            migration.indexOf('UPDATE weavly_shift_logs'),
            migration.indexOf('SELECT MIN(date), MIN(shift)')
        )

        expect(normalization).toContain("machine_type_snapshot = COALESCE(machine_type_snapshot, 'other')")
        expect(normalization).toMatch(/WHERE TRUE\s*;/i)
        expect(normalization).not.toMatch(/machine_type_snapshot = COALESCE\([^;]+\);\s*$/i)
    })

    it('preserves tenant, role, lock, date/shift, duplicate, and order-boundary guards', () => {
        expect(migration).toContain("v_org_id := NULLIF(auth.jwt() ->> 'org_id', '')::uuid")
        expect(migration).toContain('PERFORM public.assert_org_not_locked(v_org_id)')
        expect(migration).toContain("v_role NOT IN ('owner', 'supervisor')")
        expect(migration).toContain('All production logs in one submission must share date and shift.')
        expect(migration).toContain('Duplicate machine entries in one production submission.')
        expect(migration).toContain(
            'Production can only be logged for the active order currently assigned to this loom.'
        )
        expect(migration).toContain('Production logs for non-active orders cannot be replaced.')
    })

    it('preserves advisory locking and generated-stock reconciliation', () => {
        expect(migration).toContain('pg_advisory_xact_lock')
        expect(migration).toContain('reconcile_generated_stock_for_production_grain')
        expect(migration).toContain('RETURN QUERY SELECT v_inserted_count, v_replaced_count')
    })
})
