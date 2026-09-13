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
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative w-full sm:w-auto">
          <select
            aria-label={tx('Status filter')}
            value={statusFilter}
            onChange={event => onStatusFilterChange(event.target.value as MachineStatusFilter)}
            className="h-10 sm:h-11 w-full sm:w-auto appearance-none rounded-xl border border-hairline bg-surface pl-4 pr-10 text-sm font-medium text-ink shadow-2xs transition-colors hover:border-hairline-strong focus-visible:border-saffron focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron cursor-pointer"
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
          <span className="hidden sm:inline-block text-xs font-medium text-subtle whitespace-nowrap px-1">
            {filteredCount === totalCount
              ? `${totalCount} ${totalCount === 1 ? tx('machine') : tx('machines')}`
              : `${filteredCount} / ${totalCount} ${tx('machines')}`}
          </span>
        )}
      </div>
    </div>
  )
}
