'use client'

import React, { useState, useMemo } from 'react'
import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { safeBaseReturnPath } from '@/lib/base-production-navigation'
import type { BaseProductionWorkerWithOperational } from '@/lib/worker-operational'
import { WorkersPageHeader } from '@/components/workers/WorkersPageHeader'
import {
  WorkerToolbar,
  type WorkerShiftFilter,
  type WorkerStatusFilter,
} from '@/components/workers/WorkerToolbar'
import { WorkforceGroup } from '@/components/workers/WorkforceGroup'
import { WorkerEmptyState } from '@/components/workers/WorkerEmptyState'
import WorkerEditor from './WorkerEditor'

export default function WorkersRegister({
  workers,
  today,
}: {
  workers: BaseProductionWorkerWithOperational[]
  today: string
}) {
  const params = useSearchParams()
  const { tx } = useTranslation()
  useLocalizedPageTitle(`${tx('Workers')} | Weavly`)

  const focus = params.get('worker')
  const returnTo = safeBaseReturnPath(params.get('returnTo'))

  // Initialize filters from query params
  const initialSearch = params.get('search') ?? ''
  const initialShift: WorkerShiftFilter =
    params.get('shift') === 'day'
      ? 'day'
      : params.get('shift') === 'night'
        ? 'night'
        : params.get('shift') === 'both'
          ? 'both'
          : 'all'

  const initialStatus: WorkerStatusFilter =
    params.get('status') === 'all' || params.get('inactive') === '1'
      ? 'all'
      : params.get('status') === 'inactive'
        ? 'inactive'
        : 'active'

  const payType = params.get('payType') ?? 'all'

  const [search, setSearch] = useState(initialSearch)
  const [shiftFilter, setShiftFilter] = useState<WorkerShiftFilter>(initialShift)
  const [statusFilter, setStatusFilter] = useState<WorkerStatusFilter>(initialStatus)

  const updateUrl = (newSearch: string, newShift: WorkerShiftFilter, newStatus: WorkerStatusFilter) => {
    const next = new URLSearchParams(params)
    if (newSearch.trim()) next.set('search', newSearch.trim())
    else next.delete('search')

    if (newShift !== 'all') next.set('shift', newShift)
    else next.delete('shift')

    if (newStatus === 'all') {
      next.set('status', 'all')
      next.set('inactive', '1')
    } else if (newStatus === 'inactive') {
      next.set('status', 'inactive')
      next.delete('inactive')
    } else {
      next.delete('status')
      next.delete('inactive')
    }

    window.history.replaceState(null, '', `/owner/workers${next.size ? `?${next}` : ''}`)
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    updateUrl(val, shiftFilter, statusFilter)
  }

  const handleShiftChange = (val: WorkerShiftFilter) => {
    setShiftFilter(val)
    updateUrl(search, val, statusFilter)
  }

  const handleStatusChange = (val: WorkerStatusFilter) => {
    setStatusFilter(val)
    updateUrl(search, shiftFilter, val)
  }

  const clearFilters = () => {
    setSearch('')
    setShiftFilter('all')
    setStatusFilter('all')
    const next = new URLSearchParams(params)
    next.delete('search')
    next.delete('shift')
    next.delete('status')
    next.delete('inactive')
    next.delete('payType')
    next.delete('worker')
    window.history.replaceState(null, '', `/owner/workers${next.size ? `?${next}` : ''}`)
  }

  // Filtered workers list
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()

    return workers.filter(worker => {
      // 1. Worker focus
      if (focus && worker.id !== focus) return false

      // 2. Status filter
      if (statusFilter === 'active' && !worker.is_active) return false
      if (statusFilter === 'inactive' && worker.is_active) return false

      // 3. Shift filter
      if (shiftFilter === 'day' && worker.shift_availability !== 'day' && worker.shift_availability !== 'both') {
        return false
      }
      if (shiftFilter === 'night' && worker.shift_availability !== 'night' && worker.shift_availability !== 'both') {
        return false
      }
      if (shiftFilter === 'both' && worker.shift_availability !== 'both') {
        return false
      }

      // 4. PayType URL param support (for backwards-compatibility)
      if (payType !== 'all' && worker.pay_type !== payType) return false

      // 5. Search query
      if (!query) return true
      const searchBlob = `${worker.name} ${worker.role ?? ''}`.toLowerCase()
      return searchBlob.includes(query)
    })
  }, [workers, search, shiftFilter, statusFilter, payType, focus])

  const pieceWorkers = useMemo(
    () => visible.filter(w => w.pay_type !== 'fixed_monthly'),
    [visible]
  )

  const fixedWorkers = useMemo(
    () => visible.filter(w => w.pay_type === 'fixed_monthly'),
    [visible]
  )

  const hasFocusedWorker = Boolean(focus && workers.some(w => w.id === focus))
  const hasActiveSearch = Boolean(search.trim())
  const isFiltered = Boolean(hasActiveSearch || shiftFilter !== 'all' || statusFilter !== 'all' || payType !== 'all' || focus)

  // Preferred search behavior: Hide an empty group when searching, unless both are empty
  const showPieceGroup = payType !== 'fixed_monthly' && (!hasActiveSearch || pieceWorkers.length > 0 || fixedWorkers.length === 0)
  const showFixedGroup = payType !== 'piece_rate' && (!hasActiveSearch || fixedWorkers.length > 0 || pieceWorkers.length === 0)

  // Layout grid column classes based on whether one or both groups are visible
  const isSingleGroupVisible = (showPieceGroup && !showFixedGroup) || (!showPieceGroup && showFixedGroup)
  const gridClasses = isSingleGroupVisible
    ? 'grid grid-cols-1 gap-6 items-start max-w-2xl mx-auto'
    : 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start'

  return (
    <WorkerEditor
      today={today}
      initialOpen={params.get('add') === 'worker'}
      returnTo={returnTo}
    >
      {({ add, edit }) => (
        <div className="mx-auto w-full max-w-6xl space-y-6">
          {/* 1. Page Header */}
          <WorkersPageHeader
            onAdd={add}
            returnTo={returnTo}
            focus={focus}
            hasFocusedWorker={hasFocusedWorker}
            onClearFocus={() => {
              const next = new URLSearchParams(params)
              next.delete('worker')
              window.history.replaceState(null, '', `/owner/workers${next.size ? `?${next}` : ''}`)
            }}
            totalCount={workers.length}
          />

          {/* 2. Global Toolbar */}
          <WorkerToolbar
            search={search}
            onSearchChange={handleSearchChange}
            shiftFilter={shiftFilter}
            onShiftFilterChange={handleShiftChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusChange}
            totalCount={workers.length}
            filteredCount={visible.length}
          />

          {/* 3. Workforce Groups or Global Empty State */}
          {visible.length > 0 ? (
            <div className={gridClasses}>
              {showPieceGroup && (
                <WorkforceGroup
                  title={tx('Piece Rate')}
                  subtitle={tx('Paid based on production')}
                  count={pieceWorkers.length}
                  workers={pieceWorkers}
                  emptyText={tx('No piece-rate workers')}
                  onEdit={edit}
                />
              )}

              {showFixedGroup && (
                <WorkforceGroup
                  title={tx('Fixed Salary')}
                  subtitle={tx('Fixed monthly compensation')}
                  count={fixedWorkers.length}
                  workers={fixedWorkers}
                  emptyText={tx('No fixed-salary workers')}
                  onEdit={edit}
                />
              )}
            </div>
          ) : (
            <WorkerEmptyState
              totalCount={workers.length}
              isFiltered={isFiltered}
              onAdd={add}
              onClearFilters={clearFilters}
            />
          )}
        </div>
      )}
    </WorkerEditor>
  )
}
