'use server'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
    CreateFabricPackageSchema,
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
