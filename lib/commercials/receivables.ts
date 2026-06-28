import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export async function ensureReceivableForCommercialEntry(
    sourceType: 'fabric_stock_sale' | 'market_run_sale' | 'party_invoice',
    sourceId: string
) {
    const { profile, user } = await requireRole(['owner'])
    const supabase = await createServerClient()

    if (sourceType === 'fabric_stock_sale') {
        // Fetch sale details
        const { data: sale, error: saleError } = await supabase
            .from('fabric_stock_sales')
            .select(`
                id,
                org_id,
                sale_date,
                party_name,
                credit_days,
                due_date,
                revenue_amount,
                created_by,
                dispatch_id,
                fabric_stock_lots (
                    quality_label,
                    order_id,
                    orders (
                        party_name
                    )
                )
            `)
            .eq('id', sourceId)
            .eq('org_id', profile.org_id)
            .single()

        if (saleError || !sale) {
            console.error('Failed to fetch sale for receivable:', saleError)
            return { error: 'Sale not found' }
        }

        const lotRaw = sale.fabric_stock_lots
        const lot = Array.isArray(lotRaw) ? lotRaw[0] : lotRaw
        const orderRaw = lot?.orders
        const order = Array.isArray(orderRaw) ? orderRaw[0] : orderRaw
        
        const partyName = sale.party_name || order?.party_name
        if (!partyName || partyName.trim().length === 0) {
            return { error: 'Party name is required for stock sale receivables' }
        }
        const qualityLabel = lot?.quality_label || 'Unknown'
        const orderId = lot?.order_id || null

        // Upsert receivable
        const { error: upsertError } = await supabase
            .from('commercial_receivables')
            .upsert({
                org_id: profile.org_id,
                source_type: sourceType,
                source_id: sourceId,
                source_date: sale.sale_date,
                order_id: orderId,
                dispatch_id: sale.dispatch_id || null,
                party_name: partyName,
                quality_label: qualityLabel,
                total_amount: sale.revenue_amount,
                payment_status: 'unpaid',
                credit_days: sale.credit_days ?? 0,
                due_date: sale.due_date ?? sale.sale_date,
                created_by: user.id,
                updated_by: user.id,
            }, {
                onConflict: 'org_id,source_type,source_id'
            })

        if (upsertError) {
            console.error('Failed to upsert receivable:', upsertError)
            return { error: upsertError.message }
        }

        return { success: true }
    }

    // TODO: Implement other source types (market_run_sale, party_invoice)
    return { error: `Source type ${sourceType} not implemented yet` }
}

export interface RecordPaymentInput {
    receivableId: string
    amount: number
    paymentDate: string
    paymentMode: string
    referenceNumber?: string
    chequeNumber?: string
    chequeDate?: string
    bankName?: string
    notes?: string
    idempotencyKey?: string
}

// Defensive map: accepts both human-readable UI labels and already-normalized DB enum values
export const PAYMENT_MODE_MAP: Record<string, string> = {
    'Bank Transfer': 'bank',
    'Cash': 'cash',
    'UPI': 'upi',
    'Cheque': 'cheque',
    'Other': 'other',
    // Pass-through for already-normalized enum values
    'bank': 'bank',
    'cash': 'cash',
    'upi': 'upi',
    'cheque': 'cheque',
    'other': 'other',
}

export function normalizePaymentMode(mode: string): string {
    return PAYMENT_MODE_MAP[mode] ?? 'other'
}

export async function processCommercialPayment(input: RecordPaymentInput) {
    await requireRole(['owner'])
    const supabase = await createServerClient()

    const normalizedMode = normalizePaymentMode(input.paymentMode)
    const idempotencyKey = input.idempotencyKey?.trim()

    if (!idempotencyKey) {
        return { error: 'Payment idempotency key is required. Please reopen the payment dialog and try again.' }
    }

    if (normalizedMode === 'cheque') {
        if (!input.chequeNumber?.trim() || !input.chequeDate || !input.bankName?.trim()) {
            return { error: 'Cheque number, cheque date, and bank name are required for cheque payments.' }
        }
    }

    const { error } = await supabase.rpc('record_commercial_payment_v1', {
        p_receivable_id: input.receivableId,
        p_amount: input.amount,
        p_payment_date: input.paymentDate,
        p_payment_mode: normalizedMode,
        p_reference_number: input.referenceNumber || null,
        p_cheque_number: input.chequeNumber || null,
        p_cheque_date: input.chequeDate || null,
        p_bank_name: input.bankName || null,
        p_notes: input.notes || null,
        p_idempotency_key: idempotencyKey,
    })

    if (error) {
        console.error('Failed to record payment via RPC:', error)
        return { error: error.message }
    }

    return { success: true }
}
