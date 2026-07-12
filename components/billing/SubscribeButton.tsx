'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
    className?: string
}

export function SubscribeButton({ planTier = 'premium', tierName, displayAmount, buttonLabel, onSuccess, className }: SubscribeButtonProps) {
    const [loading, setLoading] = useState(false)
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
                console.log(`[SubscribeButton] Script loaded from ${url}. window.Razorpay:`, available)
                resolve(available)
            }
            script.onerror = () => {
                console.warn(`[SubscribeButton] Script blocked/failed from: ${url}`)
                resolve(false)
            }
            document.body.appendChild(script)
        })
    }

    /**
     * Load Razorpay Checkout with ad-blocker bypass.
     *
     * Strategy:
     * 1. If Razorpay is already on window → done
     * 2. Try our same-origin proxy (/api/billing/checkout-script) — ad blockers
     *    won't block this because it's a first-party request
     * 3. Fall back to the direct Razorpay CDN URL (for users without ad blockers,
     *    this is faster since it may already be in browser cache)
     */
    const loadRazorpayScript = async (): Promise<boolean> => {
        if (typeof window !== 'undefined' && window.Razorpay) {
            console.log('[SubscribeButton] Razorpay already available on window')
            return true
        }

        // Try #1: Same-origin proxy (bypasses ad blockers)
        console.log('[SubscribeButton] Attempting load via proxy...')
        const proxyLoaded = await tryLoadScript('/api/billing/checkout-script')
        if (proxyLoaded) return true

        // Try #2: Direct CDN (fallback — may be blocked by ad blockers)
        console.log('[SubscribeButton] Proxy failed, trying direct CDN...')
        const cdnLoaded = await tryLoadScript('https://checkout.razorpay.com/v1/checkout.js')
        if (cdnLoaded) return true

        return false
    }

    async function handleSubscribe() {
        setLoading(true)
        try {
            const planName = tierName ?? (planTier === 'base' ? 'Weavly Estimator' : 'Weavly Full Suite')
            console.log(`[SubscribeButton] Initializing one-time checkout for ${planName}`)

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
                console.error('[SubscribeButton] Received non-JSON response:', text.substring(0, 100))
                throw new Error(`Server returned ${res.status} (${contentType}). Please refresh and try again.`)
            }

            const data = await res.json() as CreateOrderResponse
            console.log('[SubscribeButton] API response:', data)

            if (!res.ok || data.error) {
                throw new Error(data.error || 'Failed to create payment order')
            }

            const { orderId, amount, currency, keyId, purchaseType } = data
            if (!orderId || !keyId || !amount || !currency || !purchaseType) {
                throw new Error('Payment setup response was incomplete.')
            }
            const checkoutPlanName = data.planName ?? planName
            const checkoutPurpose = purchaseType === 'renewal' ? 'Annual Renewal' : 'First Year'

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
                    setLoading(true)
                    try {
                        console.log('[SubscribeButton] Verifying payment signature...')
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

                        const verifyData = await verifyRes.json()
                        if (!verifyRes.ok || verifyData.error) {
                            throw new Error(verifyData.error || 'Failed to verify payment signature')
                        }

                        toast.success(
                            purchaseType === 'renewal'
                                ? `🎉 Payment successful! ${checkoutPlanName} was renewed.`
                                : `🎉 Payment successful! ${checkoutPlanName} is now active.`
                        )
                        onSuccess?.(response.razorpay_payment_id)
                        // Refresh server components
                        setTimeout(() => router.refresh(), 1500)
                    } catch (err) {
                        toast.error(getErrorMessage(err, 'Payment verification failed.'))
                    } finally {
                        setLoading(false)
                    }
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
        </div>
    )
}
