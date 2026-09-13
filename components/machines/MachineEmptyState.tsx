'use client'

import React from 'react'
import { Cog, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import type { MachineStatusFilter } from './MachineToolbar'

interface MachineEmptyStateProps {
  totalCount: number
  hasSearch: boolean
  statusFilter: MachineStatusFilter
  onAdd: () => void
  onClearSearch: () => void
  onClearFilter: () => void
}

export function MachineEmptyState({
  totalCount,
  hasSearch,
  statusFilter,
  onAdd,
  onClearSearch,
  onClearFilter,
}: MachineEmptyStateProps) {
  const { tx } = useTranslation()

  // Case 1: Factory has 0 machines registered at all
  if (totalCount === 0) {
    return (
      <div role="status" className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-hairline/80 bg-surface p-8 text-center shadow-xs">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-hairline/80 bg-surface-soft text-subtle shadow-2xs"
          aria-hidden="true"
        >
          <Cog className="h-6 w-6" />
        </div>

        <h3 className="mt-4 text-base font-semibold text-ink">
          {tx('No machines yet')}
        </h3>

        <p className="mt-1.5 max-w-sm text-sm text-subtle">
          {tx('Add your first machine to begin configuring your factory.')}
        </p>

        <div className="mt-5">
          <Button
            onClick={onAdd}
            className="h-10 rounded-xl bg-loom px-4 font-medium text-white shadow-xs transition-all duration-150 hover:bg-loom-elevated hover:text-white motion-safe:hover:-translate-y-0.5 active:scale-[0.98] focus-visible:ring-saffron"
          >
            <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
            <span>{tx('Add machine')}</span>
          </Button>
        </div>
      </div>
    )
  }

  // Case 2: Filter returned zero results (and no active search)
  if (!hasSearch && statusFilter === 'active') {
    return (
      <div role="status" className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-hairline/80 bg-surface p-8 text-center shadow-xs">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-hairline/80 bg-surface-soft text-subtle shadow-2xs"
          aria-hidden="true"
        >
          <Cog className="h-5 w-5" />
        </div>

        <h3 className="mt-4 text-base font-semibold text-ink">
          {tx('No active machines')}
        </h3>

        <p className="mt-1.5 max-w-md text-sm text-subtle">
          {tx('Machines become active once they have both a worker and costing assigned.')}
        </p>

        <div className="mt-5">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilter}
            className="rounded-xl border-hairline px-4 font-medium text-ink shadow-2xs hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep focus-visible:ring-saffron"
          >
            {tx('Show all machines')}
          </Button>
        </div>
      </div>
    )
  }

  // Case 3: Search returned zero results (or search + filter)
  return (
    <div role="status" className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-hairline/80 bg-surface p-8 text-center shadow-xs">
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
        {tx('Try another machine name or clear your filters.')}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        {hasSearch && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSearch}
            className="rounded-xl border-hairline px-4 font-medium text-ink shadow-2xs hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep focus-visible:ring-saffron"
          >
            {tx('Clear search')}
          </Button>
        )}
        {statusFilter !== 'all' && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilter}
            className="rounded-xl border-hairline px-4 font-medium text-ink shadow-2xs hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep focus-visible:ring-saffron"
          >
            {tx('Clear filters')}
          </Button>
        )}
      </div>
    </div>
  )
}
