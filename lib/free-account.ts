import 'server-only'
import { cache } from 'react'
import { createAdminClient } from './supabase/admin'

export type FreeGrant = { subjectId: string; state: 'active' | 'pending' | 'suspended' }
export const getFreeGrant = cache(async (orgId: string): Promise<FreeGrant | null> => {
  const admin = createAdminClient()
  const { data, error } = await admin.from('free_account_grants')
    .select('subject_id, revoked_at, free_account_subjects(active, verified_at, beta_allowed)')
    .eq('org_id', orgId).maybeSingle()
  // Compatibility for code deployed before the additive migration. All other
  // lookup failures are retryable errors, never grants or account rewrites.
  if (error?.code === '42P01' || error?.code === 'PGRST205') return null
  if (error) throw new Error('FREE_ACCESS_LOOKUP_FAILED')
  if (!data) return null
  const subject = Array.isArray(data.free_account_subjects) ? data.free_account_subjects[0] : data.free_account_subjects
  if (!subject) throw new Error('FREE_ACCESS_LOOKUP_FAILED')
  return {
    subjectId: data.subject_id,
    state: data.revoked_at || !subject.active || !subject.beta_allowed ? 'suspended'
      : !subject.verified_at ? 'pending' : 'active',
  }
})

export async function getFreeRollout() {
  const { data, error } = await createAdminClient().from('free_rollout')
    .select('enrollment_enabled, estimation_enabled, tour_enabled, free_quota_policies(*)').eq('singleton', true).single()
  if (error || !data) throw new Error('FREE_PAUSED')
  const policy = Array.isArray(data.free_quota_policies) ? data.free_quota_policies[0] : data.free_quota_policies
  if (!policy) throw new Error('FREE_PAUSED')
  return { ...data, policy }
}

export async function canEnrollFree(email: string) {
  // Beta only. Public enrollment requires a separately reviewed change.
  const emails = (process.env.WEAVLY_FREE_BETA_EMAILS ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean)
  if (!emails.includes(email.trim().toLowerCase())) return false
  try { return (await getFreeRollout()).enrollment_enabled === true } catch { return false }
}

/** Only called with the Auth-verified user and DB-verified owner profile. */
export async function finishFreeProvisioning(user: { id: string; email?: string; email_confirmed_at?: string; app_metadata: Record<string, unknown> }, orgId: string) {
  if (user.app_metadata.free_signup !== true) return false
  const existing = await getFreeGrant(orgId)
  if (existing) return true
  if (!user.email || !user.email_confirmed_at || !await canEnrollFree(user.email)) return false
  const { error } = await createAdminClient().rpc('provision_free_account', {
    p_user_id: user.id, p_org_id: orgId, p_verified_at: user.email_confirmed_at,
  })
  if (error) throw new Error('FREE_PROVISIONING_PENDING')
  return true
}
