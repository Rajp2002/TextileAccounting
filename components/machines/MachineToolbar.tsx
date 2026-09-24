'use client'

import React from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n/context'

export type MachineStatusFilter = 'all' | 'active' | 'needs_setup'

interface MachineToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: MachineStatusFilter
  onStatusFilterChange: (value: MachineStatusFilter) => void
  totalCount?: number
  filteredCount?: number
}

export function MachineToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  filteredCount,
}: MachineToolbarProps) {
  const { tx } = useTranslation()

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-hairline/80 bg-surface/90 p-2.5 shadow-[var(--shadow-card)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:p-3">
      {/* Search Input (Takes majority of width) */}
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle/60"
          aria-hidden="true"
        />
        <Input
          type="search"
          className="h-11 w-full rounded-xl border-hairline/80 bg-canvas/80 pl-10 pr-9 text-sm text-ink placeholder:text-subtle/60 shadow-none focus-visible:border-saffron focus-visible:ring-saffron/30"
          aria-label={tx('Search machines')}
          placeholder={tx('Search machines...')}
          value={search}
          onChange={event => onSearchChange(event.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
            aria-label={tx('Clear search')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Right controls: Status filter + subtle count */}
      <div className="flex shrink-0 items-center justify-between gap-2.5 sm:justify-end">
        <div className="relative w-full sm:w-auto">
          <select
            aria-label={tx('Status filter')}
            value={statusFilter}
            onChange={event => onStatusFilterChange(event.target.value as MachineStatusFilter)}
            className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-hairline/80 bg-canvas/80 pl-4 pr-10 text-sm font-medium text-ink transition-colors hover:border-hairline-strong focus-visible:border-saffron focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/30 sm:w-auto"
          >
            <option value="all">{tx('All machines')}</option>
            <option value="active">{tx('Active machines')}</option>
            <option value="needs_setup">{tx('Needs setup')}</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle/60"
            aria-hidden="true"
          />
        </div>

        {typeof totalCount === 'number' && typeof filteredCount === 'number' && (
          <span className="inline-flex min-h-8 items-center whitespace-nowrap rounded-full border border-hairline/70 bg-surface-soft/55 px-3 text-xs font-semibold tabular-nums text-subtle">
            {filteredCount === totalCount
              ? `${totalCount} ${totalCount === 1 ? tx('machine') : tx('machines')}`
              : `${filteredCount} / ${totalCount} ${tx('machines')}`}
          </span>
        )}
      </div>
    </div>
  )
}
