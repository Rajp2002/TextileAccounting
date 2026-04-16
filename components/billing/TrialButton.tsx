'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface TrialButtonProps {
    onSuccess?: (trialEnd: string) => void
    compact?: boolean
}

export function TrialButton({ onSuccess, compact }: TrialButtonProps) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function handleStartTrial() {
        setLoading(true)
        try {
            const res = await fetch('/api/subscriptions/trial', { method: 'POST' })
            const body = await res.json()

            if (!res.ok || body.error) {
                throw new Error(body.error ?? 'Failed to start trial')
            }

            const endDate = new Date(body.trialEnd).toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })

            toast.success(`🎉 Trial activated! Enjoy Premium access until ${endDate}.`)
            onSuccess?.(body.trialEnd)

            // Reload to show trial state
            router.refresh()
        } catch (err: any) {
            toast.error(err.message ?? 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (compact) {
        return (
            <Button
                id="start-trial-btn"
                onClick={handleStartTrial}
                disabled={loading}
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {loading ? 'Starting...' : 'Start Free Trial'}
            </Button>
        )
    }

    return (
        <Button
            id="start-trial-btn"
            onClick={handleStartTrial}
            disabled={loading}
            size="lg"
            className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200/60 transition-all"
        >
            {loading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting trial...
                </>
            ) : (
                <>
                    <Sparkles className="h-4 w-4" />
                    Start Free Trial — No Card Needed
                </>
            )}
        </Button>
    )
}
