'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { checkAccessCodeRateLimit, checkAccessCodeLockout, recordAccessCodeFailure, resetAccessCodeFailures } from '@/lib/rate-limit'
import { assignMachinesToOrderForOrg, type AssignmentResult } from '@/lib/actions/order-assignment'
import { CreateFabricDispatchSchema, safeParse } from '@/lib/schemas'

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

    // If order is completed, unlink all machines assigned to it
    if (status === 'completed') {
        await supabase
            .from('machines')
            .update({ current_order_id: null })
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

    // Unlink all machines assigned to this order
    await supabase
        .from('machines')
        .update({ current_order_id: null })
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

    return { order, quote: quote ?? null, machines: machines ?? [] }
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
    return { data: data ?? [] }
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
    received_meters?: number | null
    receipt_confirmed_by_owner: boolean
    receipt_confirmation_note: string | null
    receipt_confirmed_by: string | null
    received_note?: string | null
    receipt_status?: 'not_confirmed' | 'matched' | 'difference_reported'
    status: 'in_transit' | 'delivered' | 'disputed'
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
    received_meters?: number | null
    receipt_confirmed_by_owner: boolean
    receipt_confirmation_note: string | null
    receipt_confirmed_by: string | null
    received_note?: string | null
    receipt_status?: 'not_confirmed' | 'matched' | 'difference_reported'
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

type RawDispatchWithOrder = Omit<DispatchWithOrder, 'orders'> & {
    orders: DispatchWithOrder['orders'] | DispatchWithOrder['orders'][]
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
            received_meters,
            receipt_confirmed_by_owner,
            receipt_confirmation_note,
            receipt_confirmed_by,
            received_note,
            receipt_status,
            status,
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
            fabric_stock_lots!inner (
                quality_label,
                godown,
                order_id,
                unit_label
            )
        `)
        .eq('org_id', profile.org_id)
        .is('dispatch_id', null)
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
        return {
            id: sale.id,
            package_no: `${lot?.quality_label || 'Stock sale'} · ${new Date(sale.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`,
            package_type: 'bulk',
            units_count: Number(sale.taka_sold ?? 0),
            metres: Number(sale.meters_sold ?? 0),
            grade: 'Sold',
            inspection_status: 'pass',
            stock_state: 'reserved',
            location: `${lot?.godown || 'Godown'} · ${Number(sale.taka_sold ?? 0)} ${unitLabel}`,
            sale_value: Number(sale.revenue_amount ?? 0),
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
 * Returns the created dispatch + tracking_token for invoice/challan PDF generation.
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
    }
): Promise<{ dispatch: DispatchRow; tracking_token: string; party_name: string; org_name: string; dispatch_number: number } | { error: string }> {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()
    const parsed = safeParse(CreateFabricDispatchSchema, {
        order_id: orderId,
        package_ids: packageIds,
        notes: notes ?? '',
        eway_bill_number: ewayDetails?.eway_bill_number ?? '',
        vehicle_number: ewayDetails?.vehicle_number ?? '',
        transporter_name: ewayDetails?.transporter_name ?? '',
        transporter_id: ewayDetails?.transporter_id ?? '',
        approximate_distance_km: ewayDetails?.approximate_distance_km ?? null,
        eway_bill_generated_at: ewayDetails?.eway_bill_generated_at ?? '',
    })
    if ('error' in parsed) return parsed

    const { data: rpcData, error: rpcError } = await supabase.rpc('create_stock_sale_dispatch', {
        p_org_id: profile.org_id,
        p_order_id: parsed.data.order_id,
        p_sale_ids: parsed.data.package_ids,
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

    const { data: dispatch, error: dispatchError } = await supabase
        .from('dispatches')
        .select(`
            id,
            dispatch_number,
            qty_meters_sent,
            qty_meters_received,
            received_meters,
            receipt_confirmed_by_owner,
            receipt_confirmation_note,
            receipt_confirmed_by,
            received_note,
            receipt_status,
            status,
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
    return {
        dispatch: normalizeDispatchRow(dispatch as RawDispatchRow),
        tracking_token: dispatchMeta.tracking_token,
        party_name: dispatchMeta.party_name,
        org_name: dispatchMeta.org_name ?? 'Factory',
        dispatch_number: dispatchMeta.dispatch_number,
    }
}

/**
 * Get the tracking token for an order — for the Share Modal.
 * Returns only the token and the full tracking URL.
 */
export async function getTrackingToken(orderId: string): Promise<{ tracking_token: string } | { error: string }> {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('orders')
        .select('tracking_token')
        .eq('id', orderId)
        .eq('org_id', profile.org_id)
        .single()

    if (error || !data) return { error: 'Order not found' }

    return {
        tracking_token: data.tracking_token,
    }
}

/**
 * Fetch all dispatches across all orders for the org.
 * Includes order total_target_meters and status for grouped progress view.
 */
export async function getAllDispatches(): Promise<DispatchesResult> {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('dispatches')
        .select(`
            id,
            dispatch_number,
            qty_meters_sent,
            qty_meters_received,
            received_meters,
            receipt_confirmed_by_owner,
            receipt_confirmation_note,
            receipt_confirmed_by,
            received_note,
            receipt_status,
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
    return {
        data: rows.map((row) => ({
            ...row,
            package_lines: (row as unknown as RawDispatchRow).dispatch_package_lines ?? [],
            orders: (Array.isArray(row.orders) ? row.orders[0] : row.orders) ?? {
                id: row.stock_sale_id ?? row.id,
                party_name: row.party_name ?? 'Stock Sale Party',
                quality_label: null,
                tracking_token: '',
                total_target_meters: row.qty_meters_sent,
                status: 'stock_sale',
            },
        })),
    }
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
            qty_meters_sent,
            orders!inner (
                tracking_token
            )
        `)
        .eq('id', dispatchId)
        .eq('org_id', profile.org_id)
        .single()

    if (dispatchError || !dispatch) {
        return { error: 'Dispatch not found' }
    }

    const orderData = Array.isArray(dispatch.orders) ? dispatch.orders[0] : dispatch.orders
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

    const result = Array.isArray(data) ? data[0] : data
    return { success: true, qty_received: Number(result?.qty_received ?? qtyReceived) }
}
