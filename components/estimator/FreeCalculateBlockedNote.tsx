'use client'

import { AlertCircle, ArrowRight, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { freeText } from '@/lib/i18n/free-tier'
import type { FreeCalculateBlock } from '@/lib/free-calculate-block'

function formatResetDate(resetsAt: string | null | undefined, language: string) {
  if (!resetsAt) return ''
  const date = new Date(resetsAt)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(`${language}-IN`, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(date)
  } catch {
    return ''
  }
}

/**
 * Says why Calculate & save is unavailable, beside the button itself. At a
 * used-up allowance it offers the way forward: the Lite trial when the
 * account may still start it, otherwise Lite (and Base only where visible).
 * Plans open in place, so the typed costing stays on the page.
 */
export function FreeCalculateBlockedNote({
  id,
  block,
  resetsAt,
  draftKept,
  baseVisible,
  liteTrialEligible,
  onViewPlans,
  onRefresh,
  className = '',
}: {
  id: string
  block: FreeCalculateBlock
  resetsAt: string | null | undefined
  /** The page's inputs are stored on this device. */
  draftKept: boolean
  baseVisible: boolean
  liteTrialEligible: boolean
  onViewPlans: () => void
  onRefresh: () => void
  className?: string
}) {
  const { language } = useTranslation()

  if (block === 'checking') {
    return (
      <p id={id} role="status" className={`flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--color-muted)] ${className}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {freeText(language, 'checkingUsage')}
      </p>
    )
  }

  const resetDate = block === 'allowance_used' ? formatResetDate(resetsAt, language) : ''
  const upgradeLabel = liteTrialEligible
    ? freeText(language, 'tryLiteFree')
    : freeText(language, baseVisible ? 'planExplore' : 'upgradeButton')

  return (
    <div id={id} role="status" className={`rounded-lg border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-3 py-2.5 text-xs leading-relaxed text-[var(--wv-ochre-900)] ${className}`}>
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-0.5">
          {block === 'allowance_used' ? (
            <>
              <p className="font-semibold">{freeText(language, 'noCostingsLeft')}</p>
              <p>{freeText(language, 'calculateAfterReset')}{resetDate ? ` ${freeText(language, 'reset', { date: resetDate })}` : ''}</p>
              {draftKept && <p>{freeText(language, 'draftKept')}</p>}
            </>
          ) : (
            <p className="font-medium">{freeText(language, block === 'paused' ? 'paused' : block === 'account' ? 'denied' : 'statusUnavailable')}</p>
          )}
        </div>
      </div>
      {block === 'allowance_used' && (
        <Button type="button" className="mt-2.5 h-auto min-h-[44px] w-full gap-2 whitespace-normal" onClick={onViewPlans}>
          {upgradeLabel}
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Button>
      )}
      {block === 'unavailable' && (
        <Button type="button" variant="outline" className="mt-2.5 h-auto min-h-[44px] w-full gap-2 whitespace-normal" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {freeText(language, 'refresh')}
        </Button>
      )}
    </div>
  )
}
