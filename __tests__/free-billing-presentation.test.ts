import { describe, expect, it } from 'vitest'
import { freeBillingPresentation } from '@/lib/free-billing-presentation'
import { freeSupportingText, type FreeSupportingKey } from '@/lib/i18n/free-supporting'

describe('Free billing uses verified access facts for presentation', () => {
  it('only an active Free grant displays an active Free workspace', () => {
    expect(freeBillingPresentation('free', 'active')).toEqual({ planName: 'Weavly Free', status: 'active', statusKey: 'active', freeActive: true })
    for (const state of ['pending', 'suspended', undefined]) {
      expect(freeBillingPresentation('free', state).freeActive).toBe(false)
      expect(freeBillingPresentation('free', state).status).not.toBe('active')
      expect(freeBillingPresentation('free', state).noticeKey).toBeDefined()
    }
  })

  it('separates pending verification, suspension and an ended paid plan', () => {
    expect(freeBillingPresentation('free', 'pending')).toMatchObject({ status: 'pending', statusKey: 'pendingAccess', noticeKey: 'pendingBody' })
    expect(freeBillingPresentation('free', 'suspended')).toMatchObject({ status: 'locked', statusKey: 'suspended', noticeKey: 'suspendedBody' })
    expect(freeBillingPresentation('none', 'active')).toMatchObject({ status: 'expired', statusKey: 'expired', noticeKey: 'expiredBody', freeActive: false })
  })

  it('reflects a verified in-place upgrade rather than labeling paid access Free', () => {
    for (const tier of ['lite', 'base']) {
      expect(freeBillingPresentation(tier, 'suspended')).toEqual({ planName: `Weavly ${tier === 'lite' ? 'Lite' : 'Base'}`, status: 'active', statusKey: 'active', freeActive: false })
    }
  })

  it('does not infer access when the source is unavailable or unrecognized', () => {
    for (const [tier, state] of [['free', undefined], ['none', undefined], ['free', 'unknown']]) {
      expect(freeBillingPresentation(tier!, state)).toMatchObject({ status: 'pending', statusKey: 'unavailable', noticeKey: 'unavailableBody', freeActive: false })
    }
  })

  it('translates consequential access and draft states in all supported languages', () => {
    const keys: FreeSupportingKey[] = ['active', 'pendingAccess', 'suspended', 'expired', 'unavailable', 'pendingBody', 'suspendedBody', 'expiredBody', 'unavailableBody', 'unsaved', 'draft', 'uncertainSubmission', 'pendingAction', 'unsent', 'leaveDraft']
    for (const key of keys) {
      expect(freeSupportingText('en', key)).toBeTruthy()
      for (const language of ['hi', 'gu'] as const) {
        expect(freeSupportingText(language, key)).toBeTruthy()
        expect(freeSupportingText(language, key)).not.toBe(freeSupportingText('en', key))
      }
    }
    for (const language of ['en', 'hi', 'gu'] as const) {
      expect(freeSupportingText(language, 'olderMessages', { count: 12 })).toContain('12')
      expect(freeSupportingText(language, 'organization', { name: 'Synthetic factory' })).toContain('Synthetic factory')
    }
  })
})
