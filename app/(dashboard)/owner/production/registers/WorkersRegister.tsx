'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'
import { useArrivals } from '@/hooks/use-arrivals'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { safeBaseReturnPath } from '@/lib/base-production-navigation'
import type { BaseProductionWorkerWithOperational } from '@/lib/worker-operational'
import { WorkerAddButton, WorkersPageHeader } from '@/components/workers/WorkersPageHeader'
import {
  WorkerToolbar,
  type WorkerShiftFilter,
  type WorkerStatusFilter,
} from '@/components/workers/WorkerToolbar'
import { WorkforceGroup } from '@/components/workers/WorkforceGroup'
import { WorkerEmptyState } from '@/components/workers/WorkerEmptyState'
import WorkerEditor from './WorkerEditor'
import { TourInvitation } from '@/components/tours/TourInvitation'
import type { GuidedTour as GuidedTourComponent } from '@/components/tours/GuidedTour'
import { Button } from '@/components/ui/button'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { formatTourText } from '@/lib/tours/tour-text'
import { makeWorkersTourExamples, workersTourEditor, workersHelpSteps, workersTourSpecs, workersTourCopyKey, workersTourControlLabels, type WorkersTourStep, type WorkersTourPath } from '@/lib/workers-tour'
import { workersTutorialCopy } from '@/lib/i18n/workers-tutorial'
import { ChevronDown, CircleHelp } from 'lucide-react'
import { railIcon, railSurface } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

const GuidedTour = dynamic(() => import('@/components/tours/GuidedTour').then(module => module.GuidedTour), { ssr: false }) as typeof GuidedTourComponent

export default function WorkersRegister({
  workers,
  today, userId, orgId, userMetadata,
}: {
  workers: BaseProductionWorkerWithOperational[]
  today: string
  userId?: string
  orgId?: string
  userMetadata?: Record<string, unknown>
}) {
  const params = useSearchParams()
  const { tx, t, language } = useTranslation()
  const [tourStep, setTourStep] = useState<WorkersTourStep | null>(null)
  const [tourPath, setTourPath] = useState<WorkersTourPath>('piece')
  const arrivedIds = useArrivals(workers.map(worker => worker.id))
  const tourLauncher = useRef<HTMLDivElement>(null)
  const tourReturnFocus = useRef<HTMLElement | null>(null)
  const launchScroll = useRef<{ x: number; y: number } | null>(null)
  // The sample register can clamp a long live page before the lazy runtime mounts.
  useEffect(() => {
    if (tourStep === null && launchScroll.current) {
      window.scrollTo({ left: launchScroll.current.x, top: launchScroll.current.y, behavior: 'instant' })
      launchScroll.current = null
    }
  }, [tourStep])
  const tourSampleActive = tourStep !== null && tourStep !== 'wk-handoff'
  const sampleWorkers = useMemo(() => tourSampleActive ? makeWorkersTourExamples(language) : [], [tourSampleActive, language])
  const steps = useMemo(() => workersTourSpecs(tourPath), [tourPath])
  const preview = tourStep ? workersTourEditor(tourStep, tourPath) : null
  const tourCopy = workersTutorialCopy[language]
  const labels = workersTourControlLabels(t)
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
    ? 'mx-auto grid w-full max-w-2xl grid-cols-1 items-start gap-6'
    : 'mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-8 lg:grid-cols-2'

  return (
    <WorkerEditor
      today={today}
      initialOpen={params.get('add') === 'worker'}
      returnTo={returnTo}
    >
      {({ add, edit, isOpen }) => (
        <div className="workers-workspace-shell mx-auto w-full space-y-5 pb-10 sm:space-y-6">
          {/* 1. Page Header */}
          <div data-workers-tour="header"><WorkersPageHeader
            onAdd={tourStep ? () => {} : add}
            returnTo={tourSampleActive ? undefined : returnTo}
            focus={tourSampleActive ? null : focus}
            hasFocusedWorker={hasFocusedWorker}
            onClearFocus={() => {
              const next = new URLSearchParams(params)
              next.delete('worker')
              window.history.replaceState(null, '', `/owner/workers${next.size ? `?${next}` : ''}`)
            }}
          /></div>

          {!isOpen && (
            <aside className="phone-guidance workers-left-rail guided-tour-left-rail space-y-3" aria-label="Workers guided tour">
              <div ref={tourLauncher} data-workers-tour="launcher">
                <TourInvitation
                  tourId="workers"
                  userId={userId}
                  orgId={orgId}
                  userMetadata={userMetadata}
                  align="full"
                  className="w-full"
                  onLaunch={() => {
                    tourReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
                    launchScroll.current = { x: window.scrollX, y: window.scrollY }
                    setTourPath('piece')
                    setTourStep('wk-paytype')
                  }}
                />
              </div>
            </aside>
          )}
          {tourSampleActive && <p data-tour-sample-banner role="status" data-i18n-skip="true" lang={language} className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink">{tourCommonCopy[language].sampleBanner}</p>}
          {/* 2. Global Toolbar */}
          <div data-workers-tour="toolbar" className="w-full">
            <WorkerToolbar
              search={tourSampleActive ? '' : search}
              onSearchChange={tourStep ? () => {} : handleSearchChange}
              shiftFilter={tourSampleActive ? 'all' : shiftFilter}
              onShiftFilterChange={tourStep ? () => {} : handleShiftChange}
              statusFilter={tourSampleActive ? 'active' : statusFilter}
              onStatusFilterChange={tourStep ? () => {} : handleStatusChange}
              totalCount={tourSampleActive ? sampleWorkers.length : workers.length}
              filteredCount={tourSampleActive ? sampleWorkers.length : visible.length}
            />
          </div>

          {/* 3. Workforce Groups or Global Empty State */}
          {tourSampleActive ? (
            <div data-workers-tour="groups" className="mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-8 lg:grid-cols-2">
              {sampleWorkers.map((worker, index) => (
                <div key={worker.id} data-workers-tour={index === 0 ? 'piece' : 'salary-card'}>
                  <WorkforceGroup title={tx(index === 0 ? 'Piece Rate' : 'Fixed Salary')}
                    subtitle={tx(index === 0 ? 'Paid based on production' : 'Fixed monthly compensation')}
                    workers={[worker]} emptyText="" onEdit={() => {}} tourPreview />
                </div>
              ))}
            </div>
          ) : visible.length > 0 ? (
            <div className={gridClasses}>
              {showPieceGroup && (
                <WorkforceGroup
                  title={tx('Piece Rate')}
                  subtitle={tx('Paid based on production')}
                  count={pieceWorkers.length}
                  workers={pieceWorkers}
                  arrivedIds={arrivedIds}
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
                  arrivedIds={arrivedIds}
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
          {!isOpen && (
            <aside className="phone-guidance workers-reference-rail" aria-label={tourCopy.helpTitle}>
              <div className="workers-reference-action">
                <WorkerAddButton onAdd={tourStep ? () => {} : add} />
              </div>
              <div className="workers-reference-bottom">
                <details
                  hidden={Boolean(tourStep)}
                  data-i18n-skip="true"
                  lang={language}
                  className={cn('ui-details group overflow-hidden', railSurface)}
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-semibold leading-snug text-ink hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/50 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start gap-2.5"><CircleHelp className={cn(railIcon, 'mt-0.5')} aria-hidden="true" />{tourCopy.helpTitle}</span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <dl className="workers-help-list grid max-h-[min(60vh,32rem)] gap-4 overflow-y-auto border-t border-hairline px-4 py-4 text-sm leading-relaxed sm:grid-cols-2">
                    {workersHelpSteps.map(topic => <div key={topic}>
                      <dt className="font-semibold text-ink">{tourCopy.fields[topic][0]}</dt>
                      <dd className="mt-1 text-body">{tourCopy.fields[topic][1]}</dd>
                    </div>)}
                  </dl>
                </details>
              </div>
            </aside>
          )}
          {preview && <WorkerEditor key={`${preview}-${language}`} today={today} tourPreview={{ worker: preview === 'piece' ? sampleWorkers[0] : sampleWorkers[1], editing: preview === 'edit' }}>{() => null}</WorkerEditor>}
          {preview && <style>{'[data-workers-tour-preview="true"] [data-slot="dialog-close"] { display: none; }'}</style>}
          {tourStep && <GuidedTour tourId="workers" steps={steps} step={tourStep}
            onStepChange={setTourStep} launcher={tourLauncher} returnFocus={tourReturnFocus} userId={userId}
            copy={step => {
              const content = tourCopy.steps[workersTourCopyKey(step)]
              return { ...content, body: formatTourText(content.body, { addWorker: `“${labels.addWorker}”`, viewPayroll: `“${labels.viewPayroll}”` }) }
            }}
            extra={tourStep === 'wk-paytype' ? <div className="mt-3 flex flex-wrap gap-2">
              {(['piece', 'salary'] as const).map(path => <Button key={path} type="button"
                data-tour-control={`path-${path}`} aria-pressed={tourPath === path}
                variant={tourPath === path ? 'default' : 'outline'}
                className="h-auto min-h-[44px] flex-1 whitespace-normal px-3 py-2"
                onClick={() => setTourPath(path)}>{tourCopy.paths[path]}</Button>)}
            </div> : undefined} />}
        </div>
      )}
    </WorkerEditor>
  )
}
