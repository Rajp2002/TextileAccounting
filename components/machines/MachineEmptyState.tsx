'use client'

import React from 'react'
import { Cog, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'

interface MachineEmptyStateProps {
  totalCount: number
  isFiltered: boolean
  hasSearch: boolean
  isOnlyActive: boolean
  onAdd: () => void
  onClearSearch: () => void
  onShowAll: () => void
}

export function MachineEmptyState({
  totalCount,
  isFiltered,
  hasSearch,
  isOnlyActive,
  onAdd,
  onClearSearch,
  onShowAll,
}: MachineEmptyStateProps) {
  const { tx } = useTranslation()

  // Case 1: Search or filter returned zero results
  if (totalCount > 0 && isFiltered) {
    return (
      <div role="status" className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-hairline/80 bg-surface-soft text-subtle shadow-2xs"
          aria-hidden="true"
        >
          <Search className="h-5 w-5" />
        </div>

        <h3 className="mt-4 text-base font-semibold text-ink">
          {tx('No machines found')}
        </h3>

        <p className="mt-1.5 max-w-sm text-sm text-subtle">
          {tx('No machines match your current search or filter.')}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {hasSearch && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSearch}
              className="rounded-xl border-hairline px-4 font-medium text-ink shadow-2xs hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep"
            >
              {tx('Clear search')}
            </Button>
          )}
          {isOnlyActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={onShowAll}
              className="rounded-xl border-hairline px-4 font-medium text-ink shadow-2xs hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep"
            >
              {tx('Show all machines')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Case 2: Factory has no machines registered at all
  return (
    <div role="status" className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-hairline/80 bg-surface-soft text-subtle shadow-2xs"
        aria-hidden="true"
      >
        <Cog className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-ink">
        {tx('Add your first machine')}
      </h3>

      <p className="mt-1.5 max-w-sm text-sm text-subtle">
        {tx('Add machines to manage your factory setup and worker assignments.')}
      </p>

      <div className="mt-5">
        <Button
          onClick={onAdd}
          className="h-10 rounded-xl bg-loom px-4 font-medium text-white shadow-xs transition-all duration-150 hover:bg-loom-elevated hover:text-white motion-safe:hover:-translate-y-0.5 active:scale-[0.98] focus-visible:ring-saffron"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{tx('Add machine')}</span>
        </Button>
      </div>
    </div>
  )
}
