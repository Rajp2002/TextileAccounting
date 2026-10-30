'use client'

import { useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import type { PaidPlanInterestSource } from '@/lib/paid-plans'

/** Shown instead of checkout until paid plans open. Each tap is a willingness-to-pay signal. */
export function NotifyMeButton({ source, className }: { source: PaidPlanInterestSource; className?: string }) {
    const { tx } = useTranslation()
    const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

    async function register() {
        setState('saving')
        try {
            const response = await fetch('/api/billing/notify-me', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }),
            })
            setState(response.ok ? 'done' : 'error')
        } catch {
            setState('error')
        }
    }

    if (state === 'done') {
        return <p role="status" className="rounded-lg border border-hairline bg-surface px-3 py-3 text-sm font-medium text-ink">{tx("Thanks. We'll tell you when paid plans open.")}</p>
    }
    return (
        <div className="space-y-2">
            <Button type="button" onClick={register} disabled={state === 'saving'} size="lg" className={cn('h-auto min-h-11 w-full gap-2 whitespace-normal bg-loom text-white shadow-md hover:bg-loom-elevated', className)}>
                {state === 'saving' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Bell className="h-4 w-4"/>}
                {tx('Notify me when paid plans open')}
            </Button>
            {state === 'error' && <p role="alert" className="text-sm text-danger">{tx('Could not save your request. Try again.')}</p>}
        </div>
    )
}
