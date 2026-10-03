'use client'
import { Clock3 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { freeText } from '@/lib/i18n/free-tier'
import { formatFreeEditTime } from '@/lib/free-costing-window'

export function FreeRecalculationWindow({ remainingMs, onRecalculate, disabled = false }: {
  remainingMs: number; onRecalculate?: () => void; disabled?: boolean
}) {
  const { language } = useTranslation()
  return <div className="flex flex-wrap items-center gap-2 text-xs text-subtle" data-testid="free-recalculation-window">
    <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      {remainingMs > 0 ? <>{freeText(language, 'editTimeLeft')} <span role="timer" className="font-mono tabular-nums">{formatFreeEditTime(remainingMs)}</span></> : freeText(language, 'editWindowClosed')}
    </span>
    {remainingMs > 0 && onRecalculate && <button type="button" disabled={disabled} onClick={onRecalculate}
      className="inline-flex min-h-9 items-center rounded-full border border-saffron/40 bg-saffron-soft px-3 font-semibold text-saffron-deep disabled:opacity-50">
      {freeText(language, 'recalculate')}
    </button>}
  </div>
}
