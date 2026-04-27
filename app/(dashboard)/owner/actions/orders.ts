'use server'

import { createClient } from '@/lib/supabase/server'
import { parseJWT } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { assignMachinesToOrderForOrg, type AssignmentResult } from '@/lib/actions/order-assignment'

export async function assignMachinesToOrder(
  orderId: string,
  machineIds: string[]
): Promise<AssignmentResult> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return { error: 'Unauthorized' }

  const { org_id, user_role } = parseJWT(session.access_token)

  if (user_role !== 'owner') return { error: 'Unauthorized' }

  const assignmentResult = await assignMachinesToOrderForOrg(supabase, org_id, orderId, machineIds)
  if ('error' in assignmentResult) return assignmentResult

  revalidatePath('/owner/analytics')
  return { success: true }
}
