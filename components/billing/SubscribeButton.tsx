'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { BillingPurchaseType, PurchasablePlanTier } from '@/lib/billing-constants'

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
    modal: {
        ondismiss: () => void
    }
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
}

type PaymentOutcome = {
    state: 'success' | 'pending'
    planName: string
    purchaseType: BillingPurchaseType
    amount: number
    paymentId: string
    activeUntil?: string | null
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

interface SubscribeButtonProps {
    // Kept optional for backward compatibility
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

    /**
     * Load a script by URL and resolve true if window.Razorpay becomes available.
     */
    const tryLoadScript = (url: string): Promise<boolean> => {
        return new Promise((resolve) => {
            const script = document.createElement('script')
            script.src = url
            script.onload = () => {
                const available = typeof window !== 'undefined' && !!window.Razorpay
                resolve(available)
            }
            script.onerror = () => {
                resolve(false)
            }
            document.body.appendChild(script)
        })
    }

    /**
     * Load Razorpay Checkout only from Razorpay's official origin. Vendor code
     * must never be proxied or rewritten because that bypasses provider source
     * validation and makes the payment boundary impossible to audit.
     */
    const loadRazorpayScript = async (): Promise<boolean> => {
        if (typeof window !== 'undefined' && window.Razorpay) {
            return true
        }
        return tryLoadScript('https://checkout.razorpay.com/v1/checkout.js')
    }

    const markCheckoutRetryable = async (orderId: string, outcome: 'failed' | 'cancelled') => {
        try {
            await fetch('/api/billing/checkout-state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ orderId, outcome }),
                keepalive: true,
            })
        } finally {
            router.refresh()
        }
    }

    async function handleSubscribe() {
        setLoading(true)
        try {
            const planName = tierName ?? (planTier === 'base' ? 'Weavly Estimator' : 'Weavly Full Suite')
            const isLoaded = await loadRazorpayScript()
            if (!isLoaded) {
                throw new Error(
                    'Razorpay Checkout could not load. Disable content blockers/adblock for this site or try another browser.'
                )
            }

            // 1. Create Order via our backend endpoint
            const res = await fetch('/api/billing/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ planTier }),
            })

            const contentType = res.headers.get('content-type')
            if (!contentType?.includes('application/json')) {
                const text = await res.text()
                throw new Error(`Server returned ${res.status} (${contentType}). Please refresh and try again.`)
            }

            const data = await res.json() as CreateOrderResponse
            if (!res.ok || data.error) {
                throw new Error(data.error || 'Failed to create payment order')
            }

            const { orderId, amount, currency, keyId, purchaseType } = data
            if (!orderId || !keyId || !amount || !currency || !purchaseType) {
                throw new Error('Payment setup response was incomplete.')
            }
            const checkoutPlanName = data.planName ?? planName
            const checkoutPurpose = purchaseType === 'renewal' ? 'Annual Renewal' : 'First Year'
            let paymentHandled = false

            const rzp = new window.Razorpay({
                key: keyId,
                amount: amount,
                currency: currency,
                order_id: orderId,
                name: 'Weavly',
                description: `${checkoutPlanName} - ${checkoutPurpose}`,
                image: '/images/WeavlyLogo.png',
                handler: async function (response: {
                    razorpay_payment_id: string
                    razorpay_order_id: string
                    razorpay_signature: string
                }) {
                    paymentHandled = true
                    setLoading(true)
                    try {
                        const verifyRes = await fetch('/api/billing/verify-payment', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            })
                        })

                        const verifyData = await verifyRes.json().catch(() => ({})) as {
                            error?: string
                            activationPending?: boolean
                            activeUntil?: string | null
                        }

                        if (verifyRes.status === 202 && verifyData.activationPending) {
                            setOutcome({
                                state: 'pending',
                                planName: checkoutPlanName,
                                purchaseType,
                                amount,
                                paymentId: response.razorpay_payment_id,
                            })
                            toast.info('Payment received. We are confirming access now.')
                            onSuccess?.(response.razorpay_payment_id)
                            return
                        }
                        if (!verifyRes.ok || verifyData.error) {
                            throw new Error(verifyData.error || 'Failed to verify payment signature')
                        }

                        setOutcome({
                            state: 'success',
                            planName: checkoutPlanName,
                            purchaseType,
                            amount,
                            paymentId: response.razorpay_payment_id,
                            activeUntil: verifyData.activeUntil,
                        })
                        toast.success(
                            purchaseType === 'renewal'
                                ? `🎉 Payment successful! ${checkoutPlanName} was renewed.`
                                : `🎉 Payment successful! ${checkoutPlanName} is now active.`
                        )
                        onSuccess?.(response.razorpay_payment_id)
                        // Keep the confirmation visible until the owner chooses
                        // the next action. Navigating to that action performs a
                        // fresh server render with the activated entitlement.
                    } catch (err) {
                        toast.error(getErrorMessage(err, 'Payment verification failed.'))
                    } finally {
                        setLoading(false)
                    }
                },
                modal: {
                    ondismiss: () => {
                        setLoading(false)
                        if (!paymentHandled) void markCheckoutRetryable(orderId, 'cancelled')
                    },
                },
                theme: { color: '#D97706' },
            })

            rzp.on('payment.failed', () => {
                paymentHandled = true
                toast.error('Payment failed. Please try again.')
                setLoading(false)
                void markCheckoutRetryable(orderId, 'failed')
            })

            rzp.open()
        } catch (err) {
            toast.error(getErrorMessage(err, 'Something went wrong. Please try again.'))
            setLoading(false)
        }
    }

    return (
        <div className="space-y-3">
            {outcome ? (
                <div className={cn(
                    'rounded-xl border p-4 text-sm',
                    outcome.state === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-blue-200 bg-blue-50 text-blue-900'
                )} role="status" aria-live="polite">
                    <p className="font-bold">
                        {outcome.state === 'success'
                            ? `${outcome.planName} payment received`
                            : 'Payment received — confirming access'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed opacity-80">
                        {outcome.state === 'success'
                            ? `Paid ${displayAmount ?? `₹${(outcome.amount / 100).toLocaleString('en-IN')}`}${outcome.activeUntil ? ` · Active until ${new Date(outcome.activeUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}` : ''}.`
                            : 'We will update your access after the payment webhook is confirmed. Please do not pay again.'}
                    </p>
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider opacity-60">
                        Payment ref. {outcome.paymentId.slice(-8)}
                    </p>
                    {outcome.state === 'success' && successHref && (
                        <Link
                            href={successHref}
                            className="mt-3 inline-flex items-center rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm hover:bg-white"
                        >
                            {successLabel ?? 'Continue'}
                        </Link>
                    )}
                </div>
            ) : (
                <Button
                    type="button"
                    id={`subscribe-btn-${planTier}`}
                    onClick={handleSubscribe}
                    disabled={loading}
                    size="lg"
                    className={cn('w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200/50 transition-all', className)}
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Opening payment...
                        </>
                    ) : (
                        <>
                            <CreditCard className="h-4 w-4" />
                            {buttonLabel ?? `Pay ${displayAmount ?? (planTier === 'base' ? '₹8,260' : '₹29,500')} & Activate`}
                        </>
                    )}
                </Button>
            )}
        </div>
    )
}
