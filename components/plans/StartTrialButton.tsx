'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { completePlanSelection } from '@/app/(auth)/onboarding/plans/actions'
import { useTranslation } from '@/lib/i18n/context'
import { liteTrialText } from '@/lib/i18n/lite-trial'
import { cn } from '@/lib/utils'

/**
 * Pay-now control shown beside the trial start: a quiet text link that opens the
 * existing paid checkout. The checkout button itself is SubscribeButton.
 */
export const TRIAL_PAY_NOW_LINK_CLASS =
  'h-auto min-h-[44px] w-full justify-center whitespace-normal bg-transparent px-0 has-[>svg]:px-0 text-ink underline underline-offset-4 shadow-none hover:bg-transparent hover:text-ink [&_svg]:hidden'

interface StartTrialButtonProps {
  className?: string
  /** Runs once the trial is confirmed, just before the browser moves to the workspace. */
  onStarted?: () => void
}

/** Starts the 90-day Lite trial from the verified owner session, then moves to the estimator. */
export function StartTrialButton({ className, onStarted }: StartTrialButtonProps) {
  const { language, tx } = useTranslation()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setPending(true)
    setError('')
    try {
      const result = await completePlanSelection('trial')
      if (result.href) {
        onStarted?.()
        // Stay pending: the page is leaving for the paid workspace.
        window.location.assign(result.href)
        return
      }
      setError(result.error ?? 'Please try again.')
    } catch {
      setError('Unable to start your trial. Please try again.')
    }
    setPending(false)
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="lg"
        disabled={pending}
        aria-busy={pending}
        onClick={() => void start()}
        className={cn('min-h-[44px] w-full gap-2', className)}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        <span>{liteTrialText(language, 'startTrial')}</span>
      </Button>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-center text-sm font-medium text-destructive"
        >
          {tx(error)}
        </p>
      )}
    </div>
  )
}
