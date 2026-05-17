import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 dispatch discrepancy nudges', () => {
    it('adds explicit receipt fields and receipt status values to dispatches', () => {
        const migration = readProjectFile('supabase/migrations/20260518110000_dispatch_receipt_discrepancy_nudges.sql')
        expect(migration).toContain('ADD COLUMN IF NOT EXISTS received_meters')
        expect(migration).toContain('ADD COLUMN IF NOT EXISTS received_note')
        expect(migration).toContain("DEFAULT 'not_confirmed'")
        expect(migration).toContain("'not_confirmed','matched','difference_reported'")
    })

    it('confirms a matched full dispatch without creating a discrepancy', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        expect(action).toContain('export async function confirmDispatchReceived')
        expect(action).toContain("const receiptStatus = hasDifference ? 'difference_reported' : 'matched'")
        expect(action).toContain('if (hasDifference)')
        expect(action).toContain("source_reference: 'dispatch_receipt'")
        expect(action).toContain("status: 'reviewed'")
    })

    it('creates shortage and excess discrepancies from receipt differences only', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        expect(action).toContain('receivedMeters - sentMeters')
        expect(action).toContain("discrepancy_type: differenceMeters < 0 ? 'shortage' : 'excess'")
        expect(action).toContain('actual_received_meters: receivedMeters')
        expect(action).toContain('expected_meters: sentMeters')
        expect(action).toContain('payment received, or claim/deduction settlement')
        expect(action).not.toContain('pending_dispatch_meters - receivedMeters')
    })

    it('keeps partial dispatch out of discrepancy creation', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const confirmAction = action.split('export async function confirmDispatchReceived')[1].split('export async function markDiscrepancyReviewed')[0]
        expect(confirmAction).toContain('qty_meters_sent')
        expect(confirmAction).not.toContain('meters_sold')
        expect(confirmAction).not.toContain('pending_dispatch_meters')
    })

    it('shows receipt status and difference warnings in Dispatches', () => {
        const client = readProjectFile('app/(dashboard)/owner/dispatches/DispatchesClient.tsx')
        expect(client).toContain('confirmDispatchReceived')
        expect(client).toContain('Not confirmed')
        expect(client).toContain('Matched')
        expect(client).toContain('Difference reported')
        expect(client).toContain('Received date')
        expect(client).toContain('received_meters')
    })

    it('shows receipt difference warnings in Commercials without changing balances', () => {
        const actions = readProjectFile('app/(dashboard)/owner/commercials/actions.ts')
        const client = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        expect(actions).toContain('receipt_difference_meters')
        expect(actions).toContain('receipt_status')
        expect(client).toContain('Receipt difference reported:')
        expect(client).toContain('getReceiptDifferenceWarning')
        expect(actions).not.toContain('total_amount =')
        expect(actions).not.toContain('received_amount =')
    })

    it('shows unresolved receipt differences on Owner Today and allows marking reviewed', () => {
        const actions = readProjectFile('app/(dashboard)/owner/today/actions.ts')
        const card = readProjectFile('components/factory-today/PendingReceiptsCard.tsx')
        const todayClient = readProjectFile('app/(dashboard)/owner/today/FactoryTodayClient.tsx')
        expect(actions).toContain('receiptDifferences')
        expect(actions).toContain("source_reference', 'dispatch_receipt'")
        expect(actions).toContain('party_name, orders(party_name, tracking_token)')
        expect(actions).not.toContain('orders!inner(party_name, tracking_token)')
        expect(card).toContain('reported {Math.abs(d.differenceMeters)')
        expect(card).toContain('markDiscrepancyReviewed')
        expect(todayClient).toContain('receiptDifferences.length === 0')
    })

    it('supports reviewed status and hides reviewed differences from nudges', () => {
        const migration = readProjectFile('supabase/migrations/20260518110000_dispatch_receipt_discrepancy_nudges.sql')
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const today = readProjectFile('app/(dashboard)/owner/today/actions.ts')
        expect(migration).toContain("'needs_review','reviewed','resolved','written_off'")
        expect(action).toContain('export async function markDiscrepancyReviewed')
        expect(today).toContain(".eq('status', 'needs_review')")
    })

    it('does not auto-change receivable or payment amounts and has no owner ledger dependency', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const commercials = readProjectFile('app/(dashboard)/owner/commercials/actions.ts')
        expect(action).not.toContain('record_commercial_payment_v1')
        expect(action).not.toContain('commercial_payment_receipts')
        const confirmAction = action.split('export async function confirmDispatchReceived')[1].split('export async function markDiscrepancyReviewed')[0]
        expect(confirmAction).not.toContain('.from(\'commercial_receivables\')')
        expect(confirmAction).not.toContain('.from(\'commercial_payment_receipts\')')
        expect(commercials).not.toContain('/owner/ledger')
        expect(action).not.toContain('/owner/ledger')
    })
})
