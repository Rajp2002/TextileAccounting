import type { FreeSupportingKey } from './i18n/free-supporting'

/** Display existing access facts without granting or changing access. */
export function freeBillingPresentation(tier: string, grantState: string | undefined): { planName: string; status: 'active' | 'pending' | 'locked' | 'expired'; statusKey: FreeSupportingKey; noticeKey?: FreeSupportingKey; freeActive: boolean } {
  if (tier === 'lite' || tier === 'base') return { planName: `Weavly ${tier === 'lite' ? 'Lite' : 'Base'}`, status: 'active', statusKey: 'active', freeActive: false }
  if (grantState === 'suspended') return { planName: 'Weavly Free', status: 'locked', statusKey: 'suspended', noticeKey: 'suspendedBody', freeActive: false }
  if (grantState === 'pending') return { planName: 'Weavly Free', status: 'pending', statusKey: 'pendingAccess', noticeKey: 'pendingBody', freeActive: false }
  if (tier === 'free' && grantState === 'active') return { planName: 'Weavly Free', status: 'active', statusKey: 'active', freeActive: true }
  if (tier === 'none' && grantState === 'active') return { planName: 'Weavly Free', status: 'expired', statusKey: 'expired', noticeKey: 'expiredBody', freeActive: false }
  return { planName: 'Weavly Free', status: 'pending', statusKey: 'unavailable', noticeKey: 'unavailableBody', freeActive: false }
}
