import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    daysBetweenCommercialDates,
    getCommercialDaysLate,
    getCommercialDueBucket,
} from '../lib/commercials/date-buckets'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function sqlFunctionSegment(sql: string, functionName: string) {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`)
    if (start < 0) return ''
    const end = sql.indexOf('\n$$;', start)
    return end < 0 ? sql.slice(start) : sql.slice(start, end)
}

describe('Batch 4 commercials receivables and payment correctness', () => {
    it('buckets commercial receivables using date-only arithmetic', () => {
        expect(getCommercialDueBucket({ due_date: '2026-03-01', balance_amount: 100 }, '2026-03-01')).toBe('due_today')
        expect(getCommercialDueBucket({ due_date: '2026-02-28', balance_amount: 100 }, '2026-03-01')).toBe('overdue')
        expect(getCommercialDueBucket({ due_date: '2026-03-07', balance_amount: 100 }, '2026-03-01')).toBe('due_this_week')
        expect(getCommercialDueBucket({ due_date: '2026-03-20', balance_amount: 100 }, '2026-03-01')).toBe('upcoming')
        expect(getCommercialDueBucket({ due_date: '2026-02-28', balance_amount: 0 }, '2026-03-01')).toBe('paid')
        expect(getCommercialDueBucket({ payment_status: 'paid', due_date: '2026-02-28', balance_amount: 100 }, '2026-03-01')).toBe('paid')
        expect(daysBetweenCommercialDates('2026-03-01', '2026-03-08')).toBe(7)
        expect(getCommercialDaysLate({ due_date: '2026-02-28', balance_amount: 100 }, '2026-03-01')).toBe(1)
    })

    it('disables legacy direct market-run sale RPC instead of creating unsafe sales', () => {
        const migration = readProjectFile('supabase/migrations/20260628121903_batch_4_commercials_receivables_payments.sql')
        const estimatorActions = readProjectFile('app/(dashboard)/owner/estimator/actions.ts')
        const functionSql = sqlFunctionSegment(migration, 'create_market_run_sale')

        expect(functionSql).toContain('Direct market-run sale is disabled')
        expect(functionSql).toContain('public.assert_org_not_locked(v_org_id)')
        expect(functionSql).not.toMatch(/\bINSERT\s+INTO\s+public\.market_run_sales\b/i)
        expect(functionSql).not.toMatch(/\bINSERT\s+INTO\s+public\.commercial_receivables\b/i)
        expect(estimatorActions).toContain('Direct market-run sale is disabled')
        expect(estimatorActions).not.toContain(".rpc('create_market_run_sale'")
    })

    it('makes commercial payment recording idempotent and cheque-complete', () => {
        const migration = readProjectFile('supabase/migrations/20260628121903_batch_4_commercials_receivables_payments.sql')
        const receivables = readProjectFile('lib/commercials/receivables.ts')
        const client = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        const actions = readProjectFile('app/(dashboard)/owner/commercials/actions.ts')

        expect(migration).toContain('ADD COLUMN IF NOT EXISTS idempotency_key TEXT')
        expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_payment_receipts_org_idempotency_key')
        expect(migration).toContain('ON public.commercial_payment_receipts(org_id, idempotency_key)')
        expect(migration).toContain('p_idempotency_key TEXT')
        expect(migration).toContain('Payment idempotency key is required')
        expect(migration).toContain('Cheque number, cheque date, and bank name are required')
        expect(migration).toContain('Payment amount exceeds remaining balance')
        expect(migration).toContain('ON CONFLICT (org_id, idempotency_key) WHERE idempotency_key IS NOT NULL')
        expect(migration).toContain('Payment idempotency key was already used for a different payment')
        expect(migration).toContain('received_amount = received_amount + p_amount')
        expect(migration).toContain("WHEN received_amount + p_amount = total_amount THEN 'paid'")

        expect(receivables).toContain('idempotencyKey?: string')
        expect(receivables).toContain('p_idempotency_key: idempotencyKey')
        expect(receivables).toContain('Cheque number, cheque date, and bank name are required for cheque payments.')
        expect(client).toContain("createClientIdempotencyKey('commercial-payment')")
        expect(client).toContain('paymentIdempotencyKey')
        expect(client).toContain('chequeNumber')
        expect(client).toContain('chequeDate')
        expect(client).toContain('bankName')
        expect(client).toContain('paymentDetailLine')
        expect(actions).toContain('cheque_number')
        expect(actions).toContain('cheque_date')
        expect(actions).toContain('bank_name')
    })

    it('exposes stock sale origin fields for commercial dashboard reconciliation', () => {
        const migration = readProjectFile('supabase/migrations/20260628121903_batch_4_commercials_receivables_payments.sql')
        const actions = readProjectFile('app/(dashboard)/owner/commercials/actions.ts')
        const client = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')

        expect(migration).toContain('CREATE OR REPLACE VIEW public.commercial_profit_entries')
        expect(migration).toContain('WITH (security_invoker = true)')
        expect(migration).toContain('l.source_type AS stock_source_type')
        expect(migration).toContain('l.market_run_id AS stock_market_run_id')
        expect(migration).toContain('l.order_id AS stock_order_id')
        expect(actions).toContain('stock_source_type: item.stock_source_type')
        expect(actions).toContain('stock_market_run_id: item.stock_market_run_id')
        expect(actions).toContain('stock_order_id: item.stock_order_id')
        expect(client).toContain("entry.stock_source_type === 'market_run'")
        expect(client).toContain("entry.stock_source_type === 'order'")
        expect(client).not.toContain('source_label.toLowerCase')
    })

    it('surfaces due receivable and payment mismatch blockers in Factory Today', () => {
        const todayActions = readProjectFile('app/(dashboard)/owner/today/actions.ts')
        const todayClient = readProjectFile('app/(dashboard)/owner/today/FactoryTodayClient.tsx')
        const attentionCard = readProjectFile('components/factory-today/CommercialsAttentionCard.tsx')

        expect(todayActions).toContain('commercialReceivablesRes')
        expect(todayActions).toContain('commercialBlockingIssues')
        expect(todayActions).toContain("reason: 'due_or_overdue' | 'payment_mismatch'")
        expect(todayActions).toContain('commercial.blockingIssues.length > 0 ? 1 : 0')
        expect(todayClient).toContain('data.commercial.blockingIssues.length === 0')
        expect(todayClient).toContain('CommercialsAttentionCard')
        expect(attentionCard).toContain('/owner/commercials')
        expect(attentionCard).toContain('Receivables need review')
        expect(attentionCard).toContain('payment_mismatch')
    })
})
