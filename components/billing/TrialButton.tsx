'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface TrialButtonProps {
    onSuccess?: (trialEnd: string) => void
    compact?: boolean
}

export function TrialButton({ onSuccess, compact }: TrialButtonProps) {
    const [loading, setLoading] = useState(false)

    async function handleStartTrial() {
        setLoading(true)
        try {
            console.log('[TrialButton] Starting fetch to /api/subscriptions/trial...')
            const res = await fetch('/api/subscriptions/trial', { 
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            })

            const contentType = res.headers.get('content-type')
            if (!contentType?.includes('application/json')) {
                const text = await res.text()
                console.error('[TrialButton] Received non-JSON response:', text.substring(0, 100))
                throw new Error(`Server returned ${res.status} (${contentType}). Please refresh and try again.`)
            }

            const body = await res.json()
            console.log('[TrialButton] Response body:', body)

            if (!res.ok || body.error) {
                throw new Error(body.error ?? 'Failed to start trial')
            }

            const endDate = new Date(body.trialEnd).toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })

            toast.success(`🎉 Trial activated! Enjoy Premium access until ${endDate}.`)
            onSuccess?.(body.trialEnd)
        } catch (err: any) {
            console.error('[TrialButton] Error:', err)
            // Show the actual error message or the Safari-specific error with context
            const msg = err.message || 'Something went wrong'
            toast.error(msg === 'The string did not match the expected pattern.' 
                ? 'Browser error: Connection interrupted. Please try again.' 
                : msg)
        } finally {
            setLoading(false)
        }
    }

    if (compact) {
        return (
            <Button
                type="button"
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
            type="button"
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
