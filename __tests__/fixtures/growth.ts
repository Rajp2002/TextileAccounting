import { randomUUID } from 'node:crypto'
import type { GrowthFactory } from '@/lib/admin/growth-input'

/** A production factory with no history; tests override only what they exercise. */
export function factory(overrides: Partial<GrowthFactory> = {}): GrowthFactory {
    return {
        id: randomUUID(), name: 'Synthetic Weaving', createdAt: '2026-10-01T06:00:00.000Z',
        owner: { name: 'Synthetic Owner', phone: '+919800000001', email: 'owner@example.test', lastSignInAt: null },
        subscriptions: [], hasFreeGrant: false,
        costings: { count: 0, first: null, latest: null, earlyDays: [] },
        activity: { months: [], earlyDays: [], minutesLast30: 0, lastSeenAt: null },
        payments: [], refunds: [], checkoutAttempts: [], freeSignals: [], interest: null,
        ...overrides,
    }
}

type Payment = GrowthFactory['payments'][number]
export function pay(at: string, paise: number, plan: 'lite' | 'base' = 'lite', type: 'initial_purchase' | 'renewal' = 'initial_purchase', subscriptionId: string | null = null): Payment {
    return { id: randomUUID(), subscriptionId, amountPaise: paise, status: 'captured', capturedAt: at, planTier: plan, purchaseType: type }
}

type Subscription = GrowthFactory['subscriptions'][number]
export function trial(start: string, end: string): Subscription {
    return { id: randomUUID(), status: 'active', plan_tier: 'lite', current_start: start, current_end: end, razorpay_payment_id: null, created_at: start, is_trial: true }
}
export function term(start: string, end: string, plan: 'lite' | 'base' = 'lite'): Subscription {
    return { id: randomUUID(), status: 'active', plan_tier: plan, current_start: start, current_end: end, razorpay_payment_id: `pay_${randomUUID()}`, created_at: start, is_trial: false }
}
