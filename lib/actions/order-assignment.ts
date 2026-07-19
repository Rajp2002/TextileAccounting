import type { SupabaseClient } from '@supabase/supabase-js'

export type AssignmentResult = { success: true; error?: never } | { success?: false; error: string }

interface OrderQualityRow {
    quality_id: string | null
    status: string
}

interface MachineNameRow {
    id: string
    name: string
}

export async function assignMachinesToOrderForOrg(
    supabase: SupabaseClient,
    orgId: string,
    orderId: string,
    machineIds: string[],
): Promise<AssignmentResult> {
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('quality_id, status')
        .eq('id', orderId)
        .eq('org_id', orgId)
        .single<OrderQualityRow>()

    if (orderError || !order) return { error: 'Order not found' }
    if (order.status !== 'active') return { error: 'Only active orders can be assigned to machines' }

    if (machineIds.length > 0) {
        const { data: machines, error: machineFetchError } = await supabase
            .from('machines')
            .select('id, name')
            .in('id', machineIds)
            .eq('org_id', orgId)

        if (machineFetchError) return { error: machineFetchError.message }
        if ((machines ?? []).length !== machineIds.length) return { error: 'One or more machines not found' }

        if (order.quality_id) {
            const { data: incompatible, error: incompatibleError } = await supabase
                .from('machines')
                .select('id, name, yarn_batches!inner(quality_id)')
                .in('id', machineIds)
                .eq('org_id', orgId)
                .neq('yarn_batches.quality_id', order.quality_id)

            if (incompatibleError) return { error: incompatibleError.message }

            if ((incompatible ?? []).length > 0) {
                const incompatibleNames = (incompatible as MachineNameRow[]).map((machine) => machine.name).join(', ')
                return { error: `${incompatibleNames} has a different quality loaded` }
            }
        }
    }

    const { error: unlinkError } = await supabase
        .from('machines')
        .update({ current_order_id: null, status: 'inactive' })
        .eq('current_order_id', orderId)
        .eq('org_id', orgId)

    if (unlinkError) return { error: unlinkError.message }

    if (machineIds.length > 0) {
        const { error: linkError } = await supabase
            .from('machines')
            .update({ current_order_id: orderId })
            .in('id', machineIds)
            .eq('org_id', orgId)

        if (linkError) return { error: linkError.message }
    }

    return { success: true }
}
