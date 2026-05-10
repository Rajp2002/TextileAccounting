'use server'

import { requireRole } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { processCommercialPayment, RecordPaymentInput } from '@/lib/commercials/receivables'
import { revalidatePath } from 'next/cache'

export type CommercialStage = 'realized' | 'expected'
export type CommercialSourceKind = 'stock_sale' | 'market_run_sale' | 'order_invoice' | 'order_quote'

export interface CommercialProfitEntry {
    source_id: string
    org_id: string
    source_kind: CommercialSourceKind
    source_label: string
    stage: CommercialStage
    event_date: string
    quality_label: string
    quantity_label: string
    taka_count: number | null
    meters_sold: number
    price_per_meter: number
    cost_per_meter: number
    revenue_amount: number
    cost_amount: number
    gross_profit_amount: number
    reference: string | null
    created_at: string
}

export interface CommercialsData {
    entries: CommercialProfitEntry[]
    summary: {
        realized_revenue: number
        realized_cost: number
        realized_profit: number
        expected_revenue: number
        expected_cost: number
        expected_profit: number
        realized_margin_pct: number | null
    }
}

function toNumber(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

export async function getCommercialsData(): Promise<{ data: CommercialsData } | { error: string }> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('commercial_profit_entries')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('event_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(300)

    if (error) return { error: error.message }

    const entries = ((data ?? []) as unknown[]).map((row) => {
        const item = row as Record<string, unknown>
        return {
            source_id: String(item.source_id),
            org_id: String(item.org_id),
            source_kind: item.source_kind as CommercialSourceKind,
            source_label: String(item.source_label ?? ''),
            stage: item.stage as CommercialStage,
            event_date: String(item.event_date),
            quality_label: String(item.quality_label ?? 'Unlabelled'),
            quantity_label: String(item.quantity_label ?? ''),
            taka_count: item.taka_count == null ? null : toNumber(item.taka_count),
            meters_sold: toNumber(item.meters_sold),
            price_per_meter: toNumber(item.price_per_meter),
            cost_per_meter: toNumber(item.cost_per_meter),
            revenue_amount: toNumber(item.revenue_amount),
            cost_amount: toNumber(item.cost_amount),
            gross_profit_amount: toNumber(item.gross_profit_amount),
            reference: item.reference == null ? null : String(item.reference),
            created_at: String(item.created_at),
        }
    })

    const summary = entries.reduce((acc, entry) => {
        if (entry.stage === 'realized') {
            acc.realized_revenue += entry.revenue_amount
            acc.realized_cost += entry.cost_amount
            acc.realized_profit += entry.gross_profit_amount
        } else {
            acc.expected_revenue += entry.revenue_amount
            acc.expected_cost += entry.cost_amount
            acc.expected_profit += entry.gross_profit_amount
        }
        return acc
    }, {
        realized_revenue: 0,
        realized_cost: 0,
        realized_profit: 0,
        expected_revenue: 0,
        expected_cost: 0,
        expected_profit: 0,
        realized_margin_pct: null as number | null,
    })

    summary.realized_margin_pct = summary.realized_revenue > 0
        ? (summary.realized_profit / summary.realized_revenue) * 100
        : null

    return { data: { entries, summary } }
}

export async function getCommercialReceivables(filters?: any) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    let query = supabase
        .from('commercial_receivables')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

    if (filters?.status) {
        query = query.eq('payment_status', filters.status)
    }

    const { data, error } = await query

    if (error) return { error: error.message }
    return { data }
}

export async function recordCommercialPaymentAction(input: RecordPaymentInput) {
    const result = await processCommercialPayment(input)
    if ('success' in result) {
        revalidatePath('/owner/commercials')
    }
    return result
}
