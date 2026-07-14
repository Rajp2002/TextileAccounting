import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 commercial payment recording — completion patch', () => {
    // ──────────────── DATABASE / RPC ────────────────

    it('uses the existing commercial_payment_receipts table, not a duplicate commercial_payments table', () => {
        const receivablesActions = readProjectFile('app/(dashboard)/owner/commercials/actions.ts')
        const receivablesLib = readProjectFile('lib/commercials/receivables.ts')
        expect(receivablesActions).toContain('commercial_payment_receipts')
        expect(receivablesLib).toContain('record_commercial_payment_v1')
        // Ensure no separate commercial_payments table was created
        const migrationPath = join(root, 'supabase/migrations/20260518090000_commercial_payment_refinement.sql')
        if (existsSync(migrationPath)) {
            const migration = readFileSync(migrationPath, 'utf8')
            expect(migration).not.toContain('CREATE TABLE')
            expect(migration).toContain('commercial_payment_receipts')
        }
    })

    it('record_commercial_payment_v1 RPC exists in original migration', () => {
        const migration = readProjectFile('supabase/migrations/20260510000000_commercial_receivables.sql')
        expect(migration).toContain('CREATE OR REPLACE FUNCTION record_commercial_payment_v1')
        expect(migration).toContain('p_amount IS NULL OR p_amount <= 0')
        expect(migration).toContain('Payment amount exceeds remaining balance')
        expect(migration).toContain('received_amount = received_amount + p_amount')
        expect(migration).toContain("WHEN received_amount + p_amount = total_amount THEN 'paid'")
        expect(migration).toContain("ELSE 'partial'")
    })

    it('Batch 4 payment RPC requires idempotency and preserves cheque metadata', () => {
        const migration = readProjectFile('supabase/migrations/20260628121903_batch_4_commercials_receivables_payments.sql')
        const receivablesLib = readProjectFile('lib/commercials/receivables.ts')
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')

        expect(migration).toContain('ADD COLUMN IF NOT EXISTS idempotency_key TEXT')
        expect(migration).toContain('idx_commercial_payment_receipts_org_idempotency_key')
        expect(migration).toContain('p_idempotency_key TEXT')
        expect(migration).toContain('Payment idempotency key is required')
        expect(migration).toContain('Cheque number, cheque date, and bank name are required')
        expect(migration).toContain('ON CONFLICT (org_id, idempotency_key) WHERE idempotency_key IS NOT NULL')
        expect(migration).toContain('Payment idempotency key was already used for a different payment')

        expect(receivablesLib).toContain('idempotencyKey?: string')
        expect(receivablesLib).toContain('p_idempotency_key: idempotencyKey')
        expect(receivablesLib).toContain('Cheque number, cheque date, and bank name are required for cheque payments.')

        expect(clientFile).toContain("createClientIdempotencyKey('commercial-payment')")
        expect(clientFile).toContain('paymentIdempotencyKey')
        expect(clientFile).toContain('chequeNumber')
        expect(clientFile).toContain('bankName')
    })

    // ──────────────── PAYMENT MODE NORMALIZATION ────────────────

    it('processCommercialPayment normalizes payment modes via PAYMENT_MODE_MAP', () => {
        const receivablesLib = readProjectFile('lib/commercials/receivables.ts')
        expect(receivablesLib).toContain('PAYMENT_MODE_MAP')
        expect(receivablesLib).toContain("'Bank Transfer': 'bank'")
        expect(receivablesLib).toContain("'Cash': 'cash'")
        expect(receivablesLib).toContain("'UPI': 'upi'")
        expect(receivablesLib).toContain("'Cheque': 'cheque'")
        expect(receivablesLib).toContain("'Other': 'other'")
        expect(receivablesLib).toContain('normalizePaymentMode')
        expect(receivablesLib).toContain('normalizedMode')
    })

    it('UI select uses normalized DB enum values as option values', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        expect(clientFile).toContain('value="bank"')
        expect(clientFile).toContain('value="cash"')
        expect(clientFile).toContain('value="upi"')
        expect(clientFile).toContain('value="cheque"')
        expect(clientFile).toContain('value="other"')
        // Should NOT use human-readable values as Select values
        expect(clientFile).not.toContain('value="Bank Transfer"')
        expect(clientFile).not.toContain('value="Cash"')
    })

    it('Other payment mode exists in the payment mode select', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        expect(clientFile).toContain('value="other">Other</SelectItem>')
    })

    // ──────────────── USE FULL BALANCE ────────────────

    it('Use Full Balance button exists in the Record Payment dialog', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        expect(clientFile).toContain('Use full balance:')
        expect(clientFile).toContain('selectedReceivable.balance_amount.toString()')
    })

    // ──────────────── SERVER ACTIONS ────────────────

    it('getCommercialPayments server action exists and queries payment history', () => {
        const actionsFile = readProjectFile('app/(dashboard)/owner/commercials/actions.ts')
        expect(actionsFile).toContain('getCommercialPayments')
        expect(actionsFile).toContain('commercial_payment_receipts')
        expect(actionsFile).toContain("'payment_date'")
        expect(actionsFile).toContain('receivable_id')
    })

    it('getCollectedThisMonth server action uses IST dates and sums current month payments', () => {
        const actionsFile = readProjectFile('app/(dashboard)/owner/commercials/actions.ts')
        expect(actionsFile).toContain('getCollectedThisMonth')
        expect(actionsFile).toContain('commercial_payment_receipts')
        expect(actionsFile).toContain('getSuratTodayString')
        expect(actionsFile).toContain('getSuratMonthToDateBounds')
        expect(actionsFile).toContain('payment_date')
    })

    // ──────────────── PAYMENT HISTORY UI ────────────────

    it('payment history displays date, amount, mode, reference, and note per payment', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        expect(clientFile).toContain('Payment History')
        expect(clientFile).toContain('payment_date')
        expect(clientFile).toContain('payment_mode')
        expect(clientFile).toContain('getPaymentModeLabel')
        expect(clientFile).toContain('reference_number')
        expect(clientFile).toContain('cheque_number')
        expect(clientFile).toContain('cheque_date')
        expect(clientFile).toContain('bank_name')
        expect(clientFile).toContain('paymentDetailLine')
    })

    it('payment history toggle with History button and ChevronDown icon', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        expect(clientFile).toContain('togglePaymentHistory')
        expect(clientFile).toContain('expandedHistoryId')
        expect(clientFile).toContain('paymentHistoryCache')
    })

    // ──────────────── METRICS ────────────────

    it('Collected This Month metric card exists in overview', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        expect(clientFile).toContain('Collected This Month')
        expect(clientFile).toContain('collectedThisMonth')
    })

    it('Total to Collect metric remains present', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        expect(clientFile).toContain('Total to Collect')
    })

    // ──────────────── WORDING ────────────────

    it('uses correct wording: Booked Gross Profit, no Profit Received / Cash Profit', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        expect(clientFile).toContain('Booked Gross Profit')
        expect(clientFile.toLowerCase()).not.toContain('profit received')
        expect(clientFile.toLowerCase()).not.toContain('cash profit')
    })

    // ──────────────── BUTTON CONDITION ────────────────

    it('Record Payment button is hidden when balance_amount <= 0', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        // The button should use balance_amount > 0 condition, not payment_status
        expect(clientFile).toContain('rec.balance_amount > 0')
        // Should not use disabled={rec.payment_status === 'paid'} for the Record Payment button
        expect(clientFile).not.toContain("disabled={rec.payment_status === 'paid'}")
    })

    // ──────────────── BUCKET / STATUS BEHAVIOR ────────────────

    it('payment status and bucket behavior remain consistent with paid/partial receivables', () => {
        const clientFile = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        expect(clientFile).toContain("'overdue'")
        expect(clientFile).toContain("'due_today'")
        expect(clientFile).toContain("'due_this_week'")
        expect(clientFile).toContain("'upcoming'")
        expect(clientFile).toContain("'paid'")
        expect(clientFile).toContain('getDueBucket')
    })

    // ──────────────── LEDGER UNTOUCHED ────────────────

    it('/owner/ledger remains archived and untouched', () => {
        const phaseScope = readProjectFile('lib/phase1-scope.ts')
        expect(phaseScope).toContain("'/owner/ledger'")
        // Verify ledger page still exists as-is
        const ledgerPage = readProjectFile('app/(dashboard)/owner/ledger/page.tsx')
        expect(ledgerPage).toContain('LedgerClient')
    })

    // ──────────────── EXISTING COMMERCIALS REGRESSION ────────────────

    it('existing order-related commercials still render via commercial_profit_entries view', () => {
        const actionsFile = readProjectFile('app/(dashboard)/owner/commercials/actions.ts')
        expect(actionsFile).toContain('commercial_profit_entries')
        expect(actionsFile).toContain("source_kind")
        expect(actionsFile).toContain("CommercialProfitEntry")
    })

    it('page passes collectedThisMonth prop to CommercialsClient', () => {
        const pageFile = readProjectFile('app/(dashboard)/owner/commercials/page.tsx')
        expect(pageFile).toContain('getCollectedThisMonth')
        expect(pageFile).toContain('collectedThisMonth')
    })
})
