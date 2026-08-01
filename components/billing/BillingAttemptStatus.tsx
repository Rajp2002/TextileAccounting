'use client'

import { useState } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getBillingAttemptPresentation, type BillingAttemptRow } from '@/lib/billing-attempts'

export function BillingAttemptStatus({ attempt }: { attempt: BillingAttemptRow }) {
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const presentation = getBillingAttemptPresentation(attempt.status)
  const Icon = presentation.tone === 'success' ? CheckCircle2 : presentation.tone === 'danger' ? AlertTriangle : Clock
  const border = presentation.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : presentation.tone === 'danger' ? 'border-red-200 bg-red-50 text-red-900' : presentation.tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-blue-200 bg-blue-50 text-blue-950'

  async function checkStatus() {
    if (!attempt.provider_order_id) return
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
          {attempt.provider_payment_id && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider opacity-60">Payment ref. {attempt.provider_payment_id.slice(-8)}</p>}
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
