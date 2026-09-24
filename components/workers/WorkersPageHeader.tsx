'use client'

import React from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import { managementReturnLabel } from '@/lib/management-navigation'
import { cn } from '@/lib/utils'

interface WorkersPageHeaderProps {
  onAdd: () => void
  returnTo?: string
  focus?: string | null
  hasFocusedWorker?: boolean
  onClearFocus?: () => void
}

export function WorkersPageHeader({
  onAdd,
  returnTo,
  focus,
  hasFocusedWorker,
  onClearFocus,
}: WorkersPageHeaderProps) {
  const { tx } = useTranslation()

  return (
    <div className="space-y-4">
      {returnTo && (
        <div>
          <NavigationLink
            className="inline-flex min-h-11 items-center text-sm font-medium text-saffron-deep underline transition-colors hover:text-saffron-deep/80 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
            href={returnTo}
          >
            {tx(managementReturnLabel(returnTo))}
          </NavigationLink>
        </div>
      )}

      {focus && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-soft/60 px-4 py-3 text-sm text-ink"
        >
          <span>
            {tx(hasFocusedWorker ? 'Worker filter active' : 'This record is unavailable.')}
          </span>
          {onClearFocus && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFocus}
              className="rounded-lg border-hairline font-medium text-ink hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep"
            >
              {tx('Clear filter')}
            </Button>
          )}
        </div>
      )}

      <header className="relative border-b border-hairline/70 pb-5 text-center sm:pb-6">
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">
          {tx('Workers')}
        </h1>
        <p className="sr-only">{tx('Add and manage your factory workforce.')}</p>
        <div className="workers-inline-add mt-3 flex justify-end sm:absolute sm:right-0 sm:top-0 sm:mt-0">
          <WorkerAddButton onAdd={onAdd} />
        </div>
      </header>
    </div>
  )
}

export function WorkerAddButton({ onAdd, className }: { onAdd: () => void; className?: string }) {
  const { tx } = useTranslation()

  return (
    <Button
      onClick={onAdd}
      className={cn('min-h-12 rounded-xl bg-loom px-5 text-[0.9375rem] font-semibold text-white shadow-[var(--shadow-button)] hover:bg-loom-elevated hover:text-white focus-visible:ring-saffron/40', className)}
    >
      <UserPlus className="size-[1.125rem]" aria-hidden="true" />
      <span>{tx('Add worker')}</span>
    </Button>
  )
}
