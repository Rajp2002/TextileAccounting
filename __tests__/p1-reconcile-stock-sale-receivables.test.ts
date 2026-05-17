import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationPath = 'supabase/migrations/20260518123000_reconcile_stock_sale_receivable_parties.sql'

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function normalizedSql(sql: string) {
    return sql.replace(/\s+/g, ' ')
}

describe('P1 stock-sale receivable party reconciliation migration', () => {
    it('adds the forward-only migration file', () => {
        expect(existsSync(join(root, migrationPath))).toBe(true)
    })

    it('updates only fabric_stock_sale receivables that need party or credit reconciliation', () => {
        const migration = readProjectFile(migrationPath)

        expect(migration).toContain('UPDATE commercial_receivables cr')
        expect(migration).toContain('JOIN fabric_stock_sales fss')
        expect(migration).toContain("cr.source_type = 'fabric_stock_sale'")
        expect(migration).toContain('fss.id = cr.source_id')
        expect(migration).toContain('fss.org_id = cr.org_id')
        expect(migration).toContain("cr.party_name = 'Anonymous'")
        expect(migration).toContain('cr.due_date IS NULL')
        expect(migration).toContain('cr.credit_days IS NULL')
    })

    it('uses fabric_stock_sales.party_name first and falls back to linked order party names', () => {
        const migration = normalizedSql(readProjectFile(migrationPath))

        const stockSalePartyIndex = migration.indexOf("NULLIF(NULLIF(BTRIM(fss.party_name), ''), 'Anonymous')")
        const lotOrderPartyIndex = migration.indexOf("NULLIF(NULLIF(BTRIM(lot_order.party_name), ''), 'Anonymous')")
        const receivableOrderPartyIndex = migration.indexOf("NULLIF(NULLIF(BTRIM(receivable_order.party_name), ''), 'Anonymous')")
        const existingPartyIndex = migration.indexOf("NULLIF(NULLIF(BTRIM(cr.party_name), ''), 'Anonymous')")

        expect(stockSalePartyIndex).toBeGreaterThan(-1)
        expect(lotOrderPartyIndex).toBeGreaterThan(stockSalePartyIndex)
        expect(receivableOrderPartyIndex).toBeGreaterThan(lotOrderPartyIndex)
        expect(existingPartyIndex).toBeGreaterThan(receivableOrderPartyIndex)
        expect(migration).toContain('LEFT JOIN fabric_stock_lots fsl')
        expect(migration).toContain('LEFT JOIN orders lot_order')
        expect(migration).toContain('LEFT JOIN orders receivable_order')
    })

    it('reconciles missing credit fields without touching commercial amounts or payment state', () => {
        const migration = readProjectFile(migrationPath)

        expect(migration).toContain('credit_days = rr.reconciled_credit_days')
        expect(migration).toContain('due_date = rr.reconciled_due_date')
        expect(migration).toContain('updated_at = NOW()')
        expect(migration).not.toMatch(/\btotal_amount\s*=/)
        expect(migration).not.toMatch(/\breceived_amount\s*=/)
        expect(migration).not.toMatch(/\bbalance_amount\s*=/)
        expect(migration).not.toMatch(/\bpayment_status\s*=/)
    })

    it('does not reference owner ledger routes or ledger/accounting tables', () => {
        const migration = readProjectFile(migrationPath)

        expect(migration).not.toContain('/owner/ledger')
        expect(migration).not.toMatch(/\bledger\b/i)
        expect(migration).not.toMatch(/\baccounting\b/i)
        expect(migration).not.toContain('commercial_payment_receipts')
        expect(migration).not.toContain('dispatches')
    })
})
