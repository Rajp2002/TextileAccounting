'use client'

import React, { useState, useMemo, useRef } from 'react'
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
import { TourInvitation } from '@/components/tours/TourInvitation'
import MachinesTutorial from '@/components/tours/MachinesTutorial'
import { makeMachinesTourExamples, machinesTourEditor, type MachinesTourStep } from '@/lib/machines-tour'
import { machinesTutorialCopy } from '@/lib/i18n/machines-tutorial'

export default function MachinesRegister({
  machines,
  today, userId, orgId, userMetadata,
}: {
  machines: BaseProductionMachineWithReadiness[]
  today: string
  userId?: string
  orgId?: string
  userMetadata?: Record<string, unknown>
}) {
  const params = useSearchParams()
  const { tx, language } = useTranslation()
  const [tourStep, setTourStep] = useState<MachinesTourStep | null>(null)
  const tourLauncher = useRef<HTMLDivElement>(null)
  const examples = useMemo(() => makeMachinesTourExamples(), [])
  const preview = tourStep ? machinesTourEditor(tourStep) : null
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
      {({ add, edit, isOpen }) => (
        <div className="mx-auto w-full max-w-6xl space-y-6">
          {/* 1. Page Header */}
          <div data-machines-tour="header"><MachinesPageHeader onAdd={tourStep ? () => {} : add} returnTo={tourStep ? undefined : returnTo} /></div>
          {!isOpen && <div ref={tourLauncher} data-machines-tour="launcher">
            <TourInvitation tourId="machines" userId={userId} orgId={orgId} userMetadata={userMetadata} onLaunch={() => setTourStep('search')} />
          </div>}
          {tourStep && <p role="status" className="text-xs font-semibold text-saffron-deep">{machinesTutorialCopy[language].sample}</p>}

          {/* 2. Machine Toolbar */}
          <div data-machines-tour="toolbar"><MachineToolbar
            search={tourStep ? '' : search}
            onSearchChange={tourStep ? () => {} : handleSearchChange}
            statusFilter={tourStep ? 'all' : statusFilter}
            onStatusFilterChange={tourStep ? () => {} : handleFilterChange}
            totalCount={tourStep ? examples.length : machines.length}
            filteredCount={tourStep ? examples.length : visible.length}
          /></div>

          {/* 3. Machine Card Grid or Empty State */}
          {tourStep ? (
            <MachineGrid machines={examples} onEdit={() => {}} tourPreview />
          ) : visible.length > 0 ? (
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
          {preview && <MachineEditor key={preview} today={today} tourPreview={{ machine: examples[0], editing: preview === 'edit' }}>{() => null}</MachineEditor>}
          {tourStep && <MachinesTutorial step={tourStep} onStepChange={setTourStep} launcher={tourLauncher} userId={userId} />}
        </div>
      )}
    </MachineEditor>
  )
}
