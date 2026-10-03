'use client'
import { Clock3 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { freeText } from '@/lib/i18n/free-tier'
import { formatFreeEditTime } from '@/lib/free-costing-window'
import { cn } from '@/lib/utils'

export function FreeRecalculationWindow({ remainingMs, onRecalculate, disabled = false, variant = 'default' }: {
  remainingMs: number; onRecalculate?: () => void; disabled?: boolean; variant?: 'default' | 'prominent'
}) {
  const { language } = useTranslation()
  const prominent = variant === 'prominent' && remainingMs > 0
  return <div className={cn('flex flex-wrap items-center gap-2 text-xs text-subtle', prominent && 'gap-3 rounded-xl border border-saffron/30 bg-saffron-soft px-3 py-2 text-sm font-medium text-ink')} data-testid="free-recalculation-window">
    <span className="inline-flex flex-wrap items-center gap-1.5"><Clock3 className={cn('h-3.5 w-3.5 shrink-0', prominent && 'h-4 w-4 text-saffron-deep')} aria-hidden="true" />
      {remainingMs > 0 ? <>{freeText(language, 'editTimeLeft')} <span role="timer" className={cn('font-mono tabular-nums', prominent && 'font-bold text-saffron-deep')}>{formatFreeEditTime(remainingMs)}</span></> : freeText(language, 'editWindowClosed')}
    </span>
    {remainingMs > 0 && onRecalculate && <button type="button" disabled={disabled} onClick={onRecalculate}
      className={cn('inline-flex min-h-9 items-center justify-center rounded-full border border-saffron/40 bg-saffron-soft px-3 font-semibold text-saffron-deep outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 disabled:opacity-50', prominent && 'min-h-[44px] rounded-lg border-transparent bg-saffron px-4 text-ink shadow-[var(--shadow-button)] transition-colors hover:bg-[var(--wv-action-accent-hover)]')}>
      {freeText(language, 'recalculate')}
    </button>}
  </div>
}
