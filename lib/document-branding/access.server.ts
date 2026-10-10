import 'server-only'

import { assertOrgWritable, requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'

export type BrandingAccessFailure = 'upgrade_required' | 'locked'

/**
 * The one server-side gate for changing branding: an owner of the verified
 * organization, whose plan includes document branding, in an organization
 * that is not locked. The org always comes from the database profile.
 */
export async function requireBrandingManager(): Promise<
  | { ok: true; userId: string; orgId: string }
  | { ok: false; code: BrandingAccessFailure }
> {
  const { user, profile } = await requireRole(['owner'])
  const access = await getCachedOrgPlanAccess(profile.org_id)
  if (!hasCapability(access.effectiveTier, 'document_branding')) return { ok: false, code: 'upgrade_required' }
  try {
    await assertOrgWritable(profile.org_id)
  } catch {
    return { ok: false, code: 'locked' }
  }
  return { ok: true, userId: user.id, orgId: profile.org_id }
}

/** Whether this organization's documents carry custom branding. */
export async function orgHasDocumentBranding(orgId: string) {
  const access = await getCachedOrgPlanAccess(orgId)
  return hasCapability(access.effectiveTier, 'document_branding')
}
