'use client'

import { useState, useRef } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getBillingAttemptPresentation, type BillingAttemptRow } from '@/lib/billing-attempts'

export type BillingAttemptRecovery = Pick<BillingAttemptRow, 'status' | 'provider_order_id' | 'provider_payment_id'>

export function BillingAttemptStatus({ attempt, singleFlight = false }: { attempt: BillingAttemptRecovery; singleFlight?: boolean }) {
  const [checking, setChecking] = useState(false)
  const checkingRef = useRef(false)
  const [message, setMessage] = useState<string | null>(null)
  const presentation = getBillingAttemptPresentation(attempt.status)
  const Icon = presentation.tone === 'success' ? CheckCircle2 : presentation.tone === 'danger' ? AlertTriangle : Clock
  const border = presentation.tone === 'success' ? 'border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] text-[var(--wv-moss-700)]' : presentation.tone === 'danger' ? 'border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] text-[var(--wv-madder-600)]' : presentation.tone === 'warning' ? 'border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] text-[var(--wv-ochre-800)]' : 'border-[var(--wv-lagoon-200)] bg-[var(--wv-lagoon-50)] text-[var(--wv-lagoon-700)]'

  async function checkStatus() {
    if (!attempt.provider_order_id || (singleFlight && checkingRef.current)) return
    checkingRef.current = true
    setChecking(true)
    setMessage(null)
    try {
      const response = await fetch('/api/billing/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ orderId: attempt.provider_order_id, paymentId: attempt.provider_payment_id }),
      })
      const data = await response.json().catch(() => ({})) as { message?: string }
      setMessage(data.message ?? (response.ok ? 'Billing status refreshed.' : 'Status could not be refreshed right now.'))
      if (response.ok || response.status === 202 || response.status === 409) window.location.reload()
    } catch {
      setMessage('Status could not be refreshed right now. Please try again shortly.')
    } finally {
      checkingRef.current = false
      setChecking(false)
    }
  }

  return (
    <div className={`rounded-2xl border p-4 ${border}`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{presentation.label}</p>
          <p className="mt-1 text-sm leading-relaxed opacity-80">{message ?? presentation.message}</p>
          {attempt.provider_payment_id && <p className="mt-2 text-xs font-semibold opacity-60">Payment ref. {attempt.provider_payment_id.slice(-8)}</p>}
          {presentation.shouldCheck && attempt.provider_order_id && (
            <Button type="button" variant="outline" size="sm" onClick={() => void checkStatus()} disabled={checking} className="mt-3 gap-2 bg-white/60">
              <RefreshCw className={checking ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Check payment status
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
