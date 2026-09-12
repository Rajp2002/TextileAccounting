'use client'

import React from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n/context'

interface WorkerToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  payType: string
  onPayTypeChange: (value: string) => void
  inactive: boolean
  onInactiveChange: (showInactive: boolean) => void
}

export function WorkerToolbar({
  search,
  onSearchChange,
  payType,
  onPayTypeChange,
  inactive,
  onInactiveChange,
}: WorkerToolbarProps) {
  const { tx } = useTranslation()

  return (
    <div className="flex flex-col gap-3 border-y border-hairline/70 bg-surface-soft/25 p-4 sm:flex-row sm:items-center sm:px-6">
      {/* Search Input */}
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle/60"
          aria-hidden="true"
        />
        <Input
          type="search"
          className="h-10 sm:h-11 w-full rounded-xl border-hairline bg-surface pl-10 pr-9 text-sm text-ink placeholder:text-subtle/50 focus-visible:border-saffron focus-visible:ring-saffron"
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

      {/* Pay Type Filter Dropdown */}
      <div className="relative w-full sm:w-auto shrink-0">
        <select
          aria-label={tx('All pay types')}
          value={payType}
          onChange={event => onPayTypeChange(event.target.value)}
          className="h-10 sm:h-11 w-full sm:w-auto appearance-none rounded-xl border border-hairline bg-surface pl-4 pr-10 text-sm font-medium text-ink shadow-2xs transition-colors hover:border-hairline-strong focus-visible:border-saffron focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron cursor-pointer"
        >
          <option value="all">{tx('All pay types')}</option>
          <option value="piece_rate">{tx('Piece rate')}</option>
          <option value="fixed_monthly">{tx('Fixed salary')}</option>
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle/60"
          aria-hidden="true"
        />
      </div>

      {/* Worker Visibility Filter Dropdown */}
      <div className="relative w-full sm:w-auto shrink-0">
        <select
          aria-label={tx('Active workers')}
          value={inactive ? 'all' : 'active'}
          onChange={event => onInactiveChange(event.target.value === 'all')}
          className="h-10 sm:h-11 w-full sm:w-auto appearance-none rounded-xl border border-hairline bg-surface pl-4 pr-10 text-sm font-medium text-ink shadow-2xs transition-colors hover:border-hairline-strong focus-visible:border-saffron focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron cursor-pointer"
        >
          <option value="active">{tx('Active workers')}</option>
          <option value="all">{tx('All workers')}</option>
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle/60"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
