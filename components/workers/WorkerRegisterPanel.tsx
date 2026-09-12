'use client'

import React from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { BaseProductionWorker } from '@/lib/base-production-core'
import { WorkerToolbar } from './WorkerToolbar'
import { WorkerRow } from './WorkerRow'
import { WorkerEmptyState } from './WorkerEmptyState'

interface WorkerRegisterPanelProps {
  workers: BaseProductionWorker[]
  visible: BaseProductionWorker[]
  today: string
  search: string
  onSearchChange: (value: string) => void
  payType: string
  onPayTypeChange: (value: string) => void
  inactive: boolean
  onInactiveChange: (showInactive: boolean) => void
  onAdd: () => void
  onEdit: (worker: BaseProductionWorker) => void
  onClearFilters: () => void
}

export function WorkerRegisterPanel({
  workers,
  visible,
  today,
  search,
  onSearchChange,
  payType,
  onPayTypeChange,
  inactive,
  onInactiveChange,
  onAdd,
  onEdit,
  onClearFilters,
}: WorkerRegisterPanelProps) {
  const { tx } = useTranslation()

  // Display count reflects current scope: search/filter matches, all workers, or active workers
  const isFiltered = Boolean(search.trim() || payType !== 'all' || !inactive)
  const displayCount = search.trim() || payType !== 'all'
    ? visible.length
    : inactive
      ? workers.length
      : workers.filter(w => w.is_active).length

  const countLabel = displayCount === 1 ? tx('1 worker') : `${displayCount} ${tx('workers')}`

  return (
    <section
      aria-labelledby="workforce-register-heading"
      className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden"
    >
      {/* Register Header */}
      <header className="flex items-center justify-between px-5 py-3.5 sm:px-6">
        <h2
          id="workforce-register-heading"
          className="text-sm sm:text-base font-semibold tracking-tight text-ink"
        >
          {tx('Workforce register')}
        </h2>
        <span className="text-xs sm:text-sm text-subtle">
          {countLabel}
        </span>
      </header>

      {/* Toolbar */}
      <WorkerToolbar
        search={search}
        onSearchChange={onSearchChange}
        payType={payType}
        onPayTypeChange={onPayTypeChange}
        inactive={inactive}
        onInactiveChange={onInactiveChange}
      />

      {/* Worker List / Empty State */}
      {visible.length > 0 ? (
        <ul role="list" className="divide-y divide-hairline">
          {visible.map(worker => (
            <li key={worker.id} role="listitem">
              <WorkerRow worker={worker} today={today} onEdit={onEdit} />
            </li>
          ))}
        </ul>
      ) : (
        <WorkerEmptyState
          totalCount={workers.length}
          isFiltered={isFiltered}
          onAdd={onAdd}
          onClearFilters={onClearFilters}
        />
      )}
    </section>
  )
}
