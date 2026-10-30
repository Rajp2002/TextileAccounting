import { z } from 'zod'
import { ACTIVITY_AREAS } from '@/lib/activity-tracking'

/**
 * Raw per-factory facts from public.admin_growth_input (spec 2026-10-30 section F).
 * Production factories only. Every metric is computed from these facts in
 * growth-money.ts and growth-usage.ts; nothing here is a judgement.
 */
const instant = z.string().refine(value => Number.isFinite(Date.parse(value)))
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const minutes = z.number().int().nonnegative()

const subscriptionSchema = z.object({
    id: z.string(), status: z.string(), plan_tier: z.string().nullable(),
    current_start: instant.nullable(), current_end: instant.nullable(),
    razorpay_payment_id: z.string().nullable(), created_at: instant.nullable(),
    is_trial: z.boolean().optional().default(false),
})

export const growthFactorySchema = z.object({
    id: z.string(), name: z.string(), createdAt: instant,
    owner: z.object({ name: z.string().nullable(), phone: z.string().nullable(), email: z.string().nullable(), lastSignInAt: instant.nullable() }),
    subscriptions: z.array(subscriptionSchema),
    hasFreeGrant: z.boolean(),
    costings: z.object({ count: minutes, first: instant.nullable(), latest: instant.nullable(), earlyDays: z.array(day) }),
    activity: z.object({
        months: z.array(z.object({
            month: z.string().regex(/^\d{4}-\d{2}$/), minutes,
            areas: z.partialRecord(z.enum(ACTIVITY_AREAS), minutes),
            phone: minutes, tablet: minutes, desktop: minutes, installed: minutes,
        })),
        earlyDays: z.array(day), minutesLast30: minutes, lastSeenAt: instant.nullable(),
    }),
    payments: z.array(z.object({
        id: z.string(), subscriptionId: z.string().nullable(), amountPaise: z.number().int().nonnegative(),
        status: z.enum(['captured', 'refunded']), capturedAt: instant,
        planTier: z.enum(['lite', 'base']).nullable(), purchaseType: z.enum(['initial_purchase', 'renewal']).nullable(),
    })),
    refunds: z.array(z.object({ paymentId: z.string(), amountPaise: z.number().int().nonnegative(), at: instant })),
    checkoutAttempts: z.array(z.object({ at: instant, status: z.string() })),
    freeSignals: z.array(z.object({ event: z.enum(['quota_reached', 'upgrade_started']), at: instant })),
    interest: z.object({ firstAt: instant, lastAt: instant, taps: z.number().int().positive(), lastSource: z.string() }).nullable(),
})

export const growthInputSchema = z.object({
    asOf: instant, goLiveAt: instant.nullable(), trackingSince: day.nullable(),
    factories: z.array(growthFactorySchema),
})

export type GrowthFactory = z.infer<typeof growthFactorySchema>
export type GrowthInput = z.infer<typeof growthInputSchema>
