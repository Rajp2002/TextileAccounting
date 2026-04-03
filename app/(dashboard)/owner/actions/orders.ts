'use server'

import { createClient } from '@/lib/supabase/server'
import { parseJWT } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function assignMachinesToOrder(
  orderId: string,
  machineIds: string[]
) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return { error: 'Unauthorized' }

  const { org_id, user_role } = parseJWT(session.access_token)

  if (user_role !== 'owner') return { error: 'Unauthorized' }

  // Fetch the order's quality_id
  const { data: order } = await supabase
    .from('orders')
    .select('quality_id')
    .eq('id', orderId)
    .single()

  if (!order) return { error: 'Order not found' }

  // Check its current beam's quality matches
  const { data: incompatible } = await supabase
    .from('machines')
    .select('id, name, yarn_batches!inner(quality_id)')
    .in('id', machineIds)
    .neq('yarn_batches.quality_id', order.quality_id)

  if (incompatible && incompatible.length > 0) {
    return {
      error: `${incompatible.map(m => m.name).join(', ')} has a different quality loaded`
    }
  }

  // Validate all machines belong to this org
  if (machineIds.length > 0) {
    const { data: machines } = await supabase
      .from('machines')
      .select('id')
      .in('id', machineIds)
      .eq('org_id', org_id)

    if (machines?.length !== machineIds.length) {
      return { error: 'One or more machines not found' }
    }
  }

  // Unlink all machines currently on this order first
  await supabase
    .from('machines')
    .update({ current_order_id: null })
    .eq('current_order_id', orderId)
    .eq('org_id', org_id)

  // Link the selected machines
  if (machineIds.length > 0) {
    await supabase
      .from('machines')
      .update({ current_order_id: orderId })
      .in('id', machineIds)
      .eq('org_id', org_id)
  }

  revalidatePath('/owner/analytics')
  return { success: true }
}
