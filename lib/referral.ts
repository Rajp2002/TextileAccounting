import 'server-only'

import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRenewalEligibilityDate, isRenewalEligible } from '@/lib/billing-lifecycle'

export const REFERRAL_MAX_CREDITS = 5

const ACTIVE_BASE_STATUSES = new Set([
    'active',
    'authenticated',
    'paused',
    'halted',
    'cancelled',
    'completed',
])

type SubscriptionEligibilityRow = {
    id: string
    plan_tier: string | null
    status: string
    current_start: string | null
    current_end: string | null
    razorpay_payment_id: string | null
    checkout_purchase_type: string | null
    checkout_amount_paise: number | null
}

type SubscriptionPaymentEligibilityRow = {
    subscription_id: string | null
    status: string
    amount_paise: number
}

type ReferralUseRow = {
    id: string
    status: string
    signed_up_at: string
    converted_at: string | null
    organizations?: { name?: string | null } | { name?: string | null }[] | null
}

type ReferralYearCreditRow = {
    id: string
    referral_use_id: string
    status: 'available' | 'redeemed' | 'revoked' | string
    granted_at: string
    redeemed_at: string | null
}

type ReferralHistoryRow = {
    factoryName: string
    status: string
    date: string | null
}

export type ReferralEligibility = {
    eligible: boolean
    reason: 'active_base_required' | 'initial_payment_required' | null
    currentEnd: string | null
    renewalEligibleAt: string | null
}

export type ReferralStats = {
    eligible: boolean
    reason: ReferralEligibility['reason']
    code: string | null
    total: number
    converted: number
    availableCredits: number
    redeemedCredits: number
    cap: number
    canRedeemNextYear: boolean
    renewalEligibleAt: string | null
    // Kept as compatibility fields for older consumers. The active policy
    // never populates discount windows or a percentage discount.
    currentDiscountPct: 0
    activeWindows: []
    history: ReferralHistoryRow[]
}

function emptyReferralStats(
    eligibility: ReferralEligibility,
): ReferralStats {
    return {
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        code: null,
        total: 0,
        converted: 0,
        availableCredits: 0,
        redeemedCredits: 0,
        cap: REFERRAL_MAX_CREDITS,
        canRedeemNextYear: false,
        renewalEligibleAt: eligibility.renewalEligibleAt,
        currentDiscountPct: 0,
        activeWindows: [],
        history: [],
    }
}

function normalizedReferralCode(value: unknown): string {
    return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function isValidReferralCode(value: string): boolean {
    return /^WEAVLY-[A-Z0-9]{4,12}$/.test(value)
}

function organizationName(value: ReferralUseRow['organizations']): string {
    if (Array.isArray(value)) return value[0]?.name?.trim() || 'Factory'
    return value?.name?.trim() || 'Factory'
}

async function loadReferralEligibility(orgId: string): Promise<ReferralEligibility> {
    const admin = createAdminClient()
    const [subscriptionsResult, paymentsResult] = await Promise.all([
        admin
            .from('org_subscriptions')
            .select('id, plan_tier, status, current_start, current_end, razorpay_payment_id, checkout_purchase_type, checkout_amount_paise')
            .eq('org_id', orgId)
            .eq('plan_tier', 'base'),
        admin
            .from('subscription_payments')
            .select('subscription_id, status, amount_paise')
            .eq('org_id', orgId)
            .eq('status', 'captured'),
    ])

    if (subscriptionsResult.error) throw subscriptionsResult.error
    if (paymentsResult.error) throw paymentsResult.error

    const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionEligibilityRow[]
    const payments = (paymentsResult.data ?? []) as SubscriptionPaymentEligibilityRow[]
    const paidInitialSubscriptionIds = new Set(
        payments
            .filter((payment) => payment.amount_paise > 0 && payment.subscription_id)
            .map((payment) => payment.subscription_id as string),
    )

    const hasInitialPayment = subscriptions.some((subscription) =>
        subscription.checkout_purchase_type === 'initial_purchase'
        && (
            paidInitialSubscriptionIds.has(subscription.id)
            || (
                Boolean(subscription.razorpay_payment_id)
                && Number(subscription.checkout_amount_paise) > 0
            )
        ),
    )

    if (!hasInitialPayment) {
        return {
            eligible: false,
            reason: 'initial_payment_required',
            currentEnd: null,
            renewalEligibleAt: null,
        }
    }

    const nowMs = Date.now()
    const activeBaseRows = subscriptions
        .filter((subscription) => ACTIVE_BASE_STATUSES.has(subscription.status))
        .filter((subscription) => {
            const startMs = subscription.current_start ? new Date(subscription.current_start).getTime() : 0
            const endMs = subscription.current_end ? new Date(subscription.current_end).getTime() : Number.NaN
            return Number.isFinite(startMs)
                && startMs <= nowMs
                && Number.isFinite(endMs)
                && endMs > nowMs
        })
        .sort((left, right) => new Date(right.current_end ?? 0).getTime() - new Date(left.current_end ?? 0).getTime())

    const currentEnd = activeBaseRows[0]?.current_end ?? null
    if (!currentEnd) {
        return {
            eligible: false,
            reason: 'active_base_required',
            currentEnd: null,
            renewalEligibleAt: null,
        }
    }

    return {
        eligible: true,
        reason: null,
        currentEnd,
        renewalEligibleAt: getRenewalEligibilityDate(currentEnd),
    }
}

/** Returns the stable referral code, creating it only for an eligible Base member. */
export async function getOrCreateReferralCode(orgId: string): Promise<string> {
    const eligibility = await loadReferralEligibility(orgId)
    if (!eligibility.eligible) {
        throw new Error('Referral rewards require an active Base Plan with the initial year paid.')
    }

    const admin = createAdminClient()
    const { data: existingCode, error: existingError } = await admin
        .from('referral_codes')
        .select('code')
        .eq('org_id', orgId)
        .maybeSingle()

    if (existingError) throw existingError
    if (existingCode?.code) return existingCode.code

    for (let attempt = 0; attempt < 8; attempt += 1) {
        // New codes use 48 bits of randomness. Existing legacy codes remain
        // valid so current owners do not lose a shared link during rollout.
        const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase()
        const code = `WEAVLY-${randomPart}`
        const { error } = await admin
            .from('referral_codes')
            .insert({ org_id: orgId, code })

        if (!error) return code
        if (error.code !== '23505') throw new Error('Failed to create referral code')

        // A concurrent request may have won the one-code-per-org race. Read
        // the winner before generating another code for the same organization.
        const { data: concurrentCode } = await admin
            .from('referral_codes')
            .select('code')
            .eq('org_id', orgId)
            .maybeSingle()
        if (concurrentCode?.code) return concurrentCode.code
    }

    throw new Error('Failed to create referral code')
}

export async function getReferralStats(orgId: string): Promise<ReferralStats> {
    const eligibility = await loadReferralEligibility(orgId)
    if (!eligibility.eligible) return emptyReferralStats(eligibility)

    const admin = createAdminClient()
    const code = await getOrCreateReferralCode(orgId)
    const { data: codeData, error: codeError } = await admin
        .from('referral_codes')
        .select('id, code')
        .eq('org_id', orgId)
        .eq('code', code)
        .single()

    if (codeError || !codeData) throw codeError ?? new Error('Referral code is unavailable')

    const [usesResult, creditsResult] = await Promise.all([
        admin
            .from('referral_uses')
            .select('id, status, signed_up_at, converted_at, organizations(name)')
            .eq('referral_code_id', codeData.id)
            .order('created_at', { ascending: false }),
        admin
            .from('referral_year_credits')
            .select('id, referral_use_id, status, granted_at, redeemed_at')
            .eq('referrer_org_id', orgId)
            .order('granted_at', { ascending: true }),
    ])

    if (usesResult.error) throw usesResult.error
    if (creditsResult.error) throw creditsResult.error

    const uses = (usesResult.data ?? []) as ReferralUseRow[]
    const credits = (creditsResult.data ?? []) as ReferralYearCreditRow[]
    const creditsByUse = new Map(credits.map((credit) => [credit.referral_use_id, credit]))
    const availableCredits = credits.filter((credit) => credit.status === 'available').length
    const redeemedCredits = credits.filter((credit) => credit.status === 'redeemed').length
    const canRedeemNextYear = availableCredits > 0
        && eligibility.currentEnd !== null
        && isRenewalEligible(eligibility.currentEnd)

    const history = uses.map((use): ReferralHistoryRow => {
        const credit = creditsByUse.get(use.id)
        return {
            factoryName: organizationName(use.organizations),
            status: credit?.status === 'redeemed'
                ? 'redeemed'
                : credit?.status === 'available'
                    ? 'earned'
                    : use.status === 'expired'
                        ? 'capped'
                        : use.status,
            date: credit?.redeemed_at ?? credit?.granted_at ?? (use.status === 'converted' ? use.converted_at : use.signed_up_at),
        }
    })

    return {
        eligible: true,
        reason: null,
        code: codeData.code,
        total: uses.length,
        converted: credits.length,
        availableCredits,
        redeemedCredits,
        cap: REFERRAL_MAX_CREDITS,
        canRedeemNextYear,
        renewalEligibleAt: eligibility.renewalEligibleAt,
        currentDiscountPct: 0,
        activeWindows: [],
        history,
    }
}

/**
 * Applies a code to a new organization. The referee pays later; conversion is
 * claimed by the verified payment path only after a paid initial Base purchase.
 */
export async function applyReferralCode(code: string, refereeOrgId: string) {
    const supabase = createAdminClient()
    const normalizedCode = normalizedReferralCode(code)
    if (!isValidReferralCode(normalizedCode)) throw new Error('Invalid referral code')

    const { data: codeRow, error: codeError } = await supabase
        .from('referral_codes')
        .select('id, org_id')
        .eq('code', normalizedCode)
        .single()

    if (codeError || !codeRow) throw new Error('Invalid referral code')

    // Prevent self-referral before any write.
    if (codeRow.org_id === refereeOrgId) {
        throw new Error('Cannot use your own referral code')
    }

    const eligibility = await loadReferralEligibility(codeRow.org_id)
    if (!eligibility.eligible) {
        throw new Error('Referral rewards require an active Base Plan with the initial year paid.')
    }

    const { count, error: countError } = await supabase
        .from('referral_year_credits')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_org_id', codeRow.org_id)
    if (countError) throw countError
    if ((count ?? 0) >= REFERRAL_MAX_CREDITS) {
        throw new Error('This referral code has reached its five-referral limit.')
    }

    const { error: useError } = await supabase
        .from('referral_uses')
        .insert({
            referral_code_id: codeRow.id,
            referee_org_id: refereeOrgId,
            status: 'pending',
        })

    if (useError) {
        if (useError.code === '23505') {
            throw new Error('Referral code already applied for this organization')
        }
        throw new Error('Failed to apply referral code')
    }

    return true
}
