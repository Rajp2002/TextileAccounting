'use server'

import { getAuthenticatedUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { assignMachinesToOrderForOrg, type AssignmentResult } from '@/lib/actions/order-assignment'

export async function assignMachinesToOrder(
  orderId: string,
  machineIds: string[]
): Promise<AssignmentResult> {
  const { supabase, profile } = await getAuthenticatedUser()

  if (profile.role !== 'owner') return { error: 'Unauthorized' }

  const assignmentResult = await assignMachinesToOrderForOrg(supabase, profile.org_id, orderId, machineIds)
  if ('error' in assignmentResult) return assignmentResult

  revalidatePath('/owner/analytics')
  return { success: true }
}
