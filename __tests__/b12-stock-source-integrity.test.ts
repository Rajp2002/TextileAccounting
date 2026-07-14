import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migration = readFileSync(
    join(root, 'supabase/migrations/20260714033000_b12_enforce_stock_source_integrity.sql'),
    'utf8'
)
const summaryMigration = readFileSync(
    join(root, 'supabase/migrations/20260714034500_b12_include_stock_sales_in_market_summary.sql'),
    'utf8'
)

describe('B12 stock source integrity boundary', () => {
    it('rejects cross-tenant and mismatched market-run references', () => {
        expect(migration).toContain('Invalid market run reference for this organization')
        expect(migration).toContain('Market run stock order does not match its market run')
        expect(migration).toContain('Market run stock quote does not match its source')
        expect(migration).toMatch(/FROM public\.market_runs[\s\S]*org_id = NEW\.org_id/)
        expect(migration).toMatch(/FROM public\.orders[\s\S]*org_id = NEW\.org_id/)
        expect(migration).toMatch(/FROM public\.estimator_quotes[\s\S]*org_id = NEW\.org_id/)
    })

    it('rejects mismatched order and quote references', () => {
        expect(migration).toContain('Order stock cannot reference a market run')
        expect(migration).toContain('Invalid order reference for this organization')
        expect(migration).toContain('Mismatched quote and order')
        expect(migration).toContain('Market run backing orders must be recorded as market run stock')
    })

    it('keeps manual sources free of relational references', () => {
        expect(migration).toContain('Manual or opening stock cannot carry order or market run references')
    })

    it('does not revalidate source identity during ordinary quantity updates', () => {
        expect(migration).toContain("IF TG_OP = 'UPDATE'")
        expect(migration).toContain('IS NOT DISTINCT FROM')
        expect(migration).toMatch(/BEFORE INSERT OR UPDATE OF org_id, source_type, market_run_id, order_id, quote_id/)
    })

    it('counts both legacy and stock-lot sales in market summaries', () => {
        expect(summaryMigration).toContain('FROM public.market_run_sales')
        expect(summaryMigration).toContain('FROM public.fabric_stock_sales')
        expect(summaryMigration).toMatch(/FROM public\.fabric_stock_sales fs[\s\S]*JOIN public\.fabric_stock_lots fl[\s\S]*AS sales_count/)
    })
})
