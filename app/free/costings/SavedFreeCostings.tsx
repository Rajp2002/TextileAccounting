'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  History,
  Plus,
  Search,
  Layers3,
  ChevronRight,
  Trash2,
  Sparkles,
  Download,
  Eye,
  FileText,
  X,
  Loader2,
} from 'lucide-react'
import type { EstimateState, EstimatorV3Totals, CostingResultSnapshot } from '@/lib/estimator'
import { createCostingExportModel } from '@/lib/estimator-export'
import { CostingExportDialog } from '@/components/estimator/CostingExportDialog'
import { SavedCostingsTutorial } from '@/components/estimator/SavedCostingsTutorial'
import { savedCostingTourEnding, costingTourSurface, makeSavedCostingTourExport, makeSavedCostingTourExamples, type SavedCostingStep } from '@/lib/saved-costings-tour'
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
import { freeText } from '@/lib/i18n/free-tier'
import { formatTimestampDate } from '@/lib/format'

type Saved = {
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

export default function SavedFreeCostings() {
  const router = useRouter()
  const { language, tx } = useTranslation()
  const [tourStep, setTourStep] = useState<SavedCostingStep | null>(null)
  const [demoDeleted, setDemoDeleted] = useState(false)
  const [showDeleteNudge, setShowDeleteNudge] = useState(false)
  const tourExport = useMemo(makeSavedCostingTourExport, [])
  const demoCosting = useMemo(() => makeSavedCostingTourExamples()[0] as Saved, [])
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
          setRows(data.costings)
          setNextPage(data.nextPage)
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
      setRows(current => [...current, ...data.costings])
      setNextPage(data.nextPage)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const showDemoCard = (!demoDeleted && rows.length === 0) || tourStep !== null

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
  }, [showDemoCard, searchQuery, marginFilter, demoCosting])

  const totalVisibleCount = filteredRows.length + (demoMatchesFilters ? 1 : 0)

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
      <aside className="saved-costings-left-rail" aria-label={tx('Saved Costings guides and tools')}>
        <SavedCostingsTutorial free ending={savedCostingTourEnding(rows.length, loading || error)} step={tourStep} onStepChange={setTourStep} onComplete={() => setShowDeleteNudge(true)} />
      </aside>

      <div className="ui-route-enter max-w-6xl mx-auto space-y-6" data-free-costing data-sentry-block>
        <PageHeader
          icon={History}
          title={freeText(language, 'savedCostings')}
          description={tx('View and export your completed costings without using your monthly allowance. These are fixed snapshots, not reusable saved qualities.')}
          actions={(
            <Button variant="saffron" onClick={() => router.push('/free')}>
              <Plus className="h-4 w-4" /> {tx('New Costing')}
            </Button>
          )}
        />

        {showDeleteNudge && !tourStep && !loading && !error && !demoDeleted && rows.length === 0 && demoMatchesFilters && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-sm text-amber-950 shadow-xs animate-in fade-in-0 duration-200"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="font-semibold text-amber-900">{freeText(language, 'demoTourCompleted')}</p>
                <p className="text-xs text-amber-800/90">{freeText(language, 'demoTourCompletedHint')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100/70"
                onClick={handleDeleteDemo}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                {freeText(language, 'deleteDemoSample')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-amber-700 hover:text-amber-900"
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
              <Label htmlFor="saved-costings-search" className="sr-only">
                {tx('Search saved costings')}
              </Label>
              <Input
                id="saved-costings-search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder={tx('Search saved costings…')}
                aria-label={tx('Search saved costings')}
                className="h-10 w-full min-w-0 pl-9"
              />
            </div>
            <div data-costing-tour="free-filters" className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="saved-costings-sort" className="sr-only">
                  {tx('Sort by')}
                </Label>
                <select
                  id="saved-costings-sort"
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
                <Label htmlFor="saved-costings-margin" className="sr-only">
                  {tx('Margin')}
                </Label>
                <select
                  id="saved-costings-margin"
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
                <Button variant="saffron" onClick={() => router.push('/free')}>
                  <Plus className="h-4 w-4" /> {tx('Calculate First Costing')}
                </Button>
              )
            }
          />
        )}

        <div className="space-y-3">
          {/* Demo sample card */}
          {demoMatchesFilters && (
            <Card
              data-costing-tour="free-sample"
              onClick={event => {
                const target = event.target
                if (target instanceof Element && target.closest('button, [data-slot="dialog-content"], [data-slot="dialog-overlay"]')) return
                setInspectingCosting(demoCosting)
              }}
              className="cursor-pointer border-amber-200/90 bg-amber-50/40 shadow-[var(--shadow-card)] transition hover:border-amber-300 hover:shadow-[var(--shadow-panel)]"
            >
              <CardContent className="p-0">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5 lg:flex-nowrap">
                  <button
                    type="button"
                    onClick={() => setInspectingCosting(demoCosting)}
                    aria-haspopup="dialog"
                    className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-saffron/35"
                  >
                    <span className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-800">
                      <Layers3 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-black text-ink" title={demoCosting.label}>
                          {demoCosting.label}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                          {freeText(language, 'demoSample')}
                        </span>
                        <Badge variant="outline" className="border-amber-200 bg-white text-[10px] font-bold text-amber-900">
                          v1
                        </Badge>
                      </span>
                      <span className="mt-1 block text-xs text-subtle">
                        {tx('Saved')} {formatTimestampDate(demoCosting.created_at, { day: 'numeric', month: 'short', year: 'numeric' })} · {tx('Demo sample')}
                      </span>
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:min-w-[360px]">
                    <div className="rounded-lg border border-amber-200/60 bg-white/80 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx('Production Cost')}</p>
                      <p className="mt-1 font-mono text-sm font-black text-ink">₹{demoCosting.result.productionCostPerM.toFixed(2)}/m</p>
                    </div>
                    <div className="rounded-lg border border-amber-200/60 bg-white/80 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx('Selling Price')}</p>
                      <p className="mt-1 font-mono text-sm font-black text-saffron-deep">₹{demoCosting.result.suggestedSellingPricePerM.toFixed(2)}/m</p>
                    </div>
                    <div className="col-span-2 rounded-lg border border-amber-200/60 bg-white/80 px-3 py-2 sm:col-span-1">
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
                      onClick={() => setSelected(demoCosting)}
                      className="border-amber-300 bg-white text-xs font-semibold text-amber-950 hover:bg-amber-100/60"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      {tx('Export')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDeleteDemo}
                      className="h-9 w-9 text-subtle hover:bg-risk-soft hover:text-risk"
                      title={freeText(language, 'deleteDemoSample')}
                      aria-label={freeText(language, 'deleteDemoSample')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => setInspectingCosting(demoCosting)}
                      aria-haspopup="dialog"
                      aria-label={`Open ${demoCosting.label} details`}
                      className="hidden rounded-md p-2 text-amber-700 hover:bg-amber-100/70 sm:block"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* User saved costings as independent cards */}
          {filteredRows.map(row => (
            <Card
              key={row.id}
              onClick={event => {
                const target = event.target
                if (target instanceof Element && target.closest('button, [data-slot="dialog-content"], [data-slot="dialog-overlay"]')) return
                setInspectingCosting(row)
              }}
              className="cursor-pointer border-hairline bg-surface shadow-[var(--shadow-card)] transition hover:border-saffron/40 hover:shadow-[var(--shadow-panel)]"
            >
              <CardContent className="p-0">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5 lg:flex-nowrap">
                  <button
                    type="button"
                    onClick={() => setInspectingCosting(row)}
                    aria-haspopup="dialog"
                    className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-saffron/35"
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
                          v1
                        </Badge>
                      </span>
                      <span className="mt-1 block text-xs text-subtle">
                        {tx('Saved')} {formatTimestampDate(row.created_at, { day: 'numeric', month: 'short', year: 'numeric' })} · {tx('Fixed snapshot')}
                      </span>
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:min-w-[360px]">
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

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
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
                  <DialogTitle className="min-w-0 flex-1 truncate text-xl font-black" title={inspectingCosting.label}>
                    {inspectingCosting.label}
                  </DialogTitle>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="outline" className="border-info/25 bg-info-soft text-[10px] font-bold text-info">
                      {tx('Fixed snapshot')}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      v1
                    </Badge>
                  </div>
                </div>
                <DialogDescription>
                  {tx('Saved costing snapshot')} · {formatTimestampDate(inspectingCosting.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
                </DialogDescription>
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
                        {tx('Fixed snapshot')} · {formatTimestampDate(inspectingCosting.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
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
                      {tx('This is an immutable costing snapshot. Viewing and exporting do not deduct from your monthly calculation quota.')}
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
