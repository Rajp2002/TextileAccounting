'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { checkAccessCodeRateLimit, checkAccessCodeLockout, recordAccessCodeFailure, resetAccessCodeFailures } from '@/lib/rate-limit'
import { assignMachinesToOrderForOrg, type AssignmentResult } from '@/lib/actions/order-assignment'
import { CreateFabricDispatchSchema, safeParse } from '@/lib/schemas'
import { shouldArchiveDispatchGroup } from '@/lib/dispatch/archive'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OrderStatus = 'active' | 'completed' | 'cancelled'

export interface OrderSummary {
    id: string
    party_name: string
    quality_label: string | null
    quality_id: string | null
    warp_instruction: string | null
    weft_instruction: string | null
    notes: string | null
    total_target_meters: number
    start_date: string
    deadline: string
    status: OrderStatus
    created_at: string
    worker_rate_per_m: number | null
}

type UpdatableOrderFields = {
    party_name?: string
    quality_label?: string
    warp_instruction?: string
    weft_instruction?: string
    notes?: string
    total_target_meters?: number
    deadline?: string
}

type UpdatableOrderPayload = UpdatableOrderFields & { status?: OrderStatus }

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getOrdersWithProgress() {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('order_progress_summary')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('status', 'active')
        .order('deadline', { ascending: true })

    if (error) return { error: error.message }
    return { data: data ?? [] }
}

export async function getArchivedOrders() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('order_progress_summary')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('status', 'completed')
        .order('deadline', { ascending: false })

    if (error) return { error: error.message }
    return { data: data ?? [] }
}

export async function getActiveOrders() {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('orders')
        .select('id, party_name, quality_label, quality_id, warp_instruction, weft_instruction, notes, total_target_meters, start_date, deadline, status, created_at, worker_rate_per_m')
        .eq('org_id', profile.org_id)
        .eq('status', 'active')
        .order('deadline', { ascending: true })

    if (error) return { error: error.message }
    return { data: data ?? [] }
}

// ─── Write ─────────────────────────────────────────────────────────────────────



export async function updateOrderStatus(orderId: string, status: OrderStatus) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    // If order is completed or cancelled, unlink all machines assigned to it and set them to inactive
    if (status === 'completed' || status === 'cancelled') {
        await supabase
            .from('machines')
            .update({ current_order_id: null, status: 'inactive' })
            .eq('current_order_id', orderId)
            .eq('org_id', profile.org_id)
    }

    revalidatePath('/owner/orders')
    revalidatePath('/owner/archive')
    revalidatePath('/owner/analytics')
    return { success: true }
}

// ─── Access Code Validation (owner-side) ─────────────────────────────────────

async function validateOwnerAccessCode(userId: string, orgId: string, inputCode: string): Promise<boolean> {
    const isLockedOut = await checkAccessCodeLockout(userId)
    if (isLockedOut) throw new Error('Account temporarily locked due to too many failed attempts. Try again in 1 hour.')

    const rl = await checkAccessCodeRateLimit(userId)
    if (rl) throw new Error(`Too many attempts. Try again in ${Math.ceil(rl / 1000)} seconds.`)

    if (!inputCode || inputCode.length !== 6) {
        await recordAccessCodeFailure(userId)
        return false
    }

    const supabase = await createServerClient()
    const { data: org, error } = await supabase
        .from('organizations')
        .select('access_code_hash, access_code_expires_at')
        .eq('id', orgId)
        .single()

    if (error || !org || !org.access_code_hash) {
        await recordAccessCodeFailure(userId)
        return false
    }

    if (new Date(org.access_code_expires_at) < new Date()) {
        await recordAccessCodeFailure(userId)
        return false
    }

    const inputHash = crypto.createHash('sha256').update(inputCode.toUpperCase()).digest('hex')
    const isValid = crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(org.access_code_hash, 'hex'))
    if (!isValid) {
        await recordAccessCodeFailure(userId)
        return false
    }

    // Consume the code
    await supabase
        .from('organizations')
        .update({ access_code_hash: null, access_code_expires_at: null })
        .eq('id', orgId)

    await resetAccessCodeFailures(userId)
    return true
}

// ─── Request a new access code (owner can call this too) ──────────────────────

export async function requestAccessCodeAsOwner() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const code = crypto.randomBytes(3).toString('hex').toUpperCase()
    const hash = crypto.createHash('sha256').update(code).digest('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error } = await supabase
        .from('organizations')
        .update({ access_code_hash: hash, access_code_expires_at: expiresAt })
        .eq('id', profile.org_id)

    if (error) return { error: 'Failed to generate code. Please try again.' }

    // Return the code directly to the owner (they are the owner viewing the dashboard)
    return { success: true, code }
}

export async function updateOrderDetails(orderId: string, data: {
    party_name?: string
    quality_label?: string
    warp_instruction?: string
    weft_instruction?: string
    notes?: string
    total_target_meters?: number
    deadline?: string
}, accessCode: string) {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Validate access code
    let isCodeValid = false
    try {
        isCodeValid = await validateOwnerAccessCode(user.id, profile.org_id, accessCode)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to validate access code'
        return { error: message }
    }
    if (!isCodeValid) return { error: 'Invalid or expired access code' }

    // Fetch current order state before updating
    const { data: currentOrder } = await supabase
        .from('orders')
        .select('status, total_target_meters')
        .eq('id', orderId)
        .eq('org_id', profile.org_id)
        .single()

    const updatePayload: UpdatableOrderPayload = { ...data }

    // If target is being increased on a completed order, reactivate it
    if (
        data.total_target_meters !== undefined &&
        currentOrder?.status === 'completed' &&
        data.total_target_meters > Number(currentOrder.total_target_meters)
    ) {
        updatePayload.status = 'active'
    }

    const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath('/owner/orders')
    revalidatePath('/owner/archive')
    revalidatePath('/owner/analytics')
    return { success: true, reactivated: updatePayload.status === 'active' }
}

export async function deleteOrder(orderId: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    // Unlink all machines assigned to this order and set them to inactive
    await supabase
        .from('machines')
        .update({ current_order_id: null, status: 'inactive' })
        .eq('current_order_id', orderId)
        .eq('org_id', profile.org_id)

    revalidatePath('/owner/orders')
    return { success: true }
}

// ─── Order With Quote ─────────────────────────────────────────────────────────

export async function getOrderWithQuote(orderId: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Fetch order progress row
    const { data: order, error: orderError } = await supabase
        .from('order_progress_summary')
        .select('*')
        .eq('order_id', orderId)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (orderError) return { error: orderError.message }
    if (!order) return { error: 'Order not found' }

    // Fetch linked quote (if any) — joined via estimator_quotes.order_id
    const { data: quote } = await supabase
        .from('estimator_quotes')
        .select('*')
        .eq('order_id', orderId)
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    // Fetch active machines for assignment
    const { data: machines } = await supabase
        .from('machines')
        .select('id, name, current_order_id, status, linked_order:orders(status)')
        .eq('org_id', profile.org_id)
        .eq('status', 'active')
        .order('name', { ascending: true })

    const normalizedMachines = (machines ?? []).map((machine) => ({
        ...machine,
        linked_order: Array.isArray(machine.linked_order)
            ? machine.linked_order[0] ?? null
            : machine.linked_order ?? null,
    }))

    return { order, quote: quote ?? null, machines: normalizedMachines }
}

export async function getActiveMachinesList() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('machines')
        .select('id, name, current_order_id, status, linked_order:orders(status)')
        .eq('org_id', profile.org_id)
        .eq('status', 'active')
        .order('name', { ascending: true })

    if (error) return { error: error.message }
    return {
        data: (data ?? []).map((machine) => ({
            ...machine,
            linked_order: Array.isArray(machine.linked_order)
                ? machine.linked_order[0] ?? null
                : machine.linked_order ?? null,
        }))
    }
}

/** Assign machines to an order */
export async function assignMachinesToOrder(orderId: string, machineIds: string[]): Promise<AssignmentResult> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const assignmentResult = await assignMachinesToOrderForOrg(supabase, profile.org_id, orderId, machineIds)
    if ('error' in assignmentResult) return assignmentResult

    revalidatePath('/owner/orders')
    return { success: true }
}

// ─── Dispatch Bridge ──────────────────────────────────────────────────────────

export interface DispatchRow {
    id: string
    dispatch_number: number
    qty_meters_sent: number
    qty_meters_received: number | null
    receipt_confirmed_by_owner: boolean
    receipt_confirmation_note: string | null
    receipt_confirmed_by: string | null
    status: 'in_transit' | 'delivered' | 'disputed'
    notes: string | null
    challan_number: string | null
    eway_bill_number: string | null
    eway_bill_required: boolean
    vehicle_number: string | null
    transporter_name: string | null
    transporter_id: string | null
    approximate_distance_km: number | null
    eway_bill_generated_at: string | null
    hsn_code: string | null
    taxable_value: number | null
    gst_percent: number | null
    cgst_amount: number | null
    sgst_amount: number | null
    igst_amount: number | null
    total_invoice_value: number | null
    dispatched_at: string
    received_at: string | null
    package_lines: DispatchPackageLine[]
}

export interface DispatchPackageLine {
    id: string
    package_id: string
    package_no: string
    package_type: 'roll' | 'bale' | 'package' | 'bulk'
    units_count: number
    grade: string
    inspection_status: 'pending' | 'pass' | 'minor_defect' | 'reject'
    location_snapshot: string | null
    qty_meters_sent: number
    qty_meters_received: number | null
}

export interface AvailableFabricPackage {
    id: string
    package_no: string
    package_type: 'roll' | 'bale' | 'package' | 'bulk'
    units_count: number
    metres: number
    grade: string
    inspection_status: 'pending' | 'pass' | 'minor_defect' | 'reject'
    stock_state: 'uninspected' | 'ready' | 'reserved' | 'dispatched' | 'claimed' | 'returned'
    location: string
    sale_value?: number
    price_per_meter?: number
}

type PendingStockSaleDispatchRow = {
    id: string
    sale_date: string
    taka_sold: number
    meters_sold: number
    price_per_meter: number
    revenue_amount: number
    dispatch_id: string | null
    pending_dispatch_meters?: number
    dispatched_meters?: number
    fabric_stock_lots: {
        quality_label: string
        godown: string
        order_id: string | null
        unit_label: string | null
    } | Array<{
        quality_label: string
        godown: string
        order_id: string | null
        unit_label: string | null
    }>
}

export interface DispatchSummary {
    dispatches: DispatchRow[]
    total_sent: number
    total_received: number
    shortage_meters: number
    meters_produced: number
    remaining_to_dispatch: number
    available_packages: AvailableFabricPackage[]
    packaged_total_meters: number
    packages_waiting_inspection_meters: number
    reserved_meters: number
}

export interface DispatchWithOrder {
    id: string
    dispatch_number: number
    qty_meters_sent: number
    qty_meters_received: number | null
    receipt_confirmed_by_owner: boolean
    receipt_confirmation_note: string | null
    receipt_confirmed_by: string | null
    status: 'in_transit' | 'delivered' | 'disputed'
    dispatched_at: string
    received_at: string | null
    notes: string | null
    eway_bill_number: string | null
    eway_bill_required: boolean
    vehicle_number: string | null
    transporter_name: string | null
    transporter_id: string | null
    approximate_distance_km: number | null
    eway_bill_generated_at: string | null
    hsn_code: string | null
    taxable_value: number | null
    gst_percent: number | null
    cgst_amount: number | null
    sgst_amount: number | null
    igst_amount: number | null
    total_invoice_value: number | null
    stock_sale_id?: string | null
    stock_sale?: {
        id: string
        sale_date: string
        meters_sold: number
        dispatched_meters: number
        pending_dispatch_meters: number
        party_name: string | null
        quality_label: string | null
        source_type: string | null
        market_run_id: string | null
        market_run_label: string | null
        market_run_status: string | null
        order_id: string | null
        order_party_name: string | null
        order_quality_label: string | null
        order_status: string | null
    } | null
    party_name?: string | null
    party_phone?: string | null
    party_city?: string | null
    challan_number?: string | null
    package_lines: DispatchPackageLine[]
    orders: {
        id: string
        party_name: string
        quality_label: string | null
        tracking_token: string
        total_target_meters: number
        status: string
    }
}

export type DispatchListScope = 'active' | 'archived' | 'all'

export interface ArchivedDispatchGroup {
    id: string
    partyName: string
    qualityLabel: string | null
    sourceType: 'order' | 'market_run' | 'stock_sale'
    sourceId: string | null
    sourceLabel: string
    sourceStatus: string | null
    sourceIsActive: boolean
    totalSaleMeters: number
    totalDispatchedMeters: number
    totalConfirmedMeters: number
    pendingDispatchMeters: number
    batchCount: number
    lastDispatchedAt: string
    lastReceivedAt: string | null
    hasOpenDiscrepancy: boolean
    hasEwayGap: boolean
    dispatches: DispatchWithOrder[]
}

export interface DispatchOverviewStats {
    pending_sales_count: number
    pending_dispatch_meters: number
    pending_dispatch_value: number
    open_discrepancy_count: number
    open_discrepancy_meters: number
}

type DispatchesResult =
    | { data: DispatchWithOrder[]; error?: never }
    | { data?: never; error: string }

type DispatchOverviewResult =
    | { data: DispatchOverviewStats; error?: never }
    | { data?: never; error: string }

type RawRelatedMarketRun = {
    id: string
    fabric_label: string | null
    quality_label: string | null
    status: string | null
}

type RawRelatedOrder = {
    id: string
    party_name: string | null
    quality_label: string | null
    status: string | null
}

type RawStockSaleLot = {
    quality_label: string | null
    source_type: string | null
    market_run_id: string | null
    order_id: string | null
    market_runs?: RawRelatedMarketRun | RawRelatedMarketRun[] | null
    orders?: RawRelatedOrder | RawRelatedOrder[] | null
}

type RawDispatchStockSale = Omit<NonNullable<DispatchWithOrder['stock_sale']>, 'quality_label'> & {
    fabric_stock_lots?: RawStockSaleLot | RawStockSaleLot[] | null
}

type RawDispatchWithOrder = Omit<DispatchWithOrder, 'orders'> & {
    orders: DispatchWithOrder['orders'] | DispatchWithOrder['orders'][]
    stock_sale?: RawDispatchStockSale | RawDispatchStockSale[] | null
}

type RawDispatchRow = Omit<DispatchRow, 'package_lines'> & {
    dispatch_package_lines?: DispatchPackageLine[] | null
}

type MaybeSupabaseError = {
    code?: string
    message?: string
}

function normalizeDispatchRow(row: RawDispatchRow): DispatchRow {
    return {
        ...row,
        package_lines: row.dispatch_package_lines ?? [],
    }
}

function isMissingStockDiscrepanciesTable(error: MaybeSupabaseError | null | undefined) {
    return error?.code === '42P01'
        || error?.code === 'PGRST205'
        || /stock_discrepancies/i.test(error?.message ?? '') && /does not exist|schema cache|could not find/i.test(error?.message ?? '')
}

function getDispatchGroupId(dispatch: DispatchWithOrder) {
    return dispatch.stock_sale?.id ?? dispatch.stock_sale_id ?? dispatch.orders.id
}

function getDispatchSaleMeters(dispatch: DispatchWithOrder) {
    return Number(dispatch.stock_sale?.meters_sold ?? dispatch.orders.total_target_meters ?? dispatch.qty_meters_sent)
}

function getPendingDispatchMeters(dispatch: DispatchWithOrder) {
    return Number(dispatch.stock_sale?.pending_dispatch_meters ?? 0)
}

function buildDispatchArchiveGroups(
    dispatches: DispatchWithOrder[],
    openDiscrepancyDispatchIds: Set<string>
) {
    const groups = new Map<string, {
        dispatches: DispatchWithOrder[]
        totalSaleMeters: number
        totalDispatchedMeters: number
        pendingDispatchMeters: number
        hasUnconfirmedReceipt: boolean
        hasDisputedDispatch: boolean
        hasOpenDiscrepancy: boolean
        hasEwayGap: boolean
    }>()

    for (const dispatch of dispatches) {
        const groupId = getDispatchGroupId(dispatch)
        if (!groups.has(groupId)) {
            groups.set(groupId, {
                dispatches: [],
                totalSaleMeters: getDispatchSaleMeters(dispatch),
                totalDispatchedMeters: 0,
                pendingDispatchMeters: getPendingDispatchMeters(dispatch),
                hasUnconfirmedReceipt: false,
                hasDisputedDispatch: false,
                hasOpenDiscrepancy: false,
                hasEwayGap: false,
            })
        }

        const group = groups.get(groupId)!
        group.dispatches.push(dispatch)
        group.totalSaleMeters = Math.max(group.totalSaleMeters, getDispatchSaleMeters(dispatch))
        group.totalDispatchedMeters += Number(dispatch.qty_meters_sent ?? 0)
        group.pendingDispatchMeters = Math.max(group.pendingDispatchMeters, getPendingDispatchMeters(dispatch))
        group.hasUnconfirmedReceipt = group.hasUnconfirmedReceipt
            || dispatch.status === 'in_transit'
            || dispatch.qty_meters_received === null
        group.hasDisputedDispatch = group.hasDisputedDispatch || dispatch.status === 'disputed'
        group.hasOpenDiscrepancy = group.hasOpenDiscrepancy || openDiscrepancyDispatchIds.has(dispatch.id)
        group.hasEwayGap = group.hasEwayGap || Boolean(dispatch.eway_bill_required && !dispatch.eway_bill_number)
    }

    return groups
}

function filterDispatchesByScope(
    dispatches: DispatchWithOrder[],
    openDiscrepancyDispatchIds: Set<string>,
    scope: DispatchListScope
) {
    if (scope === 'all') return dispatches

    const groups = buildDispatchArchiveGroups(dispatches, openDiscrepancyDispatchIds)
    const archivedGroupIds = new Set<string>()

    for (const [groupId, group] of groups.entries()) {
        if (shouldArchiveDispatchGroup(group)) {
            archivedGroupIds.add(groupId)
        }
    }

    return dispatches.filter((dispatch) => {
        const isArchived = archivedGroupIds.has(getDispatchGroupId(dispatch))
        return scope === 'archived' ? isArchived : !isArchived
    })
}

/**
 * Fetch all dispatches for an order + shortage summary.
 * Authenticated — for the Weaver's internal Order Detail drawer.
 */
export async function getDispatchesForOrder(orderId: string): Promise<DispatchSummary | { error: string }> {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    // Verify the order belongs to this org
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, total_target_meters, quality_label')
        .eq('id', orderId)
        .eq('org_id', profile.org_id)
        .single()

    if (orderError || !order) return { error: 'Order not found' }

    // Fetch dispatches
    const { data: dispatches, error: dispatchError } = await supabase
        .from('dispatches')
        .select(`
            id,
            stock_sale_id,
            dispatch_number,
            qty_meters_sent,
            qty_meters_received,
            receipt_confirmed_by_owner,
            receipt_confirmation_note,
            receipt_confirmed_by,
            status,
            notes,
            challan_number,
            eway_bill_number,
            eway_bill_required,
            vehicle_number,
            transporter_name,
            transporter_id,
            approximate_distance_km,
            eway_bill_generated_at,
            hsn_code,
            taxable_value,
            gst_percent,
            cgst_amount,
            sgst_amount,
            igst_amount,
            total_invoice_value,
            dispatched_at,
            received_at,
            dispatch_package_lines (
                id,
                package_id,
                package_no,
                package_type,
                units_count,
                grade,
                inspection_status,
                location_snapshot,
                qty_meters_sent,
                qty_meters_received
            )
        `)
        .eq('order_id', orderId)
        .eq('org_id', profile.org_id)
        .order('dispatch_number', { ascending: true })

    if (dispatchError) return { error: dispatchError.message }

    const { data: saleRows, error: saleError } = await supabase
        .from('fabric_stock_sales')
        .select(`
            id,
            sale_date,
            taka_sold,
            meters_sold,
            price_per_meter,
            revenue_amount,
            dispatch_id,
            pending_dispatch_meters,
            dispatched_meters,
            fabric_stock_lots!inner (
                quality_label,
                godown,
                order_id,
                unit_label
            )
        `)
        .eq('org_id', profile.org_id)
        .gt('pending_dispatch_meters', 0)
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })

    if (saleError) return { error: saleError.message }

    // Fetch meters produced from production_logs
    const { data: prodData } = await supabase
        .from('production_logs')
        .select('meters')
        .eq('order_id', orderId)

    const metersProduced = (prodData ?? []).reduce((sum, row) => sum + Number(row.meters ?? 0), 0)

    // Compute summary
    const rows = ((dispatches ?? []) as RawDispatchRow[]).map(normalizeDispatchRow)
    const pendingSales = ((saleRows ?? []) as unknown as PendingStockSaleDispatchRow[])
        .filter((sale) => {
            const lot = Array.isArray(sale.fabric_stock_lots) ? sale.fabric_stock_lots[0] : sale.fabric_stock_lots
            return lot?.order_id === orderId ||
                (
                    !lot?.order_id &&
                    Boolean(order.quality_label) &&
                    lot?.quality_label.trim().toLowerCase() === order.quality_label?.trim().toLowerCase()
                )
        })
    const availablePackages: AvailableFabricPackage[] = pendingSales.map((sale) => {
        const lot = Array.isArray(sale.fabric_stock_lots) ? sale.fabric_stock_lots[0] : sale.fabric_stock_lots
        const unitLabel = lot?.unit_label || 'taka'
        const pendingMeters = Number(sale.pending_dispatch_meters ?? sale.meters_sold ?? 0)
        const avgMetersPerTaka = Number(sale.meters_sold ?? 0) / (Number(sale.taka_sold) || 1)
        const estimatedPendingTakas = Math.max(1, Math.round(pendingMeters / (avgMetersPerTaka || 1)))

        return {
            id: sale.id,
            package_no: `${lot?.quality_label || 'Stock sale'} · ${new Date(sale.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`,
            package_type: 'bulk',
            units_count: estimatedPendingTakas,
            metres: pendingMeters,
            grade: 'Sold',
            inspection_status: 'pass',
            stock_state: 'reserved',
            location: `${lot?.godown || 'Godown'} · ${estimatedPendingTakas} ${unitLabel}`,
            sale_value: Number(sale.price_per_meter ?? 0) * pendingMeters,
            price_per_meter: Number(sale.price_per_meter ?? 0),
        }
    })
    const totalSent = rows.reduce((s, d) => s + Number(d.qty_meters_sent), 0)
    const totalReceived = rows
        .filter(d => d.status === 'delivered')
        .reduce((s, d) => s + Number(d.qty_meters_received ?? 0), 0)
    const shortageMters = totalSent - totalReceived
    const remainingToDispatch = availablePackages.reduce((sum, pkg) => sum + Number(pkg.metres ?? 0), 0)
    const packagedTotalMeters = pendingSales.reduce((sum, sale) => sum + Number(sale.meters_sold ?? 0), 0)
    const packagesWaitingInspectionMeters = 0
    const reservedMeters = remainingToDispatch

    return {
        dispatches: rows,
        total_sent: totalSent,
        total_received: totalReceived,
        shortage_meters: shortageMters,
        meters_produced: metersProduced,
        remaining_to_dispatch: remainingToDispatch,
        available_packages: availablePackages,
        packaged_total_meters: packagedTotalMeters,
        packages_waiting_inspection_meters: packagesWaitingInspectionMeters,
        reserved_meters: reservedMeters,
    }
}

/**
 * Create a new dispatch entry for an order.
 * Atomically assigns the next dispatch number via RPC.
 * Returns the created dispatch. The challan number is stored only as an
 * internal reference from the user's own paperwork.
 */
export async function createDispatch(
    orderId: string,
    packageIds: string[],
    notes?: string,
    ewayDetails?: {
        eway_bill_number?: string
        vehicle_number?: string
        transporter_name?: string
        transporter_id?: string
        approximate_distance_km?: number | null
        eway_bill_generated_at?: string
    },
    dispatchMeters?: Record<string, number>,
    dispatchTakas?: Record<string, number>,
    dispatchDate?: string,
    challanNumber?: string
): Promise<{ dispatch: DispatchRow; dispatch_number: number } | { error: string }> {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()
    const parsed = safeParse(CreateFabricDispatchSchema, {
        order_id: orderId,
        package_ids: packageIds,
        challan_number: challanNumber ?? '',
        notes: notes ?? '',
        eway_bill_number: ewayDetails?.eway_bill_number ?? '',
        vehicle_number: ewayDetails?.vehicle_number ?? '',
        transporter_name: ewayDetails?.transporter_name ?? '',
        transporter_id: ewayDetails?.transporter_id ?? '',
        approximate_distance_km: ewayDetails?.approximate_distance_km ?? null,
        eway_bill_generated_at: ewayDetails?.eway_bill_generated_at ?? '',
    })
    if ('error' in parsed) return parsed

    // 1. Resolve custom meters/takas with DB fallbacks if not provided
    let finalMeters: number[] = []
    let finalTakas: number[] = []
    const finalDispatchDate = dispatchDate || new Date().toISOString().slice(0, 10)

    if (!dispatchMeters || !dispatchTakas) {
        const { data: sales } = await supabase
            .from('fabric_stock_sales')
            .select('id, pending_dispatch_meters, taka_sold')
            .in('id', packageIds)
        
        const metersMap: Record<string, number> = {}
        const takasMap: Record<string, number> = {}
        sales?.forEach(s => {
            metersMap[s.id] = Number(s.pending_dispatch_meters ?? 0)
            takasMap[s.id] = Number(s.taka_sold ?? 0)
        })
        finalMeters = packageIds.map(id => metersMap[id] ?? 0)
        finalTakas = packageIds.map(id => takasMap[id] ?? 0)
    } else {
        finalMeters = packageIds.map(id => dispatchMeters[id] ?? 0)
        finalTakas = packageIds.map(id => dispatchTakas[id] ?? 0)
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('create_stock_sale_dispatch', {
        p_org_id: profile.org_id,
        p_order_id: parsed.data.order_id,
        p_sale_ids: parsed.data.package_ids,
        p_dispatch_meters: finalMeters,
        p_dispatch_takas: finalTakas,
        p_dispatch_date: finalDispatchDate,
        p_notes: parsed.data.notes || null,
        p_eway_bill_number: parsed.data.eway_bill_number || null,
        p_vehicle_number: parsed.data.vehicle_number || null,
        p_transporter_name: parsed.data.transporter_name || null,
        p_transporter_id: parsed.data.transporter_id || null,
        p_approximate_distance_km: parsed.data.approximate_distance_km ?? null,
        p_eway_bill_generated_at: parsed.data.eway_bill_generated_at || null,
        p_created_by: user.id,
    })

    if (rpcError) return { error: rpcError.message }

    const dispatchMeta = Array.isArray(rpcData) ? rpcData[0] : rpcData
    if (!dispatchMeta?.dispatch_id) return { error: 'Failed to create dispatch' }

    const cleanedChallanNumber = parsed.data.challan_number?.trim() || null
    if (cleanedChallanNumber) {
        const { error: challanError } = await supabase
            .from('dispatches')
            .update({ challan_number: cleanedChallanNumber })
            .eq('id', dispatchMeta.dispatch_id)
            .eq('org_id', profile.org_id)

        if (challanError) return { error: challanError.message }
    }

    const { data: dispatch, error: dispatchError } = await supabase
        .from('dispatches')
        .select(`
            id,
            stock_sale_id,
            dispatch_number,
            qty_meters_sent,
            qty_meters_received,
            receipt_confirmed_by_owner,
            receipt_confirmation_note,
            receipt_confirmed_by,
            status,
            notes,
            challan_number,
            eway_bill_number,
            eway_bill_required,
            vehicle_number,
            transporter_name,
            transporter_id,
            approximate_distance_km,
            eway_bill_generated_at,
            hsn_code,
            taxable_value,
            gst_percent,
            cgst_amount,
            sgst_amount,
            igst_amount,
            total_invoice_value,
            dispatched_at,
            received_at,
            dispatch_package_lines (
                id,
                package_id,
                package_no,
                package_type,
                units_count,
                grade,
                inspection_status,
                location_snapshot,
                qty_meters_sent,
                qty_meters_received
            )
        `)
        .eq('id', dispatchMeta.dispatch_id)
        .eq('org_id', profile.org_id)
        .single()

    if (dispatchError || !dispatch) return { error: dispatchError?.message ?? 'Failed to load dispatch' }

    revalidatePath('/owner/orders')
    revalidatePath('/owner/dispatches')
    revalidatePath('/owner/stock')
    revalidatePath('/owner/archive')
    return {
        dispatch: normalizeDispatchRow(dispatch as RawDispatchRow),
        dispatch_number: dispatchMeta.dispatch_number,
    }
}

/**
 * Fetch all dispatches across all orders for the org.
 * Includes order total_target_meters and status for grouped progress view.
 */
export async function getAllDispatches(options: { scope?: DispatchListScope } = {}): Promise<DispatchesResult> {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()
    const scope = options.scope ?? 'active'

    const { data, error } = await supabase
        .from('dispatches')
        .select(`
            id,
            stock_sale_id,
            dispatch_number,
            qty_meters_sent,
            qty_meters_received,
            receipt_confirmed_by_owner,
            receipt_confirmation_note,
            receipt_confirmed_by,
            status,
            dispatched_at,
            received_at,
            notes,
            eway_bill_number,
            eway_bill_required,
            vehicle_number,
            transporter_name,
            transporter_id,
            approximate_distance_km,
            eway_bill_generated_at,
            hsn_code,
            taxable_value,
            gst_percent,
            cgst_amount,
            sgst_amount,
            igst_amount,
            total_invoice_value,
            party_name,
            party_phone,
            party_city,
            challan_number,
            stock_sale:fabric_stock_sales!dispatches_stock_sale_id_fkey (
                id,
                sale_date,
                meters_sold,
                dispatched_meters,
                pending_dispatch_meters,
                party_name,
                fabric_stock_lots (
                    quality_label,
                    source_type,
                    market_run_id,
                    order_id,
                    market_runs (
                        id,
                        fabric_label,
                        quality_label,
                        status
                    ),
                    orders (
                        id,
                        party_name,
                        quality_label,
                        status
                    )
                )
            ),
            dispatch_package_lines (
                id,
                package_id,
                package_no,
                package_type,
                units_count,
                grade,
                inspection_status,
                location_snapshot,
                qty_meters_sent,
                qty_meters_received
            ),
            orders (
                id,
                party_name,
                quality_label,
                tracking_token,
                total_target_meters,
                status
            )
        `)
        .eq('org_id', profile.org_id)
        .order('dispatched_at', { ascending: false })

    if (error) return { error: error.message }

    const rows = (data ?? []) as unknown as RawDispatchWithOrder[]
    const mappedDispatches = rows.map((row) => {
            const rawStockSale = Array.isArray(row.stock_sale) ? row.stock_sale[0] : row.stock_sale
            const rawStockSaleLot = Array.isArray(rawStockSale?.fabric_stock_lots)
                ? rawStockSale?.fabric_stock_lots[0]
                : rawStockSale?.fabric_stock_lots
            const rawMarketRun = Array.isArray(rawStockSaleLot?.market_runs)
                ? rawStockSaleLot?.market_runs[0]
                : rawStockSaleLot?.market_runs
            const rawOrder = Array.isArray(rawStockSaleLot?.orders)
                ? rawStockSaleLot?.orders[0]
                : rawStockSaleLot?.orders
            const stockSale = rawStockSale
                ? {
                    id: rawStockSale.id,
                    sale_date: rawStockSale.sale_date,
                    meters_sold: Number(rawStockSale.meters_sold ?? 0),
                    dispatched_meters: Number(rawStockSale.dispatched_meters ?? 0),
                    pending_dispatch_meters: Number(rawStockSale.pending_dispatch_meters ?? 0),
                    party_name: rawStockSale.party_name ?? null,
                    quality_label: rawStockSaleLot?.quality_label ?? null,
                    source_type: rawStockSaleLot?.source_type ?? null,
                    market_run_id: rawStockSaleLot?.market_run_id ?? null,
                    market_run_label: rawMarketRun?.fabric_label ?? rawMarketRun?.quality_label ?? null,
                    market_run_status: rawMarketRun?.status ?? null,
                    order_id: rawStockSaleLot?.order_id ?? null,
                    order_party_name: rawOrder?.party_name ?? null,
                    order_quality_label: rawOrder?.quality_label ?? null,
                    order_status: rawOrder?.status ?? null,
                }
                : null

            return {
                ...row,
                stock_sale: stockSale,
                package_lines: (row as unknown as RawDispatchRow).dispatch_package_lines ?? [],
                orders: (Array.isArray(row.orders) ? row.orders[0] : row.orders) ?? {
                    id: stockSale?.id ?? row.stock_sale_id ?? row.id,
                    party_name: stockSale?.party_name ?? row.party_name ?? 'Stock Sale Party',
                    quality_label: stockSale?.quality_label ?? null,
                    tracking_token: '',
                    total_target_meters: stockSale?.meters_sold ?? row.qty_meters_sent,
                    status: 'stock_sale',
                },
            }
    })

    const dispatchIds = mappedDispatches.map((dispatch) => dispatch.id)
    let openDiscrepancyDispatchIds = new Set<string>()
    if (dispatchIds.length > 0) {
        const { data: discrepancies, error: discrepancyError } = await supabase
            .from('stock_discrepancies')
            .select('dispatch_id')
            .eq('org_id', profile.org_id)
            .eq('status', 'needs_review')
            .in('dispatch_id', dispatchIds)

        if (discrepancyError && !isMissingStockDiscrepanciesTable(discrepancyError)) {
            return { error: discrepancyError.message }
        }

        openDiscrepancyDispatchIds = new Set(
            (discrepancies ?? [])
                .map((row) => row.dispatch_id)
                .filter((id): id is string => Boolean(id))
        )
    }

    return {
        data: filterDispatchesByScope(mappedDispatches, openDiscrepancyDispatchIds, scope),
    }
}

function getLatestIsoDate(values: Array<string | null | undefined>) {
    const timestamps = values
        .filter((value): value is string => Boolean(value))
        .map((value) => new Date(value).getTime())
        .filter((value) => Number.isFinite(value))

    if (timestamps.length === 0) return null
    return new Date(Math.max(...timestamps)).toISOString()
}

function getArchivedDispatchSource(dispatch: DispatchWithOrder): Pick<ArchivedDispatchGroup, 'sourceType' | 'sourceId' | 'sourceLabel' | 'sourceStatus' | 'sourceIsActive'> {
    const stockSale = dispatch.stock_sale

    if (stockSale?.market_run_id) {
        const status = stockSale.market_run_status
        return {
            sourceType: 'market_run',
            sourceId: stockSale.market_run_id,
            sourceLabel: stockSale.market_run_label ?? stockSale.quality_label ?? 'Market run sale',
            sourceStatus: status,
            sourceIsActive: !['closed', 'sold_out'].includes(status ?? ''),
        }
    }

    if (dispatch.orders.status !== 'stock_sale') {
        return {
            sourceType: 'order',
            sourceId: dispatch.orders.id,
            sourceLabel: dispatch.orders.quality_label
                ? `${dispatch.orders.party_name} - ${dispatch.orders.quality_label}`
                : dispatch.orders.party_name,
            sourceStatus: dispatch.orders.status,
            sourceIsActive: dispatch.orders.status === 'active',
        }
    }

    if (stockSale?.order_id) {
        const status = stockSale.order_status
        const party = stockSale.order_party_name ?? dispatch.orders.party_name
        const quality = stockSale.order_quality_label ?? stockSale.quality_label
        return {
            sourceType: 'order',
            sourceId: stockSale.order_id,
            sourceLabel: quality ? `${party} - ${quality}` : party,
            sourceStatus: status,
            sourceIsActive: status === 'active',
        }
    }

    return {
        sourceType: 'stock_sale',
        sourceId: stockSale?.id ?? dispatch.stock_sale_id ?? dispatch.id,
        sourceLabel: stockSale?.quality_label ?? dispatch.orders.quality_label ?? 'Stock sale',
        sourceStatus: 'completed',
        sourceIsActive: false,
    }
}

export async function getArchivedDispatchGroups(): Promise<{ data: ArchivedDispatchGroup[]; error?: string }> {
    const result = await getAllDispatches({ scope: 'archived' })
    if (result.error) return { data: [], error: result.error }

    const groups = new Map<string, DispatchWithOrder[]>()
    for (const dispatch of result.data ?? []) {
        const groupId = getDispatchGroupId(dispatch)
        const current = groups.get(groupId) ?? []
        current.push(dispatch)
        groups.set(groupId, current)
    }

    const archivedGroups = Array.from(groups.entries()).map(([id, dispatches]) => {
        const sortedDispatches = [...dispatches].sort((a, b) => {
            return new Date(b.dispatched_at).getTime() - new Date(a.dispatched_at).getTime()
        })
        const firstDispatch = sortedDispatches[0]
        const source = getArchivedDispatchSource(firstDispatch)
        const totalDispatchedMeters = sortedDispatches.reduce((sum, dispatch) => sum + Number(dispatch.qty_meters_sent ?? 0), 0)
        const totalConfirmedMeters = sortedDispatches.reduce((sum, dispatch) => sum + Number(dispatch.qty_meters_received ?? 0), 0)
        const totalSaleMeters = Math.max(...sortedDispatches.map(getDispatchSaleMeters), totalDispatchedMeters)
        const pendingDispatchMeters = Math.max(...sortedDispatches.map(getPendingDispatchMeters), 0)
        const lastDispatchedAt = getLatestIsoDate(sortedDispatches.map((dispatch) => dispatch.dispatched_at)) ?? firstDispatch.dispatched_at
        const lastReceivedAt = getLatestIsoDate(sortedDispatches.map((dispatch) => dispatch.received_at))

        return {
            id,
            partyName: firstDispatch.stock_sale?.party_name ?? firstDispatch.orders.party_name,
            qualityLabel: firstDispatch.stock_sale?.quality_label ?? firstDispatch.orders.quality_label,
            ...source,
            totalSaleMeters,
            totalDispatchedMeters,
            totalConfirmedMeters,
            pendingDispatchMeters,
            batchCount: sortedDispatches.length,
            lastDispatchedAt,
            lastReceivedAt,
            hasOpenDiscrepancy: false,
            hasEwayGap: false,
            dispatches: sortedDispatches,
        }
    })

    archivedGroups.sort((a, b) => new Date(b.lastDispatchedAt).getTime() - new Date(a.lastDispatchedAt).getTime())

    return { data: archivedGroups }
}

export async function getDispatchOverviewStats(): Promise<DispatchOverviewResult> {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const [salesRes, discrepanciesRes] = await Promise.all([
        supabase
            .from('fabric_stock_sales')
            .select('meters_sold, revenue_amount, pending_dispatch_meters, dispatch_status')
            .eq('org_id', profile.org_id)
            .in('dispatch_status', ['not_dispatched', 'partially_dispatched', 'discrepancy']),
        supabase
            .from('stock_discrepancies')
            .select('difference_meters')
            .eq('org_id', profile.org_id)
            .eq('status', 'needs_review'),
    ])

    if (salesRes.error) return { error: salesRes.error.message }
    if (discrepanciesRes.error && !isMissingStockDiscrepanciesTable(discrepanciesRes.error)) {
        return { error: discrepanciesRes.error.message }
    }

    const rows = salesRes.data ?? []
    const discrepancies = discrepanciesRes.error ? [] : discrepanciesRes.data ?? []
    return {
        data: {
            pending_sales_count: rows.length,
            pending_dispatch_meters: rows.reduce((sum, row) => sum + Number(row.pending_dispatch_meters ?? row.meters_sold ?? 0), 0),
            pending_dispatch_value: rows.reduce((sum, row) => sum + Number(row.revenue_amount ?? 0), 0),
            open_discrepancy_count: discrepancies.length,
            open_discrepancy_meters: discrepancies.reduce((sum, row) => sum + Math.abs(Number(row.difference_meters ?? 0)), 0),
        },
    }
}

export async function confirmDispatchReceiptByOwner(
    dispatchId: string,
    qtyReceived: number,
    note?: string
): Promise<{ success: true; qty_received: number } | { error: string }> {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    if (!Number.isFinite(qtyReceived) || qtyReceived < 0) {
        return { error: 'Enter a valid received quantity' }
    }

    const { data: dispatch, error: dispatchError } = await supabase
        .from('dispatches')
        .select(`
            id,
            org_id,
            order_id,
            qty_meters_sent
        `)
        .eq('id', dispatchId)
        .eq('org_id', profile.org_id)
        .single()

    if (dispatchError || !dispatch) {
        return { error: 'Dispatch not found' }
    }

    let resultQty = qtyReceived
    if (dispatch.order_id) {
        const { data: orderData } = await supabase
            .from('orders')
            .select('tracking_token')
            .eq('id', dispatch.order_id)
            .single()

        const trackingToken = orderData?.tracking_token
        if (!trackingToken) {
            return { error: 'Tracking link not found for this dispatch' }
        }

        const { data, error } = await supabase.rpc('confirm_fabric_dispatch_receipt', {
            p_dispatch_id: dispatchId,
            p_tracking_token: trackingToken,
            p_qty_received: qtyReceived,
        })
        if (error) {
            const message = error.message || 'Could not confirm receipt. Please try again.'
            if (message.includes('already been confirmed')) {
                return { error: 'Receipt already confirmed' }
            }
            if (message.includes('Enter a valid received quantity')) {
                return { error: 'Enter a valid received quantity' }
            }
            return { error: message }
        }
        const result = Array.isArray(data) ? data[0] : data
        resultQty = Number(result?.qty_received ?? qtyReceived)
    } else {
        const { data, error } = await supabase.rpc('confirm_stock_sale_dispatch_receipt_v1', {
            p_dispatch_id: dispatchId,
            p_qty_received: qtyReceived,
        })
        if (error) {
            const message = error.message || 'Could not confirm receipt. Please try again.'
            if (message.includes('already been confirmed')) {
                return { error: 'Receipt already confirmed' }
            }
            if (message.includes('Enter a valid received quantity')) {
                return { error: 'Enter a valid received quantity' }
            }
            return { error: message }
        }
        const result = Array.isArray(data) ? data[0] : data
        resultQty = Number(result?.qty_received ?? qtyReceived)
    }

    const { error: updateError } = await supabase
        .from('dispatches')
        .update({
            receipt_confirmed_by_owner: true,
            receipt_confirmation_note: note?.trim() || null,
            receipt_confirmed_by: user.id,
        })
        .eq('id', dispatchId)
        .eq('org_id', profile.org_id)

    if (updateError) {
        return { error: updateError.message }
    }

    revalidatePath('/owner/dispatches')
    revalidatePath('/owner/archive')

    return { success: true, qty_received: resultQty }
}

export interface PendingStockSale {
    id: string
    sale_date: string
    taka_sold: number
    meters_sold: number
    price_per_meter: number
    revenue_amount: number
    credit_days: number
    party_name: string
    party_phone: string | null
    party_city: string | null
    party_gstin: string | null
    quality_label: string
    godown: string
    unit_label: string
    dispatched_meters?: number
    pending_dispatch_meters?: number
}

type PendingStockSaleRow = Omit<PendingStockSale, 'quality_label' | 'godown' | 'unit_label'> & {
    fabric_stock_lots: {
        quality_label: string | null
        godown: string | null
        unit_label: string | null
    } | Array<{
        quality_label: string | null
        godown: string | null
        unit_label: string | null
    }>
}

export async function getPendingStockSales(): Promise<{ data: PendingStockSale[]; error?: string }> {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('fabric_stock_sales')
        .select(`
            id,
            sale_date,
            taka_sold,
            meters_sold,
            price_per_meter,
            revenue_amount,
            credit_days,
            party_name,
            party_phone,
            party_city,
            party_gstin,
            dispatched_meters,
            pending_dispatch_meters,
            fabric_stock_lots!inner (
                quality_label,
                godown,
                unit_label
            )
        `)
        .eq('org_id', profile.org_id)
        .gt('pending_dispatch_meters', 0)
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })

    if (error) return { error: error.message, data: [] }

    const formatted = ((data ?? []) as unknown as PendingStockSaleRow[]).map((row) => {
        const lot = Array.isArray(row.fabric_stock_lots) ? row.fabric_stock_lots[0] : row.fabric_stock_lots
        return {
            id: row.id,
            sale_date: row.sale_date,
            taka_sold: Number(row.taka_sold ?? 0),
            meters_sold: Number(row.meters_sold ?? 0),
            price_per_meter: Number(row.price_per_meter ?? 0),
            revenue_amount: Number(row.revenue_amount ?? 0),
            credit_days: Number(row.credit_days ?? 0),
            party_name: row.party_name ?? 'Stock Sale Party',
            party_phone: row.party_phone,
            party_city: row.party_city,
            party_gstin: row.party_gstin,
            quality_label: lot?.quality_label ?? 'Unknown Quality',
            godown: lot?.godown ?? 'Godown',
            unit_label: lot?.unit_label ?? 'taka',
            dispatched_meters: Number(row.dispatched_meters ?? 0),
            pending_dispatch_meters: Number(row.pending_dispatch_meters ?? 0),
        }
    })

    return { data: formatted }
}

export async function confirmPendingSaleDispatch(
    saleId: string,
    dispatchDate: string,
    transportName: string,
    vehicleNumber: string,
    challanNumber: string,
    dispatchMeters: number,
    dispatchTakas: number,
    notes: string
): Promise<{ success: boolean; dispatchId?: string; dispatchNumber?: number; message?: string }> {
    await requireRole(['owner'])
    const supabase = await createServerClient()

    if (!saleId) {
        return { success: false, message: 'Sale is required' }
    }
    if (!dispatchDate) {
        return { success: false, message: 'Dispatch date is required' }
    }
    if (!dispatchMeters || dispatchMeters <= 0) {
        return { success: false, message: 'Dispatch meters must be greater than 0' }
    }

    const { data, error } = await supabase.rpc('confirm_party_stock_sale_dispatch_v1', {
        p_sale_id: saleId,
        p_dispatch_date: dispatchDate,
        p_transport_name: transportName?.trim() || null,
        p_vehicle_number: vehicleNumber?.trim()?.toUpperCase() || null,
        p_challan_number: challanNumber?.trim() || null,
        p_dispatch_meters: dispatchMeters,
        p_dispatch_takas: dispatchTakas || null,
        p_notes: notes?.trim() || null,
    })

    if (error) {
        return { success: false, message: error.message || 'Failed to confirm dispatch' }
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result?.dispatch_id) {
        return { success: false, message: 'Dispatch was not created' }
    }

    revalidatePath('/owner/dispatches')
    revalidatePath('/owner/stock')
    revalidatePath('/owner/commercials')
    revalidatePath('/owner/archive')

    return {
        success: true,
        dispatchId: result.dispatch_id,
        dispatchNumber: Number(result.dispatch_number),
    }
}

export async function confirmPendingSaleReceived(
    saleId: string,
    dispatchDate: string,
    transportName: string,
    vehicleNumber: string,
    challanNumber: string,
    receivedMeters: number,
    notes: string
): Promise<{ success: boolean; dispatchId?: string; dispatchNumber?: number; message?: string }> {
    await requireRole(['owner'])
    const supabase = await createServerClient()

    if (!saleId) {
        return { success: false, message: 'Sale is required' }
    }
    if (!dispatchDate) {
        return { success: false, message: 'Dispatch date is required' }
    }
    if (receivedMeters <= 0) {
        return { success: false, message: 'Received meters must be greater than 0' }
    }

    const { data, error } = await supabase.rpc('confirm_party_stock_sale_received_v1', {
        p_sale_id: saleId,
        p_dispatch_date: dispatchDate,
        p_transport_name: transportName?.trim() || null,
        p_vehicle_number: vehicleNumber?.trim()?.toUpperCase() || null,
        p_challan_number: challanNumber?.trim() || null,
        p_received_meters: receivedMeters,
        p_notes: notes?.trim() || null,
    })

    if (error) {
        return { success: false, message: error.message || 'Failed to confirm receipt' }
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result?.dispatch_id) {
        return { success: false, message: 'Dispatch was not created' }
    }

    revalidatePath('/owner/dispatches')
    revalidatePath('/owner/stock')
    revalidatePath('/owner/commercials')
    revalidatePath('/owner/archive')

    return {
        success: true,
        dispatchId: result.dispatch_id,
        dispatchNumber: Number(result.dispatch_number),
    }
}
