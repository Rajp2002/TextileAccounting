'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Loader2 } from 'lucide-react'
import { completePlanSelection } from '@/app/(auth)/onboarding/plans/actions'

export function FreeBillingAction({
    isCurrent = false,
    isExpiredPaid = false,
    isEligible = true,
    ineligibleReason,
}: {
    isCurrent?: boolean
    isExpiredPaid?: boolean
    isEligible?: boolean
    ineligibleReason?: string
}) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const handleSelectFree = async () => {
        setBusy(true)
        setError('')
        try {
            const result = await completePlanSelection('free')
            if (result.href) {
                window.location.assign(result.href)
            } else {
                setError(result.error ?? 'Please try again.')
                setBusy(false)
            }
        } catch {
            setError('Unable to activate Free access. Please try again.')
            setBusy(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <p>
                    <span className="text-3xl font-bold tracking-tight text-ink">₹0</span>
                    <span className="ml-2 text-sm text-subtle">/ free forever</span>
                </p>
                <p className="text-sm text-body">2 cost estimates / week</p>
                <p className="text-xs text-subtle">Single-loom costing · No payment required</p>
            </div>
            {isCurrent ? (
                <Button asChild className="w-full">
                    <Link href="/free">Open Free Workspace</Link>
                </Button>
            ) : isExpiredPaid ? (
                <Button variant="outline" disabled className="w-full">
                    Renew paid plan to continue
                </Button>
            ) : !isEligible ? (
                <div className="space-y-2">
                    <Button variant="outline" disabled className="w-full">
                        {ineligibleReason || 'Available during signup'}
                    </Button>
                    <p className="text-center text-xs text-subtle">
                        Free tier is available to new signups during initial onboarding.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    <Button
                        type="button"
                        disabled={busy}
                        onClick={handleSelectFree}
                        className="w-full gap-2"
                    >
                        {busy ? (
                            <>
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                <span>Opening your workspace…</span>
                            </>
                        ) : (
                            <>
                                <span>Continue with Free</span>
                                <ArrowRight className="size-4" aria-hidden="true" />
                            </>
                        )}
                    </Button>
                    {error && (
                        <p role="alert" className="text-center text-xs text-destructive">
                            {error}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
