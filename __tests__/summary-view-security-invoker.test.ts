import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    'supabase/migrations/20260715113013_harden_summary_views_security_invoker.sql',
    'utf8',
)

const protectedViews = [
    'order_progress_summary',
    'party_ledger_entries',
    'yarn_lot_stock_summary',
    'order_yarn_variance_summary',
    'market_run_summary',
    'order_dispatch_summary',
]

describe('summary view tenant isolation', () => {
    it.each(protectedViews)('uses invoker security for %s', (view) => {
        expect(migration).toContain(`ALTER VIEW public.${view}`)
        expect(migration).toMatch(
            new RegExp(`ALTER VIEW public\\.${view}\\s+SET \\(security_invoker = true\\);`),
        )
    })

    it('documents a metadata-only rollback for every protected view', () => {
        for (const view of protectedViews) {
            expect(migration).toContain(
                `ALTER VIEW public.${view} RESET (security_invoker);`,
            )
        }
    })
})
