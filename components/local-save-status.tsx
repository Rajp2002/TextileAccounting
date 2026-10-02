'use client'

import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import type { DraftSaveStatus } from '@/hooks/useAutosave'

export type LocalSaveStatusValue = DraftSaveStatus | 'server-saving' | 'server-saved'

const statusKeys = {
  pending: 'common.draft_pending',
  saved: 'common.local_saved',
  error: 'common.draft_error',
  'server-saving': 'common.server_saving',
  'server-saved': 'common.server_saved',
} as const

/** Callers provide confirmed local/server state; connectivity is not a save receipt. */
export function LocalSaveStatus({ status, className }: { status: LocalSaveStatusValue; className?: string }) {
  const { t } = useTranslation()
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-i18n-skip="true"
      className={cn('min-w-0 text-[12px] leading-relaxed', status === 'error' ? 'text-risk' : 'text-muted-foreground', className)}
    >
      {status === 'idle' ? null : t(statusKeys[status])}
    </p>
  )
}
