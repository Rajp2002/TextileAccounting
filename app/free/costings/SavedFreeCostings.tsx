'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Layers3,
  ChevronRight,
  EyeOff,
  Sparkles,
  Download,
  Eye,
  FileText,
  X,
  Loader2,
  BookOpen,
  SlidersHorizontal,
} from 'lucide-react'
import type { EstimateState, EstimatorV3Totals, CostingResultSnapshot } from '@/lib/estimator'
import { createCostingExportModel } from '@/lib/estimator-export'
import { CostingExportDialog } from '@/components/estimator/CostingExportDialog'
import { SavedCostingsTutorial } from '@/components/estimator/SavedCostingsTutorial'
import { savedCostingTourEnding, isSavedCostingHandoff, costingTourSurface, makeSavedCostingTourExport, makeSavedCostingTourExamples, type SavedCostingStep } from '@/lib/saved-costings-tour'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, PageHeader, Toolbar } from '@/components/ui/page-header'
import { useTranslation } from '@/lib/i18n/context'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { freeText } from '@/lib/i18n/free-tier'
import { freeMobileText } from '@/lib/i18n/free-mobile'
import { FreeRecalculationWindow } from '@/components/estimator/FreeRecalculationWindow'
import { remainingFreeEditMs, type FreeEditWindow } from '@/lib/free-costing-window'
import { useFreeEditClock } from '@/hooks/use-free-edit-clock'
import { formatTimestampDate } from '@/lib/format'

type Saved = {
  revision?: number
  editWindow?: FreeEditWindow
  id: string
  label: string
  created_at: string
  estimate: EstimateState
  result: CostingResultSnapshot
  totals: EstimatorV3Totals
}

type CostingSort = 'recent' | 'oldest' | 'cost_asc' | 'margin_desc'
type MarginFilter = 'all' | 'negative' | 'under_10' | '10_to_20' | 'over_20'

const DEMO_STORAGE_KEY = 'weavly:free-demo-costing-deleted'

export default function SavedFreeCostings({ userId, orgId, userMetadata, embedded = false, initialCostingId, idPrefix = '' }: {
  userId?: string; orgId?: string; userMetadata?: Record<string, unknown>; embedded?: boolean; initialCostingId?: string; idPrefix?: string
}) {
  const router = useRouter()
  const { language, tx } = useTranslation()
  const searchId = `${idPrefix}saved-costings-search`
  const sortId = `${idPrefix}saved-costings-sort`
  const marginId = `${idPrefix}saved-costings-margin`
  const [tourStep, setTourStep] = useState<SavedCostingStep | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => {
    if (!helpOpen || !window.matchMedia('(max-width: 767.98px), (pointer: coarse) and (max-height: 500px) and (max-width: 1023.98px)').matches) return
    const frame = requestAnimationFrame(() => document.getElementById('free-history-help')?.querySelector<HTMLButtonElement>('button')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [helpOpen])
  const [demoDeleted, setDemoDeleted] = useState(false)
  const [showDeleteNudge, setShowDeleteNudge] = useState(false)
  const tourExport = useMemo(makeSavedCostingTourExport, [])
  const demoCosting = useMemo(() => makeSavedCostingTourExamples()[0] as Saved, [])
  const [serverTime, setServerTime] = useState<string>()
  const now = useFreeEditClock(embedded ? undefined : serverTime)
  const [rows, setRows] = useState<Saved[]>([])
  const [selected, setSelected] = useState<Saved | null>(null)
  const [inspectingCosting, setInspectingCosting] = useState<Saved | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [nextPage, setNextPage] = useState<number | null>(null)

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState('')
  const [costingSort, setCostingSort] = useState<CostingSort>('recent')
  const [marginFilter, setMarginFilter] = useState<MarginFilter>('all')

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem(DEMO_STORAGE_KEY) === 'true') {
        setDemoDeleted(true)
      }
    } catch {}
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/free/costings', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) throw Error()
        return r.json()
      })
      .then(data => {
        if (active) {
          setServerTime(data.serverTime)
          setRows(data.costings)
          setNextPage(data.nextPage)
          setInspectingCosting(data.costings.find((costing: Saved) => costing.id === initialCostingId) ?? null)
        }
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [initialCostingId])

  // A browser-wide preference, as before; it hides a demonstration, never a saved costing.
  const handleShowDemo = useCallback(() => {
    setDemoDeleted(false)
    try {
      localStorage.removeItem(DEMO_STORAGE_KEY)
    } catch {}
  }, [])

  const handleDeleteDemo = useCallback(() => {
    setDemoDeleted(true)
    setShowDeleteNudge(false)
    if (inspectingCosting?.id === demoCosting.id) {
      setInspectingCosting(null)
    }
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, 'true')
    } catch {}
  }, [inspectingCosting?.id, demoCosting.id])

  async function loadMore() {
    if (nextPage === null) return
    setLoading(true)
    setError(false)
    try {
      const r = await fetch(`/api/free/costings?page=${nextPage}`, { cache: 'no-store' })
      if (!r.ok) throw Error()
      const data = await r.json()
      setServerTime(data.serverTime)
      setRows(current => [...current, ...data.costings])
      setNextPage(data.nextPage)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const tourSampleActive = tourStep !== null && !isSavedCostingHandoff(tourStep)
  const showDemoCard = (!demoDeleted && rows.length === 0) || tourSampleActive

  const filteredRows = useMemo(() => {
    let list = [...rows]
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(r => (r.label || '').toLowerCase().includes(q))
    }
    if (marginFilter !== 'all') {
      list = list.filter(r => {
        const margin = r.result?.actualMarginPct ?? 0
        if (marginFilter === 'negative') return margin < 0
        if (marginFilter === 'under_10') return margin >= 0 && margin < 10
        if (marginFilter === '10_to_20') return margin >= 10 && margin <= 20
        if (marginFilter === 'over_20') return margin > 20
        return true
      })
    }
    list.sort((a, b) => {
      if (costingSort === 'oldest') return Date.parse(a.created_at) - Date.parse(b.created_at)
      if (costingSort === 'cost_asc') return (a.result?.productionCostPerM ?? 0) - (b.result?.productionCostPerM ?? 0)
      if (costingSort === 'margin_desc') return (b.result?.actualMarginPct ?? 0) - (a.result?.actualMarginPct ?? 0)
      return Date.parse(b.created_at) - Date.parse(a.created_at)
    })
    return list
  }, [rows, searchQuery, marginFilter, costingSort])

  const demoMatchesFilters = useMemo(() => {
    if (tourSampleActive) return true
    if (!showDemoCard) return false
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      if (!demoCosting.label.toLowerCase().includes(q)) return false
    }
    if (marginFilter !== 'all') {
      const margin = demoCosting.result.actualMarginPct
      if (marginFilter === 'negative' && margin >= 0) return false
      if (marginFilter === 'under_10' && (margin < 0 || margin >= 10)) return false
      if (marginFilter === '10_to_20' && (margin < 10 || margin > 20)) return false
      if (marginFilter === 'over_20' && margin <= 20) return false
    }
    return true
  }, [tourSampleActive, showDemoCard, searchQuery, marginFilter, demoCosting])

  const totalVisibleCount = (tourSampleActive ? 0 : filteredRows.length) + (demoMatchesFilters ? 1 : 0)

  // Derive detailed cost lines for inspection dialog
  const activeDetailCostLines: Array<[string, number]> = useMemo(() => {
    if (!inspectingCosting?.result) return []
    const res = inspectingCosting.result
    const yarnLines: Array<[string, number]> = res.audit
      ? [
          ['Base warp yarn', res.audit.warp.layers.reduce((sum, row) => sum + row.baseCostPerMeter, 0)],
          ['Base weft yarn', res.audit.weft.layers.reduce((sum, row) => sum + row.baseCostPerMeter, 0)],
          ['Yarn wastage / crimp', res.audit.yarnAdjustmentCostPerMeter],
        ]
      : [
          ['Warp yarn (saved adjusted cost)', res.breakdown.warpCostPerM],
          ['Weft yarn (saved adjusted cost)', res.breakdown.weftCostPerM],
        ]

    return [
      ...yarnLines,
      ['Weaving', res.breakdown.weaveCostPerM],
      ['Warping & sizing', res.breakdown.warpingAndSizingPerM],
      ['Processing & finishing', (res.breakdown.windingPerM || 0) + (res.breakdown.processingPerM || 0) + (res.breakdown.finishingPerM || 0)],
      ['Factory expenses', res.breakdown.overheadPerM],
    ]
  }, [inspectingCosting])

  return (
    <>
      {!embedded && <aside className="saved-costings-left-rail" id="free-history-help" data-free-history-help data-expanded={helpOpen || tourStep !== null} aria-label={tx('Saved Costings guides and tools')}>
        <Button variant="ghost" className="free-mobile-help-trigger" disabled={tourStep !== null} onClick={() => { setHelpOpen(false); document.getElementById('free-history-help-trigger')?.focus() }}>
          <X className="h-4 w-4" /> {tx('Close')}
        </Button>
        <SavedCostingsTutorial free userId={userId} orgId={orgId} userMetadata={userMetadata} ending={savedCostingTourEnding(rows.length, loading || error)} step={tourStep} onStepChange={setTourStep} onComplete={() => setShowDeleteNudge(true)} />
      </aside>}

      <div className="saved-costings-workspace ui-route-enter max-w-6xl mx-auto space-y-6" data-free-costing data-free-history={!embedded || undefined} data-sentry-block>
        <PageHeader
          className={!embedded ? 'free-mobile-page-header' : undefined}
          title={freeText(language, 'savedCostings')}
          actions={(
            <>
            {!embedded && <Button id="free-history-help-trigger" variant="ghost" className="free-mobile-help-trigger" aria-expanded={helpOpen || tourStep !== null} aria-controls="free-history-help" disabled={tourStep !== null} onClick={() => setHelpOpen(open => !open)}>
              <BookOpen className="h-4 w-4" /> {freeMobileText(language, 'help')}
            </Button>}
            <Button data-tour-anchor="free-costings.new" variant="saffron" onClick={() => router.push('/free')}>
              <Plus className="h-4 w-4" /> {tx('New Costing')}
            </Button>
            </>
          )}
        />

        {showDeleteNudge && !tourStep && !loading && !error && !demoDeleted && rows.length === 0 && demoMatchesFilters && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)]/90 p-3.5 text-sm text-[var(--wv-ochre-900)] shadow-xs animate-in fade-in-0 duration-200"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 shrink-0 text-[var(--wv-ochre-700)]" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[var(--wv-ochre-900)]">{freeText(language, 'demoTourCompleted')}</p>
                <p className="text-xs text-[var(--wv-ochre-800)]/90">{freeText(language, 'demoTourCompletedHint')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-[var(--wv-ochre-300)] bg-white text-xs font-semibold text-[var(--wv-ochre-900)] hover:bg-[var(--wv-ochre-100)]/70"
                onClick={handleDeleteDemo}
              >
                <EyeOff className="mr-1.5 h-3.5 w-3.5 text-[var(--wv-ochre-700)]" aria-hidden="true" />
                {freeText(language, 'hideExample')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-[var(--wv-ochre-700)] hover:text-[var(--wv-ochre-900)]"
                onClick={() => setShowDeleteNudge(false)}
              >
                {freeText(language, 'dismiss')}
              </Button>
            </div>
          </div>
        )}

        <Toolbar data-costing-tour="search-and-filters" className="overflow-visible">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_auto_auto]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <Label htmlFor={searchId} className="sr-only">
                {tx('Search saved costings')}
              </Label>
              <Input
                id={searchId}
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder={tx('Search saved costings…')}
                aria-label={tx('Search saved costings')}
                className="h-10 w-full min-w-0 pl-9"
              />
            </div>
            {!embedded && <Button variant="outline" className="free-mobile-help-trigger free-history-filter-toggle" aria-expanded={filtersOpen || tourStep !== null} aria-controls="free-history-filters" onClick={() => setFiltersOpen(open => !open)}>
              <SlidersHorizontal className="h-4 w-4" /> {freeMobileText(language, 'filters')}
            </Button>}
            <div id="free-history-filters" data-expanded={filtersOpen || tourStep !== null} data-costing-tour="free-filters" className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={sortId} className="sr-only">
                  {tx('Sort by')}
                </Label>
                <select
                  id={sortId}
                  value={costingSort}
                  onChange={event => setCostingSort(event.target.value as CostingSort)}
                  className="h-10 rounded-md border border-hairline bg-surface px-3 text-sm font-medium text-ink"
                >
                  <option value="recent">{tx('Recently saved')}</option>
                  <option value="oldest">{tx('Oldest saved')}</option>
                  <option value="cost_asc">{tx('Lowest production cost')}</option>
                  <option value="margin_desc">{tx('Highest margin')}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={marginId} className="sr-only">
                  {tx('Margin')}
                </Label>
                <select
                  id={marginId}
                  value={marginFilter}
                  onChange={event => setMarginFilter(event.target.value as MarginFilter)}
                  className="h-10 rounded-md border border-hairline bg-surface px-3 text-sm font-medium text-ink"
                >
                  <option value="all">{tx('All margins')}</option>
                  <option value="negative">{tx('Negative margin')}</option>
                  <option value="under_10">{tx('Under 10%')}</option>
                  <option value="10_to_20">{tx('10–20%')}</option>
                  <option value="over_20">{tx('Over 20%')}</option>
                </select>
              </div>
            </div>
          </div>
          {!embedded && (costingSort !== 'recent' || marginFilter !== 'all') && <p className="free-mobile-only mt-2 text-sm text-body" role="status">
            {costingSort !== 'recent' && tx(costingSort === 'oldest' ? 'Oldest saved' : costingSort === 'cost_asc' ? 'Lowest production cost' : 'Highest margin')}
            {costingSort !== 'recent' && marginFilter !== 'all' && ' · '}
            {marginFilter !== 'all' && tx(marginFilter === 'negative' ? 'Negative margin' : marginFilter === 'under_10' ? 'Under 10%' : marginFilter === '10_to_20' ? '10–20%' : 'Over 20%')}
          </p>}
          <p className="mt-3 text-xs font-medium text-body">
            {totalVisibleCount} {totalVisibleCount === 1 ? tx('saved costing') : tx('saved costings')}
          </p>
        </Toolbar>

        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-subtle">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-saffron" />
            <p role="status">{tx('Loading…')}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-risk/30 bg-risk-soft/50 p-4 text-sm text-risk" role="alert">
            {tx('Unable to load saved costings. Please refresh.')}
          </div>
        )}

        {!loading && !error && totalVisibleCount === 0 && (
          <EmptyState
            icon={FileText}
            title={searchQuery.trim() || marginFilter !== 'all' ? tx('No matching saved costings found') : tx('No saved costings yet')}
            description={
              searchQuery.trim() || marginFilter !== 'all'
                ? tx('Try searching for a different quality label or clear your filters.')
                : tx('Complete a calculation in Cost Estimate to save your first costing snapshot.')
            }
            action={
              searchQuery.trim() || marginFilter !== 'all' ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('')
                    setMarginFilter('all')
                  }}
                >
                  {tx('Clear search & filters')}
                </Button>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="saffron" onClick={() => router.push('/free')}>
                    <Plus className="h-4 w-4" /> {tx('Calculate First Costing')}
                  </Button>
                  {demoDeleted && rows.length === 0 && (
                    <Button variant="outline" onClick={handleShowDemo}>{freeText(language, 'showExample')}</Button>
                  )}
                </div>
              )
            }
          />
        )}

        <div className="space-y-3">
          {tourSampleActive && <p data-i18n-skip="true" lang={language} className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink">{tourCommonCopy[language].sampleBanner}</p>}
          {/* Demo sample card */}
          {demoMatchesFilters && (
            <Card
              data-costing-tour="free-sample"
              onClick={event => {
                const target = event.target
                if (target instanceof Element && target.closest('button, [data-slot="dialog-content"], [data-slot="dialog-overlay"]')) return
                setInspectingCosting(demoCosting)
              }}
              className="cursor-pointer border-[var(--wv-saffron-200)]/90 bg-[var(--wv-saffron-50)]/40 shadow-[var(--shadow-card)] transition hover:border-[var(--wv-saffron-300)] hover:shadow-[var(--shadow-panel)]"
            >
              <CardContent className="p-0">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5 lg:flex-nowrap">
                  <button
                    type="button"
                    onClick={() => setInspectingCosting(demoCosting)}
                    aria-haspopup="dialog"
                    className="free-history-record-title group flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-saffron/35"
                  >
                    <span className="mt-0.5 rounded-lg bg-[var(--wv-saffron-100)] p-2 text-saffron-deep">
                      <Layers3 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-black text-ink" title={demoCosting.label}>
                          {demoCosting.label}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-[var(--wv-saffron-100)] px-2 py-0.5 text-xs font-semibold text-saffron-deep ring-1 ring-inset ring-[var(--wv-saffron-200)]">
                          {freeText(language, 'exampleBadge')}
                        </span>
                        <Badge variant="outline" className="border-[var(--wv-saffron-200)] bg-white text-[10px] font-bold text-saffron-deep">
                          v1
                        </Badge>
                      </span>
                      <span className="mt-1 block text-xs text-subtle">
                        {freeText(language, 'exampleNotYours')}
                      </span>
                    </span>
                  </button>

                  <div className="free-history-metrics grid grid-cols-2 gap-2 sm:grid-cols-3 sm:min-w-[360px]">
                    <div className="rounded-lg border border-[var(--wv-saffron-200)]/60 bg-white/80 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx('Production Cost')}</p>
                      <p className="mt-1 font-mono text-sm font-black text-ink">₹{demoCosting.result.productionCostPerM.toFixed(2)}/m</p>
                    </div>
                    <div className="rounded-lg border border-[var(--wv-saffron-200)]/60 bg-white/80 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx('Selling Price')}</p>
                      <p className="mt-1 font-mono text-sm font-black text-saffron-deep">₹{demoCosting.result.suggestedSellingPricePerM.toFixed(2)}/m</p>
                    </div>
                    <div className="col-span-2 rounded-lg border border-[var(--wv-saffron-200)]/60 bg-white/80 px-3 py-2 sm:col-span-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx('Margin')}</p>
                      <p className={`mt-1 font-mono text-sm font-black ${demoCosting.result.actualMarginPct < 0 ? 'text-risk' : 'text-success'}`}>
                        {demoCosting.result.actualMarginPct.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      data-tour-anchor="free-costings.sample-export"
                      onClick={() => setSelected(demoCosting)}
                      className="border-[var(--wv-saffron-300)] bg-white text-xs font-semibold text-ink hover:bg-[var(--wv-saffron-100)]/60"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      {tx('Export')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDeleteDemo}
                      className="h-9 w-9 text-subtle hover:bg-surface-soft hover:text-ink"
                      title={freeText(language, 'hideExample')}
                      aria-label={freeText(language, 'hideExample')}
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => setInspectingCosting(demoCosting)}
                      aria-haspopup="dialog"
                      aria-label={`Open ${demoCosting.label} details`}
                      className="hidden rounded-md p-2 text-saffron-deep hover:bg-[var(--wv-saffron-100)]/70 sm:block"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* User saved costings as independent cards */}
          {!tourSampleActive && filteredRows.map((row, index) => (
            <Card
              key={row.id}
              data-tour-anchor={index === 0 ? "free-costings.first-card" : undefined}
              tabIndex={index === 0 ? -1 : undefined}
              onClick={event => {
                const target = event.target
                if (target instanceof Element && target.closest('button, [data-slot="dialog-content"], [data-slot="dialog-overlay"]')) return
                setInspectingCosting(row)
              }}
              className="cursor-pointer border-hairline bg-surface shadow-[var(--shadow-card)] transition hover:border-saffron/40 hover:shadow-[var(--shadow-panel)]"
            >
              <CardContent className="p-0">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
                  <div className="flex w-full min-w-0 basis-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setInspectingCosting(row)}
                      aria-haspopup="dialog"
                      className="free-history-record-title group flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-saffron/35"
                    >
                      <span className="mt-0.5 rounded-lg bg-saffron-soft p-2 text-saffron-deep">
                        <Layers3 className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-base font-black text-ink" title={row.label}>
                            {row.label}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-bold">
                            v{row.revision ?? 1}
                          </Badge>
                        </span>
                        <span className="mt-1 block text-xs text-subtle">
                          {tx('Saved')} {formatTimestampDate(row.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </span>
                    </button>
                    {!embedded && row.editWindow && (
                      <div className="self-start sm:max-w-[55%]">
                        <FreeRecalculationWindow
                          variant="prominent"
                          remainingMs={remainingFreeEditMs(row.editWindow, now)}
                          onRecalculate={() => router.push(`/free?costing=${row.id}`)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="free-history-metrics grid grid-cols-2 gap-2 sm:grid-cols-3 sm:min-w-[360px] sm:flex-1">
                    <div className="rounded-lg bg-surface-soft px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx('Production Cost')}</p>
                      <p className="mt-1 font-mono text-sm font-black text-ink">₹{row.result.productionCostPerM.toFixed(2)}/m</p>
                    </div>
                    <div className="rounded-lg bg-surface-soft px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx('Selling Price')}</p>
                      <p className="mt-1 font-mono text-sm font-black text-saffron-deep">₹{row.result.suggestedSellingPricePerM.toFixed(2)}/m</p>
                    </div>
                    <div className="col-span-2 rounded-lg bg-surface-soft px-3 py-2 sm:col-span-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx('Margin')}</p>
                      <p className={`mt-1 font-mono text-sm font-black ${row.result.actualMarginPct < 0 ? 'text-risk' : 'text-success'}`}>
                        {row.result.actualMarginPct.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 self-end sm:self-center">
                    <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(row)}
                      className="text-xs font-semibold"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      {tx('Export')}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setInspectingCosting(row)}
                      aria-haspopup="dialog"
                      aria-label={`Open ${row.label} details`}
                      className="hidden rounded-md p-2 text-subtle hover:bg-surface-soft sm:block"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {nextPage !== null && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" disabled={loading} onClick={() => void loadMore()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {tx('Load more')}
            </Button>
          </div>
        )}
      </div>

      {/* Detailed Costing Breakdown Dialog */}
      <Dialog
        open={!!inspectingCosting}
        onOpenChange={open => {
          if (!open) setInspectingCosting(null)
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-[960px]"
        >
          {inspectingCosting && (
            <div className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto">
              <DialogHeader className="sticky top-0 z-20 border-b border-hairline bg-surface px-5 py-4 pr-16 sm:pl-6 sm:pr-16">
                <div className="flex min-w-0 items-center gap-2 pr-2">
                  <DialogTitle className={`${!embedded ? 'free-history-dialog-title ' : ''}min-w-0 flex-1 truncate text-xl font-black`} title={inspectingCosting.label}>
                    {inspectingCosting.label}
                  </DialogTitle>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="outline" className="border-info/25 bg-info-soft text-[10px] font-bold text-info">
                      {tx('Saved')}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      v{inspectingCosting.revision ?? 1}
                    </Badge>
                  </div>
                </div>
                <DialogDescription>
                  {tx('Saved costing snapshot')} · {formatTimestampDate(inspectingCosting.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
                </DialogDescription>
                {!embedded && inspectingCosting.editWindow && <FreeRecalculationWindow remainingMs={remainingFreeEditMs(inspectingCosting.editWindow,now)} onRecalculate={() => router.push(`/free?costing=${inspectingCosting.id}`)} />}
                <DialogClose asChild>
                  <button
                    type="button"
                    aria-label={tx('Close details')}
                    className="absolute right-4 top-4 z-30 inline-flex h-9 w-9 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </DialogClose>
              </DialogHeader>

              <div className="w-full min-w-0 bg-surface-soft/60 p-4 sm:p-5">
                <section data-costing-tour="breakdown" className="rounded-xl border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-ink">{tx('Costing breakdown')}</p>
                      <p className="mt-0.5 text-xs text-subtle">
                        {tx('Saved costing snapshot')} · {formatTimestampDate(inspectingCosting.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div data-costing-tour="reuse" className="flex flex-wrap gap-2">
                      <Button
                        variant="saffron"
                        size="sm"
                        onClick={() => {
                          const target = inspectingCosting
                          setInspectingCosting(null)
                          setSelected(target)
                        }}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        {tx('View breakdown / Export')}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 divide-y divide-hairline text-sm">
                    {activeDetailCostLines.map(([lbl, val]) => (
                      <div key={lbl} className="flex items-center justify-between py-2">
                        <span className="text-body">{lbl}</span>
                        <span className="font-mono font-semibold text-ink">₹{Number(val).toFixed(2)}/m</span>
                      </div>
                    ))}
                  </div>

                  <div data-costing-tour="economics" className="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-loom p-3 text-white sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] uppercase text-surface-muted">{tx('Production Cost')}</p>
                      <p className="mt-1 font-mono text-sm font-black">₹{inspectingCosting.result.productionCostPerM.toFixed(2)}/m</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-surface-muted">{tx('Suggested Selling Price')}</p>
                      <p className="mt-1 font-mono text-sm font-black text-saffron">₹{inspectingCosting.result.suggestedSellingPricePerM.toFixed(2)}/m</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-surface-muted">{tx('Margin')}</p>
                      <p className="mt-1 font-mono text-sm font-black text-success">{inspectingCosting.result.actualMarginPct.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-surface-soft p-3 text-xs text-subtle">
                    <p>
                      {freeText(language, 'freeSavedPolicy')}
                    </p>
                  </div>
                </section>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tour preview export dialog */}
      {costingTourSurface(tourStep) === 'export' && (
        <CostingExportDialog
          key={tourStep}
          tutorialPreview
          open
          onOpenChange={() => {}}
          model={tourExport}
          defaultMode={tourStep === 'internal' ? 'internal' : 'customer'}
          defaultBusinessName="Tour sample"
          defaultCustomerName="Sample customer"
          sourceRecordKind="costing"
        />
      )}

      {/* User costing export dialog */}
      <CostingExportDialog
        open={!!selected && !tourStep}
        onOpenChange={open => {
          if (!open) setSelected(null)
        }}
        model={
          selected
            ? createCostingExportModel({
                qualityLabel: selected.label,
                state: selected.estimate,
                totals: selected.totals,
                result: selected.result,
              })
            : null
        }
        sourceRecordKind="costing"
        documentReference={selected?.id}
      />
    </>
  )
}
