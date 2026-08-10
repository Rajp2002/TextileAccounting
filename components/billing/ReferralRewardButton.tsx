'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast, userFacingError } from '@/lib/app-notifications'

export function ReferralRewardButton() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function redeem() {
        setLoading(true)
        try {
            const response = await fetch('/api/billing/redeem-referral-year', {
                method: 'POST',
                headers: { Accept: 'application/json' },
            })
            const data = await response.json().catch(() => ({})) as { error?: string }
            if (!response.ok) throw new Error(data.error ?? 'The referral reward could not be redeemed.')

            toast.success('Your free Base Plan year is now reserved for the next annual period.')
            router.refresh()
        } catch (error) {
            toast.error(userFacingError(error, 'The referral reward could not be redeemed.'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            type="button"
            onClick={() => void redeem()}
            disabled={loading}
            className="w-full gap-2 bg-saffron text-ink shadow-none hover:bg-saffron-deep hover:text-white"
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Redeeming free year…' : 'Redeem free annual year'}
        </Button>
    )
}
