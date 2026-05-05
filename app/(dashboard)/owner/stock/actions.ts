'use server'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
    AdjustTakaStockLotSchema,
    ConfirmStockInwardDraftSchema,
    CreateFabricPackageSchema,
    CreateTakaStockLotSchema,
    DismissStockInwardDraftSchema,
    RecordTakaStockSaleSchema,
    UpdateFabricInspectionSchema,
    UpdateFabricPackageStateSchema,
    CorrectFabricPackageMetersSchema,
    safeParse,
} from '@/lib/schemas'

export interface FabricPackageRow {
    id: string
    order_id: string
    package_no: string
    package_type: 'roll' | 'bale' | 'package' | 'bulk'
    units_count: number
    metres: number
    grade: string
    inspection_status: 'pending' | 'pass' | 'minor_defect' | 'reject'
    stock_state: 'uninspected' | 'ready' | 'reserved' | 'dispatched' | 'claimed' | 'returned'
    location: string
    inspection_notes: string | null
    inspection_photo_url: string | null
    source_date: string | null
    source_shift: 'day' | 'night' | null
    source_reference: string | null
    created_at: string
    corrected_at: string | null
    orders: {
        id: string
        party_name: string
        quality_label: string | null
        total_target_meters: number
        status: string
    }
}

export interface FabricStockBoardData {
    packages: FabricPackageRow[]
    orders: Array<{
        id: string
        party_name: string
        quality_label: string | null
        total_target_meters: number
        status: string
    }>
}

export interface TakaStockLotSummary {
    stock_lot_id: string
    org_id: string
    quality_label: string
    godown: string
    source_type: 'opening' | 'market_run' | 'order' | 'manual' | 'adjustment'
    market_run_id: string | null
    order_id: string | null
    quote_id: string | null
    original_taka_count: number
    available_taka_count: number
    original_meters: number
    available_meters: number
    meters_per_taka: number
    unit_label: string
    stock_purpose: 'sellable' | 'order_reserved' | 'manual'
    cost_per_meter: number
    received_date: string
    source_date: string | null
    source_shift: 'day' | 'night' | null
    notes: string | null
    created_at: string
    sold_taka_count: number
    sold_meters: number
    total_revenue: number
    total_cost_on_sold: number
    total_gross_profit: number
    stock_status: 'available' | 'partially_sold' | 'sold_out'
}

export interface TakaStockSaleRow {
    id: string
    stock_lot_id: string
    sale_date: string
    taka_sold: number
    meters_sold: number
    price_per_meter: number
    cost_per_meter: number
    revenue_amount: number
    cost_amount: number
    gross_profit_amount: number
    notes: string | null
    created_at: string
    fabric_stock_lots: {
        quality_label: string
        godown: string
        meters_per_taka: number
        unit_label: string
    }
}

export interface TakaStockMovementRow {
    id: string
    stock_lot_id: string
    movement_type: 'inward' | 'sale' | 'adjustment_add' | 'adjustment_subtract'
    movement_date: string
    taka_delta: number
    meters_delta: number
    reference: string | null
    notes: string | null
    created_at: string
    fabric_stock_lots: {
        quality_label: string
        godown: string
        unit_label: string
    }
}

export interface StockSourceOption {
    id: string
    source_type: 'market_run' | 'order'
    label: string
    quality_label: string
    cost_per_meter: number
    suggested_takas?: number | null
    meters?: number | null
    meters_per_taka?: number | null
    unit_label?: string | null
}

export interface StockInwardDraftRow {
    id: string
    source_type: 'market_run' | 'order'
    market_run_id: string | null
    order_id: string
    quote_id: string | null
    quality_label: string
    source_date: string
    source_shift: 'day' | 'night'
    suggested_meters: number
    suggested_unit_count: number
    meters_per_unit: number
    unit_label: string
    cost_per_meter: number
    suggested_godown: string
    notes: string | null
    created_at: string
}

export interface TakaStockBoardData {
    lots: TakaStockLotSummary[]
    sales: TakaStockSaleRow[]
    movements: TakaStockMovementRow[]
    pendingInwards: StockInwardDraftRow[]
    sourceOptions: StockSourceOption[]
    summary: {
        available_taka: number
        available_meters: number
        stock_value_at_cost: number
        realized_revenue: number
        realized_profit: number
    }
}

type RawFabricPackageRow = Omit<FabricPackageRow, 'orders'> & {
    orders: FabricPackageRow['orders'] | FabricPackageRow['orders'][]
}

function normalizeOrderRelation<T>(row: T & { orders: unknown }) {
    return {
        ...row,
        orders: Array.isArray(row.orders) ? row.orders[0] : row.orders,
    }
}

function deriveStockState(
    inspectionStatus: 'pending' | 'pass' | 'minor_defect' | 'reject',
    currentState?: FabricPackageRow['stock_state']
): FabricPackageRow['stock_state'] {
    if (currentState && ['dispatched', 'claimed', 'returned'].includes(currentState)) {
        return currentState
    }

    if (inspectionStatus === 'pass' || inspectionStatus === 'minor_defect') {
        return currentState === 'reserved' ? 'reserved' : 'ready'
    }

    return 'uninspected'
}

export async function getFabricStockBoard(): Promise<FabricStockBoardData | { error: string }> {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const [packagesRes, ordersRes] = await Promise.all([
        supabase
            .from('fabric_packages')
            .select(`
                id,
                order_id,
                package_no,
                package_type,
                units_count,
                metres,
                grade,
                inspection_status,
                stock_state,
                location,
                inspection_notes,
                inspection_photo_url,
                source_date,
                source_shift,
                source_reference,
                created_at,
                corrected_at,
                orders!inner (
                    id,
                    party_name,
                    quality_label,
                    total_target_meters,
                    status
                )
            `)
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false }),
        supabase
            .from('orders')
            .select('id, party_name, quality_label, total_target_meters, status')
            .eq('org_id', profile.org_id)
            .in('status', ['active', 'completed'])
            .order('deadline', { ascending: true }),
    ])

    if (packagesRes.error) return { error: packagesRes.error.message }
    if (ordersRes.error) return { error: ordersRes.error.message }

    const packages = ((packagesRes.data ?? []) as unknown as RawFabricPackageRow[]).map((row) => normalizeOrderRelation(row)) as FabricPackageRow[]

    return {
        packages,
        orders: ordersRes.data ?? [],
    }
}

function toNumber(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function normalizeRelation<T>(row: T & Record<string, unknown>, key: string) {
    const value = row[key]
    return {
        ...row,
        [key]: Array.isArray(value) ? value[0] : value,
    }
}

export async function getTakaStockBoard(): Promise<TakaStockBoardData | { error: string }> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const [lotsRes, salesRes, movementsRes, draftsRes, runsRes, quotesRes] = await Promise.all([
        supabase
            .from('fabric_stock_lot_summary')
            .select('*')
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false }),
        supabase
            .from('fabric_stock_sales')
            .select(`
                id,
                stock_lot_id,
                sale_date,
                taka_sold,
                meters_sold,
                price_per_meter,
                cost_per_meter,
                revenue_amount,
                cost_amount,
                gross_profit_amount,
                notes,
                created_at,
                fabric_stock_lots!inner (
                    quality_label,
                    godown,
                    meters_per_taka,
                    unit_label
                )
            `)
            .eq('org_id', profile.org_id)
            .order('sale_date', { ascending: false })
            .limit(80),
        supabase
            .from('fabric_stock_movements')
            .select(`
                id,
                stock_lot_id,
                movement_type,
                movement_date,
                taka_delta,
                meters_delta,
                reference,
                notes,
                created_at,
                fabric_stock_lots!inner (
                    quality_label,
                    godown,
                    unit_label
                )
            `)
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false })
            .limit(80),
        supabase
            .from('fabric_stock_inward_drafts')
            .select('*')
            .eq('org_id', profile.org_id)
            .eq('status', 'pending')
            .order('source_date', { ascending: false })
            .order('created_at', { ascending: false }),
        supabase
            .from('market_run_summary')
            .select('market_run_id, fabric_label, quality_label, cost_per_meter, target_meters, meters_in_godown, status')
            .eq('org_id', profile.org_id)
            .in('status', ['production', 'in_godown', 'partially_sold'])
            .order('created_at', { ascending: false }),
        supabase
            .from('estimator_quotes')
            .select(`
                id,
                order_id,
                party_name,
                quality_label,
                landed_cost_per_meter,
                meters,
                orders (
                    id,
                    party_name,
                    quality_label,
                    total_target_meters,
                    status
                )
            `)
            .eq('org_id', profile.org_id)
            .not('order_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(80),
    ])

    if (lotsRes.error) return { error: lotsRes.error.message }
    if (salesRes.error) return { error: salesRes.error.message }
    if (movementsRes.error) return { error: movementsRes.error.message }
    if (draftsRes.error) return { error: draftsRes.error.message }
    if (runsRes.error) return { error: runsRes.error.message }
    if (quotesRes.error) return { error: quotesRes.error.message }

    const lots = ((lotsRes.data ?? []) as unknown[]).map((row) => {
        const item = row as Record<string, unknown>
        return {
            ...item,
            original_taka_count: toNumber(item.original_taka_count),
            available_taka_count: toNumber(item.available_taka_count),
            original_meters: toNumber(item.original_meters),
            available_meters: toNumber(item.available_meters),
            meters_per_taka: toNumber(item.meters_per_taka),
            unit_label: String(item.unit_label || 'taka'),
            cost_per_meter: toNumber(item.cost_per_meter),
            sold_taka_count: toNumber(item.sold_taka_count),
            sold_meters: toNumber(item.sold_meters),
            total_revenue: toNumber(item.total_revenue),
            total_cost_on_sold: toNumber(item.total_cost_on_sold),
            total_gross_profit: toNumber(item.total_gross_profit),
        } as TakaStockLotSummary
    })

    const sales = ((salesRes.data ?? []) as unknown[]).map((row) => normalizeRelation(row as Record<string, unknown>, 'fabric_stock_lots')) as unknown as TakaStockSaleRow[]
    const movements = ((movementsRes.data ?? []) as unknown[]).map((row) => normalizeRelation(row as Record<string, unknown>, 'fabric_stock_lots')) as unknown as TakaStockMovementRow[]
    const pendingInwards = ((draftsRes.data ?? []) as unknown[]).map((row) => {
        const item = row as Record<string, unknown>
        return {
            ...item,
            suggested_meters: toNumber(item.suggested_meters),
            suggested_unit_count: toNumber(item.suggested_unit_count),
            meters_per_unit: toNumber(item.meters_per_unit),
            cost_per_meter: toNumber(item.cost_per_meter),
        } as StockInwardDraftRow
    })

    const marketRunOptions: StockSourceOption[] = ((runsRes.data ?? []) as unknown[]).map((rawRun) => {
        const run = rawRun as Record<string, unknown>
        const fabricLabel = String(run.fabric_label || run.quality_label || 'Market run')
        const qualityLabel = String(run.quality_label || run.fabric_label || 'Market Run Stock')
        const stockMeters = toNumber(run.meters_in_godown || run.target_meters)
        return {
            id: String(run.market_run_id),
            source_type: 'market_run',
            label: `${fabricLabel} · ${stockMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m`,
            quality_label: qualityLabel,
            cost_per_meter: toNumber(run.cost_per_meter),
            meters: stockMeters,
            meters_per_taka: null,
            unit_label: null,
        }
    })

    const orderOptions: StockSourceOption[] = ((quotesRes.data ?? []) as unknown[]).map((rawQuote) => {
        const raw = rawQuote as Record<string, unknown>
        const order = (Array.isArray(raw.orders) ? raw.orders[0] : raw.orders) as Record<string, unknown> | undefined
        const quantity = toNumber(order?.total_target_meters ?? raw.meters)
        const qualityLabel = String(order?.quality_label || raw.quality_label || 'Order Stock')
        const partyLabel = String(order?.party_name || raw.party_name || 'Order')
        return {
            id: String(raw.id),
            source_type: 'order',
            label: `${qualityLabel} · ${partyLabel} · ${quantity.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m`,
            quality_label: qualityLabel,
            cost_per_meter: toNumber(raw.landed_cost_per_meter),
            meters: quantity,
            meters_per_taka: null,
            unit_label: null,
        }
    })

    const summary = lots.reduce((acc, lot) => {
        acc.available_taka += lot.available_taka_count
        acc.available_meters += lot.available_meters
        acc.stock_value_at_cost += lot.available_meters * lot.cost_per_meter
        acc.realized_revenue += lot.total_revenue
        acc.realized_profit += lot.total_gross_profit
        return acc
    }, {
        available_taka: 0,
        available_meters: 0,
        stock_value_at_cost: 0,
        realized_revenue: 0,
        realized_profit: 0,
    })

    return {
        lots,
        sales,
        movements,
        pendingInwards,
        sourceOptions: [...marketRunOptions, ...orderOptions],
        summary,
    }
}

export async function createTakaStockLot(input: unknown) {
    const { user, profile } = await requireRole(['owner'])
    const parsed = safeParse(CreateTakaStockLotSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const sourceType = parsed.data.source_type
    const marketRunId = sourceType === 'market_run' ? parsed.data.market_run_id || null : null
    const quoteId = sourceType === 'order' ? parsed.data.quote_id || null : null
    let orderId = sourceType === 'order' ? parsed.data.order_id || null : null

    if (sourceType === 'market_run' && !marketRunId) {
        return { error: 'Select the market run this stock came from' }
    }

    if (sourceType === 'order' && !quoteId && !orderId) {
        return { error: 'Select the order or quote this stock came from' }
    }

    if (quoteId && !orderId) {
        const { data: quote } = await supabase
            .from('estimator_quotes')
            .select('order_id')
            .eq('id', quoteId)
            .eq('org_id', profile.org_id)
            .maybeSingle()
        orderId = quote?.order_id ?? null
    }

    const { data: lot, error } = await supabase
        .from('fabric_stock_lots')
        .insert({
            org_id: profile.org_id,
            quality_label: parsed.data.quality_label,
            godown: parsed.data.godown,
            source_type: sourceType,
            market_run_id: marketRunId,
            order_id: orderId,
            quote_id: quoteId,
            original_taka_count: parsed.data.taka_count,
            available_taka_count: parsed.data.taka_count,
            meters_per_taka: parsed.data.meters_per_taka,
            unit_label: parsed.data.unit_label,
            original_meters: parsed.data.taka_count * parsed.data.meters_per_taka,
            available_meters: parsed.data.taka_count * parsed.data.meters_per_taka,
            stock_purpose: sourceType === 'market_run'
                ? 'sellable'
                : sourceType === 'order'
                    ? 'order_reserved'
                    : 'manual',
            cost_per_meter: parsed.data.cost_per_meter,
            received_date: parsed.data.received_date,
            notes: parsed.data.notes || null,
            created_by: user.id,
        })
        .select('id')
        .single()

    if (error || !lot) return { error: error?.message ?? 'Failed to create stock lot' }

    const { error: movementError } = await supabase
        .from('fabric_stock_movements')
        .insert({
            org_id: profile.org_id,
            stock_lot_id: lot.id,
            movement_type: 'inward',
            movement_date: parsed.data.received_date,
            taka_delta: parsed.data.taka_count,
            meters_delta: parsed.data.taka_count * parsed.data.meters_per_taka,
            reference: sourceType === 'opening' ? 'Opening stock' : 'Stock inward',
            notes: parsed.data.notes || null,
            created_by: user.id,
        })

    if (movementError) return { error: movementError.message }

    revalidatePath('/owner/stock')
    revalidatePath('/owner/commercials')
    return { success: true }
}

export async function confirmStockInwardDraft(input: unknown) {
    const parsed = safeParse(ConfirmStockInwardDraftSchema, input)
    if ('error' in parsed) return parsed

    await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('confirm_stock_inward_draft', {
        p_draft_id: parsed.data.draft_id,
        p_actual_unit_count: parsed.data.actual_unit_count,
        p_meters_per_unit: parsed.data.meters_per_unit,
        p_godown: parsed.data.godown,
        p_unit_label: parsed.data.unit_label,
        p_notes: parsed.data.notes || null,
    })

    if (error) return { error: error.message }

    revalidatePath('/owner/stock')
    revalidatePath('/owner/market-runs')
    revalidatePath('/owner/orders')
    revalidatePath('/owner/commercials')
    return { success: true, result: data?.[0] ?? null }
}

export async function dismissStockInwardDraft(input: unknown) {
    const { profile } = await requireRole(['owner'])
    const parsed = safeParse(DismissStockInwardDraftSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { error } = await supabase
        .from('fabric_stock_inward_drafts')
        .update({
            status: 'dismissed',
            notes: parsed.data.notes || null,
        })
        .eq('id', parsed.data.draft_id)
        .eq('org_id', profile.org_id)
        .eq('status', 'pending')

    if (error) return { error: error.message }

    revalidatePath('/owner/stock')
    return { success: true }
}

export async function recordTakaStockSale(input: unknown) {
    const parsed = safeParse(RecordTakaStockSaleSchema, input)
    if ('error' in parsed) return parsed

    await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('record_fabric_stock_sale', {
        p_stock_lot_id: parsed.data.stock_lot_id,
        p_taka_sold: parsed.data.taka_sold,
        p_price_per_meter: parsed.data.price_per_meter,
        p_sale_date: parsed.data.sale_date,
        p_notes: parsed.data.notes || null,
    })

    if (error) return { error: error.message }

    revalidatePath('/owner/stock')
    revalidatePath('/owner/commercials')
    return { success: true, result: data?.[0] ?? null }
}

export async function adjustTakaStockLot(input: unknown) {
    const parsed = safeParse(AdjustTakaStockLotSchema, input)
    if ('error' in parsed) return parsed

    await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('adjust_fabric_stock_lot', {
        p_stock_lot_id: parsed.data.stock_lot_id,
        p_adjustment_mode: parsed.data.adjustment_mode,
        p_taka_count: parsed.data.taka_count,
        p_notes: parsed.data.notes,
    })

    if (error) return { error: error.message }

    revalidatePath('/owner/stock')
    revalidatePath('/owner/commercials')
    return { success: true, result: data?.[0] ?? null }
}

export async function createFabricPackage(input: unknown) {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const parsed = safeParse(CreateFabricPackageSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', parsed.data.order_id)
        .eq('org_id', profile.org_id)
        .single()

    if (orderError || !order) return { error: 'Order not found' }

    const stockState = deriveStockState(parsed.data.inspection_status)

    const { error } = await supabase
        .from('fabric_packages')
        .insert({
            org_id: profile.org_id,
            order_id: parsed.data.order_id,
            package_no: parsed.data.package_no || null,
            package_type: parsed.data.package_type,
            units_count: parsed.data.units_count,
            metres: parsed.data.metres,
            grade: parsed.data.grade,
            inspection_status: parsed.data.inspection_status,
            stock_state: stockState,
            location: parsed.data.location,
            inspection_notes: parsed.data.inspection_notes || null,
            inspection_photo_url: parsed.data.inspection_photo_url || null,
            source_date: parsed.data.source_date || null,
            source_shift: parsed.data.source_shift || null,
            source_reference: parsed.data.source_reference || null,
            created_by: user.id,
            inspected_at: parsed.data.inspection_status === 'pending' ? null : new Date().toISOString(),
            inspected_by: parsed.data.inspection_status === 'pending' ? null : user.id,
        })

    if (error) return { error: error.message }

    revalidatePath('/owner/inventory')
    revalidatePath('/owner/orders')
    revalidatePath('/owner/dispatches')
    return { success: true }
}

export async function updateFabricInspection(input: unknown) {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const parsed = safeParse(UpdateFabricInspectionSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()

    const { data: current, error: fetchError } = await supabase
        .from('fabric_packages')
        .select('id, stock_state')
        .eq('id', parsed.data.package_id)
        .eq('org_id', profile.org_id)
        .single()

    if (fetchError || !current) return { error: 'Package not found' }

    const stockState = deriveStockState(parsed.data.inspection_status, current.stock_state as FabricPackageRow['stock_state'])

    const { error } = await supabase
        .from('fabric_packages')
        .update({
            inspection_status: parsed.data.inspection_status,
            grade: parsed.data.grade,
            location: parsed.data.location,
            inspection_notes: parsed.data.inspection_notes || null,
            inspection_photo_url: parsed.data.inspection_photo_url || null,
            stock_state: stockState,
            inspected_at: new Date().toISOString(),
            inspected_by: user.id,
        })
        .eq('id', parsed.data.package_id)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath('/owner/inventory')
    revalidatePath('/owner/orders')
    revalidatePath('/owner/dispatches')
    return { success: true }
}

export async function updateFabricPackageState(input: unknown) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const parsed = safeParse(UpdateFabricPackageStateSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data: current, error: fetchError } = await supabase
        .from('fabric_packages')
        .select('id, inspection_status, stock_state')
        .eq('id', parsed.data.package_id)
        .eq('org_id', profile.org_id)
        .single()

    if (fetchError || !current) return { error: 'Package not found' }

    const existingState = current.stock_state as FabricPackageRow['stock_state']
    const nextState = parsed.data.stock_state

    if (existingState === 'dispatched') {
        return { error: 'Dispatched packages cannot be changed here' }
    }

    if (nextState === 'ready' || nextState === 'reserved') {
        if (!['pass', 'minor_defect'].includes(current.inspection_status)) {
            return { error: 'Inspect the package before marking it ready or reserved' }
        }
    }

    if (existingState === 'claimed' && !['claimed', 'returned'].includes(nextState)) {
        return { error: 'Claimed packages can only be marked returned' }
    }

    const { error } = await supabase
        .from('fabric_packages')
        .update({ stock_state: nextState })
        .eq('id', parsed.data.package_id)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath('/owner/inventory')
    revalidatePath('/owner/orders')
    revalidatePath('/owner/dispatches')
    return { success: true }
}

export async function correctFabricPackageMetres(input: unknown) {
    const { user, profile } = await requireRole(['owner'])
    const parsed = safeParse(CorrectFabricPackageMetersSchema, input)
    if ('error' in parsed) return parsed

    const supabase = await createServerClient()
    const { data: current, error: fetchError } = await supabase
        .from('fabric_packages')
        .select('id, stock_state')
        .eq('id', parsed.data.package_id)
        .eq('org_id', profile.org_id)
        .single()

    if (fetchError || !current) return { error: 'Package not found' }

    if (['dispatched', 'claimed'].includes(current.stock_state)) {
        return { error: 'Already dispatched packages cannot be corrected' }
    }

    const { error } = await supabase
        .from('fabric_packages')
        .update({
            metres: parsed.data.metres,
            correction_note: parsed.data.correction_note,
            corrected_at: new Date().toISOString(),
            corrected_by: user.id,
        })
        .eq('id', parsed.data.package_id)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath('/owner/inventory')
    revalidatePath('/owner/orders')
    revalidatePath('/owner/dispatches')
    return { success: true }
}
