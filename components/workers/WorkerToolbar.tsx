'use client'

import React from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n/context'

export type WorkerShiftFilter = 'all' | 'day' | 'night' | 'both'
export type WorkerStatusFilter = 'all' | 'active' | 'inactive'

interface WorkerToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  shiftFilter?: WorkerShiftFilter
  onShiftFilterChange?: (value: WorkerShiftFilter) => void
  statusFilter?: WorkerStatusFilter
  onStatusFilterChange?: (value: WorkerStatusFilter) => void
  totalCount?: number
  filteredCount?: number
  // Backward compatibility
  payType?: string
  onPayTypeChange?: (value: string) => void
  inactive?: boolean
  onInactiveChange?: (showInactive: boolean) => void
}

export function WorkerToolbar({
  search,
  onSearchChange,
  shiftFilter = 'all',
  onShiftFilterChange,
  statusFilter = 'active',
  onStatusFilterChange,
  totalCount,
  filteredCount,
  inactive,
  onInactiveChange,
}: WorkerToolbarProps) {
  const { tx } = useTranslation()

  // Handle backward compatibility for status filter if inactive is provided
  const resolvedStatus = statusFilter || (inactive ? 'all' : 'active')

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Search Input (Takes majority of width) */}
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle/60"
          aria-hidden="true"
        />
        <Input
          type="search"
          className="h-10 sm:h-11 w-full rounded-xl border-hairline bg-surface pl-10 pr-9 text-sm text-ink placeholder:text-subtle/50 shadow-2xs focus-visible:border-saffron focus-visible:ring-saffron"
          aria-label={tx('Search workers')}
          placeholder={tx('Search workers…')}
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

      {/* Right controls: Shift filter + Status filter + subtle count */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {/* Shift Filter Dropdown */}
        <div className="relative w-full sm:w-auto">
          <select
            data-workers-tour="shift-filter"
            aria-label={tx('Shift filter')}
            value={shiftFilter}
            onChange={event => onShiftFilterChange?.(event.target.value as WorkerShiftFilter)}
            className="h-10 sm:h-11 w-full sm:w-auto appearance-none rounded-xl border border-hairline bg-surface pl-4 pr-10 text-sm font-medium text-ink shadow-2xs transition-colors hover:border-hairline-strong focus-visible:border-saffron focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron cursor-pointer"
          >
            <option value="all">{tx('All shifts')}</option>
            <option value="day">{tx('Day shift')}</option>
            <option value="night">{tx('Night shift')}</option>
            <option value="both">{tx('Day & night')}</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle/60"
            aria-hidden="true"
          />
        </div>

        {/* Worker Status Filter Dropdown */}
        <div className="relative w-full sm:w-auto">
          <select
            data-workers-tour="status-filter"
            aria-label={tx('Worker status filter')}
            value={resolvedStatus}
            onChange={event => {
              const val = event.target.value as WorkerStatusFilter
              onStatusFilterChange?.(val)
              onInactiveChange?.(val === 'all')
            }}
            className="h-10 sm:h-11 w-full sm:w-auto appearance-none rounded-xl border border-hairline bg-surface pl-4 pr-10 text-sm font-medium text-ink shadow-2xs transition-colors hover:border-hairline-strong focus-visible:border-saffron focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron cursor-pointer"
          >
            <option value="active">{tx('Active workers')}</option>
            <option value="all">{tx('All workers')}</option>
            <option value="inactive">{tx('Inactive workers')}</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle/60"
            aria-hidden="true"
          />
        </div>

        {/* Subtle worker count */}
        {typeof totalCount === 'number' && typeof filteredCount === 'number' && (
          <span className="hidden sm:inline-block text-xs font-medium text-subtle whitespace-nowrap px-1">
            {filteredCount === totalCount
              ? `${totalCount} ${totalCount === 1 ? tx('worker') : tx('workers')}`
              : `${filteredCount} / ${totalCount} ${tx('workers')}`}
          </span>
        )}
      </div>
    </div>
  )
}
