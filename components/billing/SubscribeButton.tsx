'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, RefreshCw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type RazorpayCheckoutOptions = {
    key: string
    subscription_id: string
    name: string
    description: string
    image: string
    handler: (response: {
        razorpay_payment_id: string
        razorpay_subscription_id: string
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

type CreateSubscriptionResponse = {
    error?: string
    subscriptionId?: string
    keyId?: string
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

interface SubscribeButtonProps {
    planId: string
    tierName: string       // e.g. "Base" or "Premium"
    displayAmount: string  // e.g. "₹2,360/mo"
    onSuccess?: (paymentId: string) => void
    className?: string
}

export function SubscribeButton({ planId, tierName, displayAmount, onSuccess, className }: SubscribeButtonProps) {
    const [loading, setLoading] = useState(false)
    const [autoRenew, setAutoRenew] = useState(true)
    const router = useRouter()

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (typeof window !== 'undefined' && window.Razorpay) return resolve(true)
            const script = document.createElement('script')
            script.src = 'https://checkout.razorpay.com/v1/checkout.js'
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.body.appendChild(script)
        })
    }

    async function handleSubscribe() {
        setLoading(true)
        try {
            console.log('[SubscribeButton] Initializing subscription for plan:', planId, '| autoRenew:', autoRenew)

            const isLoaded = await loadRazorpayScript()
            if (!isLoaded) {
                throw new Error('Failed to load payment gateway. Please check your internet connection.')
            }

            // 1. Create subscription via our API, passing autoRenew preference
            const res = await fetch('/api/subscriptions/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ planId, autoRenew }),
            })

            const contentType = res.headers.get('content-type')
            if (!contentType?.includes('application/json')) {
                const text = await res.text()
                console.error('[SubscribeButton] Received non-JSON response:', text.substring(0, 100))
                throw new Error(`Server returned ${res.status} (${contentType}). Please refresh and try again.`)
            }

            const data = await res.json() as CreateSubscriptionResponse
            console.log('[SubscribeButton] API response:', data)

            if (!res.ok || data.error) {
                throw new Error(data.error || 'Failed to create subscription')
            }

            const { subscriptionId, keyId } = data
            if (!subscriptionId || !keyId) {
                throw new Error('Payment setup response was incomplete.')
            }

            const rzp = new window.Razorpay({
                key: keyId,
                subscription_id: subscriptionId,
                name: 'Weavly',
                description: `${tierName} Plan — ${autoRenew ? 'Monthly, auto-renews' : 'Monthly, no auto-renewal'}`,
                image: '/images/WeavlyLogo.png',
                handler: function (response: {
                    razorpay_payment_id: string
                    razorpay_subscription_id: string
                    razorpay_signature: string
                }) {
                    const msg = autoRenew
                        ? '🎉 Payment successful! Your subscription is now activating.'
                        : '🎉 Payment successful! Your plan is active. It will not auto-renew at the end of the period.'
                    toast.success(msg)
                    onSuccess?.(response.razorpay_payment_id)
                    // Refresh server component so billing page shows updated subscription state
                    setTimeout(() => router.refresh(), 1500)
                },
                modal: {
                    ondismiss: () => setLoading(false),
                },
                theme: { color: '#D97706' },
            })

            rzp.on('payment.failed', () => {
                toast.error('Payment failed. Please try again.')
                setLoading(false)
            })

            rzp.open()
        } catch (err) {
            toast.error(getErrorMessage(err, 'Something went wrong. Please try again.'))
            setLoading(false)
        }
    }

    return (
        <div className="space-y-3">
            <Button
                type="button"
                id={`subscribe-btn-${planId}`}
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
                        Subscribe — {displayAmount}
                    </>
                )}
            </Button>

            {/* Auto-renew preference */}
            <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                <div className="relative mt-0.5 shrink-0">
                    <input
                        type="checkbox"
                        id={`auto-renew-${planId}`}
                        checked={autoRenew}
                        onChange={(e) => setAutoRenew(e.target.checked)}
                        className="sr-only peer"
                        disabled={loading}
                    />
                    {/* Custom styled checkbox */}
                    <div className={cn(
                        'h-4 w-4 rounded border-2 flex items-center justify-center transition-all',
                        autoRenew
                            ? 'bg-amber-500 border-amber-500'
                            : 'bg-white border-gray-300 group-hover:border-gray-400'
                    )}>
                        {autoRenew && (
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        )}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                        <RefreshCw className="h-3 w-3 text-gray-400" />
                        Auto-renew monthly
                    </span>
                    {!autoRenew && (
                        <p className="text-[11px] text-amber-700 mt-0.5 flex items-start gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            Your plan will not renew after the first billing cycle. You can re-subscribe anytime.
                        </p>
                    )}
                </div>
            </label>
        </div>
    )
}
