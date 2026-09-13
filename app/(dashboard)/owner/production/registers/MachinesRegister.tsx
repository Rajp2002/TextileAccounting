'use client'

import React, { useState, useMemo } from 'react'
import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { safeBaseReturnPath } from '@/lib/base-production-navigation'
import { getMachineReadiness, type BaseProductionMachineWithReadiness } from '@/lib/machine-readiness'
import { MachinesPageHeader } from '@/components/machines/MachinesPageHeader'
import { MachineToolbar, type MachineStatusFilter } from '@/components/machines/MachineToolbar'
import { MachineGrid } from '@/components/machines/MachineGrid'
import { MachineEmptyState } from '@/components/machines/MachineEmptyState'
import MachineEditor from './MachineEditor'

export default function MachinesRegister({
  machines,
  today,
}: {
  machines: BaseProductionMachineWithReadiness[]
  today: string
}) {
  const params = useSearchParams()
  const { tx } = useTranslation()
  useLocalizedPageTitle(`${tx('Machines')} | Weavly`)

  const returnTo = safeBaseReturnPath(params.get('returnTo'))

  // Initialize search & status filter from query parameters if present, defaulting to 'all'
  const initialSearch = params.get('search') ?? ''
  const initialFilter: MachineStatusFilter =
    params.get('status') === 'active'
      ? 'active'
      : params.get('status') === 'needs_setup'
        ? 'needs_setup'
        : 'all'

  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<MachineStatusFilter>(initialFilter)

  const updateUrl = (newSearch: string, newFilter: MachineStatusFilter) => {
    const next = new URLSearchParams(params)
    if (newSearch.trim()) next.set('search', newSearch.trim())
    else next.delete('search')

    if (newFilter !== 'all') next.set('status', newFilter)
    else next.delete('status')

    window.history.replaceState(null, '', `/owner/machines${next.size ? `?${next}` : ''}`)
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    updateUrl(val, statusFilter)
  }

  const handleFilterChange = (val: MachineStatusFilter) => {
    setStatusFilter(val)
    updateUrl(search, val)
  }

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()

    return machines.filter(machine => {
      const readiness = getMachineReadiness(machine)

      // 1. Status filter
      if (statusFilter === 'active' && !readiness.isActive) return false
      if (statusFilter === 'needs_setup' && readiness.isActive) return false

      // 2. Search query filter
      if (!query) return true

      const typeFormatted = machine.machine_type.replaceAll('_', ' ').toLowerCase()
      const searchBlob = [
        machine.name,
        machine.custom_label ?? '',
        typeFormatted,
        readiness.workerName ?? '',
        readiness.costingLabel ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return searchBlob.includes(query)
    })
  }, [machines, search, statusFilter])

  return (
    <MachineEditor
      today={today}
      initialOpen={params.get('add') === 'machine'}
      returnTo={returnTo}
    >
      {({ add, edit }) => (
        <div className="mx-auto w-full max-w-6xl space-y-6">
          {/* 1. Page Header */}
          <MachinesPageHeader onAdd={add} returnTo={returnTo} />

          {/* 2. Machine Toolbar */}
          <MachineToolbar
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleFilterChange}
            totalCount={machines.length}
            filteredCount={visible.length}
          />

          {/* 3. Machine Card Grid or Empty State */}
          {visible.length > 0 ? (
            <MachineGrid machines={visible} onEdit={edit} />
          ) : (
            <MachineEmptyState
              totalCount={machines.length}
              hasSearch={Boolean(search.trim())}
              statusFilter={statusFilter}
              onAdd={add}
              onClearSearch={() => handleSearchChange('')}
              onClearFilter={() => handleFilterChange('all')}
            />
          )}
        </div>
      )}
    </MachineEditor>
  )
}
