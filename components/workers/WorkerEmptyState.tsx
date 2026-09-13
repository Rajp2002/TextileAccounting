'use client'

import React from 'react'
import { Plus, Search, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'

interface WorkerEmptyStateProps {
  totalCount: number
  isFiltered: boolean
  onAdd: () => void
  onClearFilters: () => void
}

export function WorkerEmptyState({
  totalCount,
  isFiltered,
  onAdd,
  onClearFilters,
}: WorkerEmptyStateProps) {
  const { tx } = useTranslation()

  // Case 1: Search or filters returned zero results
  if (totalCount > 0 && isFiltered) {
    return (
      <div
        role="status"
        aria-label={tx('No workers match this view')}
        className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-hairline/80 bg-surface p-8 text-center shadow-xs"
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-hairline/80 bg-surface-soft text-subtle shadow-2xs"
          aria-hidden="true"
        >
          <Search className="h-5 w-5" />
        </div>

        <h3 className="mt-4 text-base font-semibold text-ink">
          {tx('No workers found')}
        </h3>

        <p className="mt-1.5 max-w-sm text-sm text-subtle">
          {tx('Try another name or clear your filters.')}
        </p>

        <div className="mt-5">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="rounded-xl border-hairline px-4 font-medium text-ink shadow-2xs hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep focus-visible:ring-saffron"
          >
            {tx('Clear filters')}
          </Button>
        </div>
      </div>
    )
  }

  // Case 2: Factory has no workers registered at all
  return (
    <div
      role="status"
      className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-hairline/80 bg-surface p-8 text-center shadow-xs"
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-hairline/80 bg-surface-soft text-subtle shadow-2xs"
        aria-hidden="true"
      >
        <User className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-ink">
        {tx('No workers yet')}
      </h3>

      <p className="mt-1.5 max-w-sm text-sm text-subtle">
        {tx('Add workers to start building your factory workforce.')}
      </p>

      <div className="mt-5">
        <Button
          onClick={onAdd}
          className="h-10 rounded-xl bg-loom px-4 font-medium text-white shadow-xs transition-all duration-150 hover:bg-loom-elevated hover:text-white motion-safe:hover:-translate-y-0.5 active:scale-[0.98] focus-visible:ring-saffron"
        >
          <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
          <span>{tx('Add worker')}</span>
        </Button>
      </div>
    </div>
  )
}
