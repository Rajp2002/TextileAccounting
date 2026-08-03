'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast, userFacingError } from '@/lib/app-notifications'
import { cn } from '@/lib/utils'
import type { BillingPurchaseType, PurchasablePlanTier } from '@/lib/billing-constants'
import { useTranslation } from '@/lib/i18n/context'

type RazorpayCheckoutOptions = {
    key: string
    amount: number
    currency: string
    order_id: string
    name: string
    description: string
    image: string
    handler: (response: {
        razorpay_payment_id: string
        razorpay_order_id: string
        razorpay_signature: string
    }) => void
    modal: { ondismiss: () => void }
    theme: { color: string }
}
type RazorpayCheckout = {
    on: (event: 'payment.failed', handler: () => void) => void
    open: () => void
}

declare global {
    interface Window {
        Razorpay: new (options: RazorpayCheckoutOptions) => RazorpayCheckout
    }
}

type CreateOrderResponse = {
    error?: string
    orderId?: string
    amount?: number
    currency?: string
    keyId?: string
    planName?: string
    purchaseType?: BillingPurchaseType
    attemptId?: string
    clientRequestId?: string
}

type PaymentOutcome = {
    state: 'success' | 'pending' | 'checking' | 'retryable' | 'reconciliation'
    planName: string
    purchaseType: BillingPurchaseType
    amount: number
    paymentId?: string
    orderId?: string
    activeUntil?: string | null
    message?: string
}

type PaymentStatusResponse = {
    state?: string
    message?: string
    paymentId?: string | null
    orderId?: string
    activeUntil?: string | null
}

function getErrorMessage(error: unknown, fallback: string) {
    return userFacingError(error, fallback)
}

interface SubscribeButtonProps {
    planId?: string
    planTier?: PurchasablePlanTier
    tierName?: string
    displayAmount?: string
    buttonLabel?: string
    onSuccess?: (paymentId: string) => void
    successHref?: string
    successLabel?: string
    className?: string
}

export function SubscribeButton({ planTier = 'premium', tierName, displayAmount, buttonLabel, onSuccess, successHref, successLabel, className }: SubscribeButtonProps) {
    const [loading, setLoading] = useState(false)
    const [outcome, setOutcome] = useState<PaymentOutcome | null>(null)
    const router = useRouter()
    const { t, tx } = useTranslation()

    const tryLoadScript = (url: string): Promise<boolean> => new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = url
        script.onload = () => resolve(typeof window !== 'undefined' && !!window.Razorpay)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
    })

    const loadRazorpayScript = async (): Promise<boolean> => {
        if (typeof window !== 'undefined' && window.Razorpay) return true
        return tryLoadScript('https://checkout.razorpay.com/v1/checkout.js')
    }

    async function checkPaymentStatus({
        orderId,
        paymentId,
        planName,
        purchaseType,
        amount,
    }: {
        orderId: string
        paymentId?: string | null
        planName: string
        purchaseType: BillingPurchaseType
        amount: number
    }) {
        setLoading(true)
        try {
            const response = await fetch('/api/billing/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ orderId, paymentId }),
            })
            const data = await response.json().catch(() => ({})) as PaymentStatusResponse
            const state = data.state
            if (state === 'activated') {
                setOutcome({ state: 'success', planName, purchaseType, amount, paymentId: data.paymentId ?? paymentId ?? undefined, orderId, activeUntil: data.activeUntil })
                toast.success(tx(`${planName} is now active. ${t('base_plan.billing.success')}`))
                if (data.paymentId ?? paymentId) onSuccess?.((data.paymentId ?? paymentId) as string)
                router.refresh()
                return
            }
            if (state === 'failed' || state === 'cancelled' || state === 'refunded') {
                setOutcome({ state: 'retryable', planName, purchaseType, amount, paymentId: data.paymentId ?? paymentId ?? undefined, orderId, message: data.message ?? 'No payment was captured. You can safely try again.' })
                toast.info(tx('No payment was captured. You can safely try again.'))
                router.refresh()
                return
            }
            if (state === 'duplicate' || state === 'reconciliation_required') {
                setOutcome({ state: 'reconciliation', planName, purchaseType, amount, paymentId: data.paymentId ?? paymentId ?? undefined, orderId, message: data.message ?? 'Payment received, but it needs verification. Do not pay again.' })
                toast.info(tx('Payment received. Do not pay again while we verify it.'))
                return
            }
            setOutcome({ state: state === 'authorized' || state === 'processing' ? 'pending' : 'checking', planName, purchaseType, amount, paymentId: data.paymentId ?? paymentId ?? undefined, orderId, message: data.message ?? 'We could not confirm the bank result yet. Check again before retrying.' })
        } catch {
            setOutcome({ state: 'checking', planName, purchaseType, amount, paymentId: paymentId ?? undefined, orderId, message: 'We could not check the payment right now. Do not pay again; try checking again shortly.' })
        } finally {
            setLoading(false)
        }
    }

    async function markCheckoutRetryable(orderId: string, outcome: 'failed' | 'cancelled') {
        try {
            await fetch('/api/billing/checkout-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ orderId, outcome }),
                keepalive: true,
            })
        } finally {
            router.refresh()
        }
    }

    async function handleSubscribe() {
        setLoading(true)
        setOutcome(null)
        try {
            const planName = tierName ?? (planTier === 'base' ? 'Weavly Estimator' : 'Weavly Full Suite')
            const isLoaded = await loadRazorpayScript()
            if (!isLoaded) throw new Error('Razorpay Checkout could not load. Disable content blockers/adblock for this site or try another browser.')

            const clientRequestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `wvl_${Date.now()}_${Math.random().toString(36).slice(2)}`
            const res = await fetch('/api/billing/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ planTier, clientRequestId }),
            })
            const data = await res.json().catch(() => ({})) as CreateOrderResponse
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to create payment order')

            const { orderId, amount, currency, keyId, purchaseType } = data
            if (!orderId || !keyId || !amount || !currency || !purchaseType) throw new Error('Payment setup response was incomplete.')
            const checkoutPlanName = data.planName ?? planName
            const checkoutPurpose = purchaseType === 'renewal' ? 'Annual Renewal' : 'First Year'
            let paymentHandled = false

            const rzp = new window.Razorpay({
                key: keyId,
                amount,
                currency,
                order_id: orderId,
                name: 'Weavly',
                description: `${checkoutPlanName} - ${checkoutPurpose}`,
                image: '/images/WeavlyLogo.png',
                handler: async (response) => {
                    paymentHandled = true
                    await checkPaymentStatus({ orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id, planName: checkoutPlanName, purchaseType, amount })
                },
                modal: {
                    ondismiss: () => {
                        setLoading(false)
                        if (!paymentHandled) {
                            // Closing the bank/checkout window is not proof of
                            // failure. Reconcile first so a late capture cannot
                            // lead Rajesh to make a second payment.
                            setOutcome({ state: 'checking', planName: checkoutPlanName, purchaseType, amount, orderId, message: 'Checking whether the bank confirmed this payment. Do not pay again.' })
                            void checkPaymentStatus({ orderId, planName: checkoutPlanName, purchaseType, amount })
                        }
                    },
                },
                theme: { color: '#D97706' },
            })

            rzp.on('payment.failed', () => {
                paymentHandled = true
                setLoading(false)
                setOutcome({ state: 'retryable', planName: checkoutPlanName, purchaseType, amount, orderId, message: 'Payment failed. No access was activated; you can safely try again.' })
                toast.info(tx('Payment failed. You can safely try again.'))
                void markCheckoutRetryable(orderId, 'failed')
            })

            rzp.open()
        } catch (err) {
            toast.error(tx(getErrorMessage(err, 'Something went wrong. Please try again.')))
            setLoading(false)
        }
    }

    const outcomeTone = outcome?.state === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : outcome?.state === 'retryable'
            ? 'border-red-200 bg-red-50 text-red-900'
            : 'border-blue-200 bg-blue-50 text-blue-900'

    return (
        <div className="space-y-3">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950" role="note">
                <span className="font-bold">{t('base_plan.billing.status')}</span> {t('base_plan.billing.checkout')}
            </p>
            {outcome ? (
                <div className={cn('rounded-xl border p-4 text-sm', outcomeTone)} role="status" aria-live="polite">
                    <p className="flex items-center gap-2 font-bold">
                        {outcome.state === 'success' ? <ShieldCheck className="h-4 w-4" /> : <RefreshCw className={cn('h-4 w-4', (outcome.state === 'checking' || outcome.state === 'pending') && 'animate-spin')} />}
                        {tx(outcome.state === 'success' ? `${outcome.planName} payment received` : outcome.state === 'retryable' ? 'Payment not completed' : outcome.state === 'reconciliation' ? 'Payment needs verification' : 'Payment status is being checked')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed opacity-80">
                        {outcome.state === 'success'
                            ? tx(`Paid ${displayAmount ?? `₹${(outcome.amount / 100).toLocaleString('en-IN')}`}${outcome.activeUntil ? ` · Active until ${new Date(outcome.activeUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })} IST` : ''}. ${t('base_plan.billing.success')}`)
                            : tx(outcome.message ?? 'We are checking the provider result. Please do not pay again.')}
                    </p>
                    {outcome.paymentId && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider opacity-60">Payment ref. {outcome.paymentId.slice(-8)}</p>}
                    {outcome.state !== 'success' && outcome.orderId && outcome.state !== 'retryable' && (
                        <Button type="button" variant="outline" size="sm" onClick={() => void checkPaymentStatus({ orderId: outcome.orderId as string, paymentId: outcome.paymentId, planName: outcome.planName, purchaseType: outcome.purchaseType, amount: outcome.amount })} disabled={loading} className="mt-3 gap-2 bg-white/70">
                            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {tx('Check payment status')}
                        </Button>
                    )}
                    {outcome.state === 'retryable' && (
                        <Button type="button" size="sm" onClick={handleSubscribe} disabled={loading} className="mt-3 gap-2 bg-red-700 text-white hover:bg-red-800">
                            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {tx('Try again')}
                        </Button>
                    )}
                    {outcome.state === 'success' && successHref && (
                        <Link href={successHref} className="mt-3 inline-flex items-center rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm hover:bg-white">
                            {tx(successLabel ?? 'Continue')}
                        </Link>
                    )}
                </div>
            ) : (
                <Button type="button" id={`subscribe-btn-${planTier}`} onClick={handleSubscribe} disabled={loading} size="lg" className={cn('w-full gap-2 bg-amber-600 text-white shadow-lg shadow-amber-200/50 transition-all hover:bg-amber-700', className)}>
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {tx('Opening secure payment...')}</> : <><CreditCard className="h-4 w-4" /> {tx(buttonLabel ?? `Pay ${displayAmount ?? (planTier === 'base' ? '₹8,260' : '₹29,500')} & Activate`)}</>}
                </Button>
            )}
        </div>
    )
}
