'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatToSurat } from '@/lib/time'

interface AutoRenewToggleProps {
    /** ISO date string for subscription end, used in the confirmation message */
    currentEnd: string | null
    subscriptionTier?: string
}

type AutoRenewResponse = {
    error?: string
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

export function AutoRenewToggle({ currentEnd, subscriptionTier }: AutoRenewToggleProps) {
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const endFormatted = currentEnd
        ? formatToSurat(currentEnd, 'd MMMM yyyy')
        : 'the end of your current billing period'

    async function handleConfirm() {
        setLoading(true)
        try {
            const res = await fetch('/api/subscriptions/auto-renew', {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
            })

            const contentType = res.headers.get('content-type')
            if (!contentType?.includes('application/json')) {
                throw new Error('Unexpected server response. Please refresh and try again.')
            }

            const data = await res.json() as AutoRenewResponse
            if (!res.ok || data.error) {
                throw new Error(data.error ?? 'Failed to turn off auto-renewal.')
            }

            toast.success('Auto-renewal turned off. Your plan remains active until ' + endFormatted + '.')
            setShowConfirm(false)
            // Refresh the server component to reflect the updated state
            setTimeout(() => router.refresh(), 800)
        } catch (err) {
            toast.error(getErrorMessage(err, 'Something went wrong. Please try again.'))
        } finally {
            setLoading(false)
        }
    }

    if (showConfirm) {
        return (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-900">
                            Are you sure you want to turn off auto-renewal?
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                            Your {subscriptionTier ? `${subscriptionTier} plan` : 'subscription'} will remain
                            active until <strong>{endFormatted}</strong>, then stop automatically.
                            To continue after that, you would need to re-subscribe.{' '}
                            <strong>This cannot be undone.</strong>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowConfirm(false)}
                        className="text-amber-500 hover:text-amber-700 transition-colors"
                        aria-label="Cancel"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowConfirm(false)}
                        className="flex-1 border-amber-300 text-amber-800 hover:bg-amber-100"
                    >
                        Keep auto-renewal on
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        disabled={loading}
                        onClick={handleConfirm}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                        {loading ? 'Turning off…' : 'Yes, turn it off'}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="text-xs text-gray-500 hover:text-red-600 underline underline-offset-2 transition-colors"
        >
            Turn off auto-renewal
        </button>
    )
}
