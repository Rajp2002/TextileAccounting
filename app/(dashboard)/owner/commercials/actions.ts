'use server'

import { requireRole } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { processCommercialPayment, RecordPaymentInput } from '@/lib/commercials/receivables'
import { getSuratTodayString, formatToSurat } from '@/lib/time'
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

export async function getCommercialReceivables(filters?: { status?: 'unpaid' | 'partial' | 'paid' }) {
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

    const { data: receivables, error } = await query

    if (error) return { error: error.message }

    const stockSaleIds = (receivables ?? [])
        .filter((r) => r.source_type === 'fabric_stock_sale' && r.source_id)
        .map((r) => r.source_id as string)

    if (stockSaleIds.length > 0) {
        const { data: sales, error: salesError } = await supabase
            .from('fabric_stock_sales')
            .select(`
                id,
                sale_date,
                taka_sold,
                meters_sold,
                price_per_meter,
                cost_per_meter,
                revenue_amount,
                cost_amount,
                gross_profit_amount,
                dispatched_meters,
                pending_dispatch_meters,
                dispatch_status,
                credit_days,
                fabric_stock_lots (
                    market_run_id,
                    order_id,
                    godown,
                    quality_label,
                    market_runs (
                        fabric_label,
                        quality_label
                    ),
                    orders (
                        party_name,
                        quality_label
                    )
                )
            `)
            .in('id', stockSaleIds)

        if (salesError) {
            console.error('Failed to fetch fabric stock sales for commercials:', salesError)
        }

        const salesMap = new Map(sales?.map((s) => [s.id, s]))
        const enriched = (receivables ?? []).map((rec) => {
            if (rec.source_type === 'fabric_stock_sale') {
                const sale = salesMap.get(rec.source_id)
                const lotRaw = sale?.fabric_stock_lots
                const lot = Array.isArray(lotRaw) ? lotRaw[0] : lotRaw
                const marketRunRaw = lot?.market_runs
                const marketRun = Array.isArray(marketRunRaw) ? marketRunRaw[0] : marketRunRaw
                const orderRaw = lot?.orders
                const order = Array.isArray(orderRaw) ? orderRaw[0] : orderRaw
                return {
                    ...rec,
                    sale_date: sale?.sale_date ?? rec.source_date ?? null,
                    taka_sold: sale?.taka_sold ?? null,
                    meters_sold: sale?.meters_sold ?? null,
                    price_per_meter: sale?.price_per_meter ?? null,
                    cost_per_meter: sale?.cost_per_meter ?? null,
                    revenue_amount: sale?.revenue_amount ?? rec.total_amount ?? null,
                    cost_amount: sale?.cost_amount ?? null,
                    dispatched_meters: sale?.dispatched_meters ?? null,
                    pending_dispatch_meters: sale?.pending_dispatch_meters ?? null,
                    dispatch_status: sale?.dispatch_status || 'not_dispatched',
                    credit_days: sale?.credit_days ?? null,
                    booked_gross_profit: sale?.gross_profit_amount ?? null,
                    market_run_id: lot?.market_run_id ?? null,
                    market_run_label: marketRun?.fabric_label ?? null,
                    market_run_quality: marketRun?.quality_label ?? lot?.quality_label ?? null,
                    order_id: lot?.order_id ?? rec.order_id ?? null,
                    order_party_name: order?.party_name ?? null,
                    order_quality_label: order?.quality_label ?? null,
                    godown: lot?.godown ?? null,
                }
            }
            return {
                ...rec,
                sale_date: rec.source_date ?? null,
                taka_sold: null,
                meters_sold: null,
                price_per_meter: null,
                cost_per_meter: null,
                revenue_amount: rec.total_amount ?? null,
                cost_amount: null,
                dispatched_meters: null,
                pending_dispatch_meters: null,
                dispatch_status: null,
                credit_days: rec.credit_days ?? null,
                booked_gross_profit: null,
                market_run_id: null,
                market_run_label: null,
                market_run_quality: null,
                order_id: rec.order_id ?? null,
                order_party_name: null,
                order_quality_label: null,
                godown: null,
            }
        })

        return { data: enriched }
    }

    const simpleMapped = (receivables ?? []).map((rec) => ({
        ...rec,
        sale_date: rec.source_date ?? null,
        taka_sold: null,
        meters_sold: null,
        price_per_meter: null,
        cost_per_meter: null,
        revenue_amount: rec.total_amount ?? null,
        cost_amount: null,
        dispatched_meters: null,
        pending_dispatch_meters: null,
        dispatch_status: null,
        credit_days: rec.credit_days ?? null,
        booked_gross_profit: null,
        market_run_id: null,
        market_run_label: null,
        market_run_quality: null,
        order_id: rec.order_id ?? null,
        order_party_name: null,
        order_quality_label: null,
        godown: null,
    }))

    return { data: simpleMapped }
}

export async function recordCommercialPaymentAction(input: RecordPaymentInput) {
    const result = await processCommercialPayment(input)
    if ('success' in result) {
        revalidatePath('/owner/commercials')
    }
    return result
}

export interface CommercialPayment {
    id: string
    amount: number
    payment_date: string
    payment_mode: string
    reference_number: string | null
    notes: string | null
    created_at: string
}

export async function getCommercialPayments(receivableId: string): Promise<{ data: CommercialPayment[] } | { error: string }> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('commercial_payment_receipts')
        .select('id, amount, payment_date, payment_mode, reference_number, notes, created_at')
        .eq('receivable_id', receivableId)
        .eq('org_id', profile.org_id)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })

    if (error) return { error: error.message }

    const payments: CommercialPayment[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        amount: Number(row.amount ?? 0),
        payment_date: String(row.payment_date),
        payment_mode: String(row.payment_mode ?? 'other'),
        reference_number: row.reference_number == null ? null : String(row.reference_number),
        notes: row.notes == null ? null : String(row.notes),
        created_at: String(row.created_at),
    }))

    return { data: payments }
}

export async function getCollectedThisMonth(): Promise<{ data: number } | { error: string }> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Use IST (Asia/Kolkata) dates to avoid UTC midnight drift on Vercel
    const today = getSuratTodayString()
    const firstOfMonth = formatToSurat(new Date(), 'yyyy-MM') + '-01'

    const { data, error } = await supabase
        .from('commercial_payment_receipts')
        .select('amount')
        .eq('org_id', profile.org_id)
        .gte('payment_date', firstOfMonth)
        .lte('payment_date', today)

    if (error) return { error: error.message }

    const total = (data ?? []).reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.amount ?? 0), 0)

    return { data: total }
}
