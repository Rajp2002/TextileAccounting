import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveBillingCheckoutPresentation } from '../lib/billing-lifecycle'

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('Base P0 billing recovery', () => {
  const created = {
    id: 'subscription-created',
    plan_tier: 'base',
    status: 'created',
    current_end: null,
    razorpay_order_id: 'order_basepilot1',
    created_at: '2026-07-30T10:00:00.000Z',
  }

  it('never describes a failed payment as activating access', () => {
    const result = resolveBillingCheckoutPresentation(
      [created],
      [{
        subscription_id: created.id,
        razorpay_order_id: created.razorpay_order_id,
        status: 'failed',
      }],
      new Date('2026-07-30T10:05:00.000Z'),
    )

    expect(result.state).toBe('retryable')
  })

  it('distinguishes order creation from verified payment activation', () => {
    expect(resolveBillingCheckoutPresentation(
      [created],
      [],
      new Date('2026-07-30T10:05:00.000Z'),
    ).state).toBe('pending')

    expect(resolveBillingCheckoutPresentation(
      [{ ...created, status: 'authenticated' }],
      [],
      new Date('2026-07-30T10:05:00.000Z'),
    ).state).toBe('activating')
  })

  it('expires abandoned orders into an immediate retry state', () => {
    expect(resolveBillingCheckoutPresentation(
      [created],
      [],
      new Date('2026-07-30T10:16:00.000Z'),
    ).state).toBe('retryable')
  })

  it('records failed checkout outcomes against an exact owner order and reconciles dismissals', () => {
    const route = source('app/api/billing/checkout-state/route.ts')
    const button = source('components/billing/SubscribeButton.tsx')
    const page = source('app/(dashboard)/owner/billing/page.tsx')

    expect(route).toContain(".eq('org_id', profile.org_id)")
    expect(route).toContain(".eq('razorpay_order_id', orderId)")
    expect(route).toContain(".in('status', ['creating', 'created', 'processing', 'unknown'])")
    expect(button).toContain("markCheckoutRetryable(orderId, 'failed')")
    expect(button).toContain("/api/billing/status")
    expect(button).toContain('Do not pay again')
    expect(button).not.toContain("markCheckoutRetryable(orderId, 'cancelled')")
    expect(page).toContain('Weavly has <strong>not received a verified payment yet</strong>')
    expect(page).toContain('No payment was captured.')
    expect(page).not.toContain('Use card 4111-1111-1111-1111')
  })
})
