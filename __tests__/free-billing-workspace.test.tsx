import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const workspace = vi.hoisted(() => ({ tier: 'free' }))
vi.mock('@/app/free/FreeWorkspace', () => ({ useFreeWorkspace: () => workspace }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: 'en' }) }))
vi.mock('@/components/billing/PaymentHistoryDialog', () => ({ PaymentHistoryDialog: () => <div>Existing payment history</div> }))
import FreeBillingClient from '@/app/free/billing/FreeBillingClient'

beforeEach(() => { workspace.tier = 'free'; vi.stubGlobal('React', React) })

describe('Free billing renders current workspace facts', () => {
  it('renders the actual factory identity and metered Free policy', () => {
    const html = renderToStaticMarkup(<FreeBillingClient organizationName="Actual factory" initialTier="free" grantState="active" />)
    expect(html).toContain('Organization: Actual factory')
    expect(html).toContain('2 new costings per month.')
    expect(html).toContain('Active workspace')
  })

  it('a mounted verified upgrade replaces Free allowance with paid unlimited costing', () => {
    for (const tier of ['lite', 'base']) {
      workspace.tier = tier
      const html = renderToStaticMarkup(<FreeBillingClient organizationName="Actual factory" initialTier="free" grantState="active" />)
      expect(html).toContain(`Weavly ${tier === 'lite' ? 'Lite' : 'Base'}`)
      expect(html).toContain('Unlimited costings with your paid plan.')
      expect(html).not.toContain('2 new costings per month.')
      expect(html).not.toContain('No subscription payment required')
    }
  })

  it('unconfirmed, pending and suspended Free access is never called active', () => {
    for (const grantState of [undefined, 'pending', 'suspended']) {
      const html = renderToStaticMarkup(<FreeBillingClient organizationName="" initialTier="free" grantState={grantState} />)
      expect(html).not.toContain('Active workspace')
      expect(html).not.toContain('>Active<')
      expect(html).toContain('role="status"')
      expect(html).toContain('Factory name unavailable')
    }
  })
})
