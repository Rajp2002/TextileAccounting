'use client'

import React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import { managementReturnLabel } from '@/lib/management-navigation'

interface WorkersPageHeaderProps {
  onAdd: () => void
  returnTo?: string
  focus?: string | null
  hasFocusedWorker?: boolean
  onClearFocus?: () => void
  totalCount?: number
}

export function WorkersPageHeader({
  onAdd,
  returnTo,
  focus,
  hasFocusedWorker,
  onClearFocus,
  totalCount,
}: WorkersPageHeaderProps) {
  const { tx } = useTranslation()

  return (
    <div className="space-y-3">
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

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
              {tx('Workers')}
            </h1>
            {typeof totalCount === 'number' && (
              <span className="text-sm font-normal text-subtle">
                · {totalCount === 1 ? tx('1 worker') : `${totalCount} ${tx('workers')}`}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-subtle">
            {tx('Add and manage your factory workforce.')}
          </p>
        </div>

        <div className="shrink-0">
          <Button
            onClick={onAdd}
            className="h-10 w-full sm:w-auto rounded-xl bg-loom px-4 font-medium text-white shadow-xs transition-all duration-150 hover:bg-loom-elevated hover:text-white motion-safe:hover:-translate-y-0.5 active:scale-[0.98] focus-visible:ring-saffron"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{tx('Add worker')}</span>
          </Button>
        </div>
      </header>
    </div>
  )
}
