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
    party_id: string | null
    party_name: string | null
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

export type CommercialPartyPeriod = '7d' | '30d' | 'year' | 'all'

export interface CommercialPartyInsightRow {
    partyKey: string
    partyId: string | null
    partyName: string
    phone: string | null
    gstin: string | null
    defaultCreditDays: number | null
    isSavedParty: boolean
    revenue: number
    bookedGrossProfit: number
    metersSold: number
    salesCount: number
    outstanding: number
    overdue: number
    lastSaleDate: string | null
    marginPct: number | null
}

export interface CommercialPartyInsights {
    leaderboards: Record<CommercialPartyPeriod, CommercialPartyInsightRow[]>
    parties: CommercialPartyInsightRow[]
}

function toNumber(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function normalizePartyName(value: unknown): string {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function addDays(dateString: string, days: number) {
    const date = new Date(`${dateString}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
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
            party_id: item.party_id == null ? null : String(item.party_id),
            party_name: item.party_name == null ? null : String(item.party_name),
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
                party_id,
                party_phone,
                party_gstin,
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
                    party_id: rec.party_id ?? sale?.party_id ?? null,
                    party_phone: sale?.party_phone ?? null,
                    party_gstin: sale?.party_gstin ?? null,
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
                party_id: rec.party_id ?? null,
                party_phone: null,
                party_gstin: null,
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
        party_id: rec.party_id ?? null,
        party_phone: null,
        party_gstin: null,
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

type PartyLookup = {
    id: string
    name: string
    phone: string | null
    gstin: string | null
    default_credit_days: number | null
    is_active: boolean
}

function makeEmptyPartyInsight(
    key: string,
    name: string,
    party: PartyLookup | null
): CommercialPartyInsightRow {
    return {
        partyKey: key,
        partyId: party?.id ?? null,
        partyName: party?.name ?? name,
        phone: party?.phone ?? null,
        gstin: party?.gstin ?? null,
        defaultCreditDays: party?.default_credit_days ?? null,
        isSavedParty: Boolean(party),
        revenue: 0,
        bookedGrossProfit: 0,
        metersSold: 0,
        salesCount: 0,
        outstanding: 0,
        overdue: 0,
        lastSaleDate: null,
        marginPct: null,
    }
}

function finalizePartyRows(rows: CommercialPartyInsightRow[]) {
    return rows
        .map((row) => ({
            ...row,
            revenue: toNumber(row.revenue),
            bookedGrossProfit: toNumber(row.bookedGrossProfit),
            metersSold: toNumber(row.metersSold),
            outstanding: toNumber(row.outstanding),
            overdue: toNumber(row.overdue),
            marginPct: row.revenue > 0 ? (row.bookedGrossProfit / row.revenue) * 100 : null,
        }))
        .sort((a, b) => {
            if (b.bookedGrossProfit !== a.bookedGrossProfit) return b.bookedGrossProfit - a.bookedGrossProfit
            if (b.revenue !== a.revenue) return b.revenue - a.revenue
            return a.partyName.localeCompare(b.partyName)
        })
}

export async function getCommercialPartyInsights(): Promise<{ data: CommercialPartyInsights } | { error: string }> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const [entriesResult, receivablesResult, partiesResult] = await Promise.all([
        supabase
            .from('commercial_profit_entries')
            .select('*')
            .eq('org_id', profile.org_id)
            .eq('stage', 'realized')
            .order('event_date', { ascending: false })
            .limit(5000),
        supabase
            .from('commercial_receivables')
            .select('id, party_id, party_name, total_amount, balance_amount, due_date, payment_status')
            .eq('org_id', profile.org_id),
        supabase
            .from('parties')
            .select('id, name, phone, gstin, default_credit_days, is_active')
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .order('name', { ascending: true }),
    ])

    const firstError = entriesResult.error || receivablesResult.error || partiesResult.error
    if (firstError) return { error: firstError.message }

    const parties = (partiesResult.data ?? []) as PartyLookup[]
    const partyById = new Map(parties.map((party) => [party.id, party]))
    const partiesByName = parties.reduce((acc, party) => {
        const key = normalizePartyName(party.name)
        const list = acc.get(key) ?? []
        list.push(party)
        acc.set(key, list)
        return acc
    }, new Map<string, PartyLookup[]>())

    function resolveParty(rawPartyId: unknown, rawName: unknown) {
        const explicitParty = rawPartyId == null ? null : partyById.get(String(rawPartyId)) ?? null
        if (explicitParty) {
            return {
                key: `id:${explicitParty.id}`,
                name: explicitParty.name,
                party: explicitParty,
            }
        }

        const normalizedName = normalizePartyName(rawName)
        const nameMatches = normalizedName ? partiesByName.get(normalizedName) ?? [] : []
        if (nameMatches.length === 1) {
            const matchedParty = nameMatches[0]
            return {
                key: `id:${matchedParty.id}`,
                name: matchedParty.name,
                party: matchedParty,
            }
        }

        const displayName = String(rawName ?? '').trim() || 'Unknown Party'
        return {
            key: `name:${normalizePartyName(displayName) || 'unknown'}`,
            name: displayName,
            party: null,
        }
    }

    const today = getSuratTodayString()
    const periodStarts: Record<CommercialPartyPeriod, string | null> = {
        '7d': addDays(today, -6),
        '30d': addDays(today, -29),
        year: `${today.slice(0, 4)}-01-01`,
        all: null,
    }

    const periodMaps: Record<CommercialPartyPeriod, Map<string, CommercialPartyInsightRow>> = {
        '7d': new Map(),
        '30d': new Map(),
        year: new Map(),
        all: new Map(),
    }

    const ensureRow = (
        map: Map<string, CommercialPartyInsightRow>,
        key: string,
        name: string,
        party: PartyLookup | null
    ) => {
        const existing = map.get(key)
        if (existing) return existing
        const created = makeEmptyPartyInsight(key, name, party)
        map.set(key, created)
        return created
    }

    for (const party of parties) {
        ensureRow(periodMaps.all, `id:${party.id}`, party.name, party)
    }

    for (const rawEntry of entriesResult.data ?? []) {
        const entry = rawEntry as Record<string, unknown>
        const eventDate = String(entry.event_date ?? '')
        const resolved = resolveParty(
            entry.party_id,
            entry.party_name ?? entry.source_label ?? entry.reference
        )

        ;(Object.keys(periodStarts) as CommercialPartyPeriod[]).forEach((period) => {
            const startDate = periodStarts[period]
            if (startDate && eventDate < startDate) return

            const row = ensureRow(periodMaps[period], resolved.key, resolved.name, resolved.party)
            row.revenue += toNumber(entry.revenue_amount)
            row.bookedGrossProfit += toNumber(entry.gross_profit_amount)
            row.metersSold += toNumber(entry.meters_sold)
            row.salesCount += 1
            if (eventDate && (!row.lastSaleDate || eventDate > row.lastSaleDate)) {
                row.lastSaleDate = eventDate
            }
        })
    }

    const outstandingByKey = new Map<string, { outstanding: number; overdue: number }>()
    for (const rawReceivable of receivablesResult.data ?? []) {
        const rec = rawReceivable as Record<string, unknown>
        const resolved = resolveParty(rec.party_id, rec.party_name)
        const current = outstandingByKey.get(resolved.key) ?? { outstanding: 0, overdue: 0 }
        const balance = toNumber(rec.balance_amount)
        current.outstanding += balance
        if (balance > 0 && rec.due_date && String(rec.due_date) < today) {
            current.overdue += balance
        }
        outstandingByKey.set(resolved.key, current)

        ensureRow(periodMaps.all, resolved.key, resolved.name, resolved.party)
    }

    ;(Object.keys(periodMaps) as CommercialPartyPeriod[]).forEach((period) => {
        periodMaps[period].forEach((row, key) => {
            const outstanding = outstandingByKey.get(key)
            if (!outstanding) return
            row.outstanding = outstanding.outstanding
            row.overdue = outstanding.overdue
        })
    })

    const leaderboards: Record<CommercialPartyPeriod, CommercialPartyInsightRow[]> = {
        '7d': finalizePartyRows(Array.from(periodMaps['7d'].values())).slice(0, 10),
        '30d': finalizePartyRows(Array.from(periodMaps['30d'].values())).slice(0, 10),
        year: finalizePartyRows(Array.from(periodMaps.year.values())).slice(0, 10),
        all: finalizePartyRows(Array.from(periodMaps.all.values())).slice(0, 10),
    }

    const partiesDirectory = finalizePartyRows(Array.from(periodMaps.all.values()))
        .sort((a, b) => {
            if ((b.lastSaleDate || '') !== (a.lastSaleDate || '')) return (b.lastSaleDate || '').localeCompare(a.lastSaleDate || '')
            if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding
            return a.partyName.localeCompare(b.partyName)
        })

    return {
        data: {
            leaderboards,
            parties: partiesDirectory,
        },
    }
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
