'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard } from 'lucide-react'
import { toast } from 'sonner'

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
}

export function SubscribeButton({ planId, tierName, displayAmount, onSuccess }: SubscribeButtonProps) {
    const [loading, setLoading] = useState(false)
    const [scriptReady, setScriptReady] = useState(false)

    useEffect(() => {
        if (typeof window !== 'undefined' && window.Razorpay) {
            setScriptReady(true)
            return
        }
        const interval = setInterval(() => {
            if (window.Razorpay) {
                setScriptReady(true)
                clearInterval(interval)
            }
        }, 300)
        const timeout = setTimeout(() => clearInterval(interval), 10000)
        return () => {
            clearInterval(interval)
            clearTimeout(timeout)
        }
    }, [])

    async function handleSubscribe() {
        setLoading(true)
        try {
            const res = await fetch('/api/subscriptions/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId }),
            })
            const body = await res.json()

            if (!res.ok || body.error) {
                throw new Error(body.error ?? 'Failed to initiate subscription')
            }

            const { subscriptionId, keyId } = body

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
                    toast.success('Payment successful! Your subscription will activate shortly.')
                    onSuccess?.(response.razorpay_payment_id)
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
            id={`subscribe-btn-${planId}`}
            onClick={handleSubscribe}
            disabled={loading || !scriptReady}
            size="lg"
            className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200/50 transition-all"
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
