'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

declare global {
    interface Window {
        Razorpay: any
    }
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
            console.log('[SubscribeButton] Initializing subscription for plan:', planId)
            
            const isLoaded = await loadRazorpayScript()
            if (!isLoaded) {
                throw new Error('Failed to load payment gateway. Please check your internet connection.')
            }

            // 1. Create subscription via our API
            const res = await fetch('/api/subscriptions/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ planId }),
            })

            const contentType = res.headers.get('content-type')
            if (!contentType?.includes('application/json')) {
                const text = await res.text()
                console.error('[SubscribeButton] Received non-JSON response:', text.substring(0, 100))
                throw new Error(`Server returned ${res.status} (${contentType}). Please refresh and try again.`)
            }

            const data = await res.json()
            console.log('[SubscribeButton] API response:', data)

            if (!res.ok || data.error) {
                throw new Error(data.error || 'Failed to create subscription')
            }

            const { subscriptionId, keyId } = data

            const rzp = new window.Razorpay({
                key: keyId,
                subscription_id: subscriptionId,
                name: 'Loomi',
                description: `${tierName} Plan — Monthly`,
                image: '/images/LoomiLogo.png',
                handler: function (response: {
                    razorpay_payment_id: string
                    razorpay_subscription_id: string
                    razorpay_signature: string
                }) {
                    toast.success('🎉 Payment successful! Your subscription is now activating.')
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
        } catch (err: any) {
            toast.error(err.message ?? 'Something went wrong. Please try again.')
            setLoading(false)
        }
    }

    return (
        <Button
            type="button"
            id={`subscribe-btn-${planId}`}
            onClick={handleSubscribe}
            disabled={loading}
            size="lg"
            className={cn("w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200/50 transition-all", className)}
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
    )
}
