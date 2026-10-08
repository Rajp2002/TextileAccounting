'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'
import { useArrivals } from '@/hooks/use-arrivals'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { safeBaseReturnPath } from '@/lib/base-production-navigation'
import { getMachineReadiness, type BaseProductionMachineWithReadiness } from '@/lib/machine-readiness'
import { MachineAddButton, MachinesPageHeader } from '@/components/machines/MachinesPageHeader'
import { MachineToolbar, type MachineStatusFilter } from '@/components/machines/MachineToolbar'
import { MachineGrid } from '@/components/machines/MachineGrid'
import { MachineEmptyState } from '@/components/machines/MachineEmptyState'
import MachineEditor from './MachineEditor'
import { ChevronDown, CircleHelp, Cog } from 'lucide-react'
import { railIcon, railSurface } from '@/components/ui/rail'
import { cn } from '@/lib/utils'
import { NavigationLink } from '@/components/navigation/navigation-link'
import { TourInvitation } from '@/components/tours/TourInvitation'
import MachinesGuidedTour from '@/components/machines/MachinesGuidedTour'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
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
  const arrivedIds = useArrivals(machines.map(machine => machine.id))
  const tourLauncher = useRef<HTMLDivElement>(null)
  const tourReturnFocus = useRef<HTMLElement | null>(null)
  const launchScroll = useRef<{ x: number; y: number } | null>(null)
  // Sample rows can shorten a long page before the lazy runtime captures scroll.
  useEffect(() => {
    if (tourStep === null && launchScroll.current) {
      window.scrollTo({ left: launchScroll.current.x, top: launchScroll.current.y, behavior: 'instant' })
      launchScroll.current = null
    }
  }, [tourStep])
  const tourSampleActive = tourStep !== null && tourStep !== 'mc-handoff'
  const copy = machinesTutorialCopy[language]
  const examples = useMemo(() => makeMachinesTourExamples(machinesTutorialCopy[language].example), [language])
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
        <div inert={tourStep !== null} className="machines-workspace-shell mx-auto w-full space-y-5 pb-10 sm:space-y-6">
          {/* 1. Page Header */}
          <div data-machines-tour="header">
            <MachinesPageHeader
              onAdd={tourStep ? () => {} : add}
              returnTo={tourSampleActive ? undefined : returnTo}
            />
          </div>
          {!isOpen && (
            <aside className="phone-guidance machines-left-rail guided-tour-left-rail space-y-3" aria-label="Machines guides and tools">
              <div ref={tourLauncher} data-machines-tour="launcher">
                <TourInvitation
                  tourId="machines"
                  userId={userId}
                  orgId={orgId}
                  userMetadata={userMetadata}
                  align="full"
                  className="w-full"
                  onLaunch={() => {
                    tourReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
                    launchScroll.current = { x: window.scrollX, y: window.scrollY }
                    setTourStep('mc-purpose')
                  }}
                />
              </div>
            </aside>
          )}
          {tourSampleActive && <p data-tour-sample-banner role="status" className="text-xs text-muted-foreground">{tourCommonCopy[language].sampleBanner}</p>}

          {/* 2. Machine Toolbar */}
          <div data-machines-tour="toolbar">
            <MachineToolbar
              search={tourSampleActive ? '' : search}
              onSearchChange={tourStep ? () => {} : handleSearchChange}
              statusFilter={tourSampleActive ? 'all' : statusFilter}
              onStatusFilterChange={tourStep ? () => {} : handleFilterChange}
              totalCount={tourSampleActive ? examples.length : machines.length}
              filteredCount={tourSampleActive ? examples.length : visible.length}
            />
          </div>

          {/* 3. Machine Card Grid or Empty State */}
          {tourSampleActive ? (
            <MachineGrid machines={examples} onEdit={() => {}} tourPreview />
          ) : visible.length > 0 ? (
            <MachineGrid machines={visible} arrivedIds={arrivedIds} onEdit={tourStep ? () => {} : edit} />
          ) : (
            <MachineEmptyState
              totalCount={machines.length}
              hasSearch={Boolean(search.trim())}
              statusFilter={statusFilter}
              onAdd={tourStep ? () => {} : add}
              onClearSearch={() => { if (!tourStep) handleSearchChange('') }}
              onClearFilter={() => { if (!tourStep) handleFilterChange('all') }}
            />
          )}
          {!isOpen && (
            <aside className="machines-reference-rail" aria-label={copy.setupTitle}>
              <div className="machines-reference-action">
                <MachineAddButton onAdd={tourStep ? () => {} : add} />
              </div>
              <div className="machines-reference-bottom space-y-3">
                <section
                  aria-labelledby="machines-setup-heading"
                  className={cn('px-4 py-4', railSurface)}
                  data-i18n-skip="true"
                  lang={language}
                >
                  <h2 id="machines-setup-heading" className="flex items-center gap-2 text-sm font-semibold leading-snug text-ink"><Cog className={railIcon} aria-hidden="true" />{copy.setupTitle}</h2>
                  <div className="mt-2 divide-y divide-hairline">
                    <div data-machines-tour="production-next" className="py-3">
                      <NavigationLink
                        href={tourStep ? '#' : '/owner/production?tab=jobs'}
                        onClick={event => { if (tourStep) event.preventDefault() }}
                        className="inline-flex min-h-10 items-center text-sm font-semibold leading-snug text-saffron-deep underline underline-offset-4 hover:text-ink focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
                      >
                        {copy.productionLink}
                      </NavigationLink>
                      <p className="text-sm leading-relaxed text-body">{copy.productionHelp}</p>
                    </div>
                    <div data-machines-tour="assignments-next" className="pt-3">
                      <NavigationLink
                        href={tourStep ? '#' : '/owner/assignments'}
                        onClick={event => { if (tourStep) event.preventDefault() }}
                        className="inline-flex min-h-10 items-center text-sm font-semibold leading-snug text-saffron-deep underline underline-offset-4 hover:text-ink focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
                      >
                        {copy.assignmentsLink}
                      </NavigationLink>
                      <p className="text-sm leading-relaxed text-body">{copy.assignmentsHelp}</p>
                    </div>
                  </div>
                </section>
                <details
                  className={cn('phone-guidance ui-details group overflow-hidden', railSurface)}
                  data-i18n-skip="true"
                  lang={language}
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-semibold leading-snug text-ink hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/50 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2.5"><CircleHelp className={railIcon} aria-hidden="true" />{copy.helpTitle}</span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <dl className="max-h-[min(60vh,32rem)] space-y-4 overflow-y-auto border-t border-hairline px-4 py-4 text-sm leading-relaxed">
                    {copy.help.map(([title, description]) => <div key={title}>
                      <dt className="font-semibold text-ink">{title}</dt>
                      <dd className="mt-1 text-body">{description}</dd>
                    </div>)}
                  </dl>
                </details>
              </div>
            </aside>
          )}
          {preview && <MachineEditor key={preview} today={today} tourPreview={{ machine: examples[0], editing: false }}>{() => null}</MachineEditor>}
          {tourStep && <MachinesGuidedTour step={tourStep} onStepChange={setTourStep} launcher={tourLauncher} returnFocus={tourReturnFocus} userId={userId} />}
        </div>
      )}
    </MachineEditor>
  )
}
