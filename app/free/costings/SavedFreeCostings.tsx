'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Sparkles, Trash2 } from 'lucide-react'
import type { EstimateState, EstimatorV3Totals, CostingResultSnapshot } from '@/lib/estimator'
import { createCostingExportModel } from '@/lib/estimator-export'
import { CostingExportDialog } from '@/components/estimator/CostingExportDialog'
import { SavedCostingsTutorial } from '@/components/estimator/SavedCostingsTutorial'
import { costingTourSurface, makeSavedCostingTourExport, makeSavedCostingTourExamples, type SavedCostingStep } from '@/lib/saved-costings-tour'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { freeText } from '@/lib/i18n/free-tier'

type Saved = {
  id: string
  label: string
  created_at: string
  estimate: EstimateState
  result: CostingResultSnapshot
  totals: EstimatorV3Totals
}

const DEMO_STORAGE_KEY = 'weavly:free-demo-costing-deleted'

export default function SavedFreeCostings() {
  const [tourStep, setTourStep] = useState<SavedCostingStep | null>(null)
  const [demoDeleted, setDemoDeleted] = useState(false)
  const [showDeleteNudge, setShowDeleteNudge] = useState(false)
  const tourExport = useMemo(makeSavedCostingTourExport, [])
  const demoCosting = useMemo(() => makeSavedCostingTourExamples()[0] as Saved, [])
  const { language, tx } = useTranslation()
  const [rows, setRows] = useState<Saved[]>([])
  const [selected, setSelected] = useState<Saved | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [nextPage, setNextPage] = useState<number | null>(null)

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

  const handleStepChange = useCallback((nextStep: SavedCostingStep | null) => {
    if (nextStep === 'finish') {
      setShowDeleteNudge(true)
    }
    setTourStep(prev => {
      if (prev === 'finish' && nextStep === null) {
        setShowDeleteNudge(true)
      }
      return nextStep
    })
  }, [])

  const handleDeleteDemo = useCallback(() => {
    setDemoDeleted(true)
    setShowDeleteNudge(false)
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, 'true')
    } catch {}
  }, [])

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

  return (
    <>
      <aside className="saved-costings-left-rail space-y-3" aria-label={freeText(language, 'savedCostings')}>
        <SavedCostingsTutorial free step={tourStep} onStepChange={handleStepChange} />
      </aside>

      <section className="space-y-5" data-free-costing data-sentry-block>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{freeText(language, 'savedCostings')}</h1>
          <p className="text-sm text-slate-600">
            {tx('View and export your completed costings without using your weekly allowance. These are fixed snapshots, not reusable saved qualities.')}
          </p>
        </div>

        {loading && <p role="status">{tx('Loading…')}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{tx('Unable to load saved costings. Please refresh.')}</p>}

        {showDeleteNudge && !demoDeleted && (
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

        {!loading && !error && rows.length === 0 && !showDemoCard && (
          <p className="text-sm text-slate-500">
            {tx('No saved costings yet. Complete a calculation in Cost Estimate to save your first costing.')}
          </p>
        )}

        {showDemoCard && (
          <article
            data-costing-tour="free-sample"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-900">{demoCosting.label}</h2>
                <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                  {freeText(language, 'demoSample')}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {new Intl.DateTimeFormat(`${language}-IN`, { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(demoCosting.created_at))} · ₹{demoCosting.result.productionCostPerM.toFixed(2)}/m
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="bg-white hover:bg-slate-50"
                onClick={() => setSelected(demoCosting)}
              >
                {tx('View breakdown / Export')}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                title={freeText(language, 'deleteDemoSample')}
                aria-label={freeText(language, 'deleteDemoSample')}
                onClick={handleDeleteDemo}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </article>
        )}

        <div className="space-y-3">
          {rows.map(row => (
            <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-xs">
              <div>
                <h2 className="font-semibold text-slate-900">{row.label}</h2>
                <p className="text-sm text-slate-500">
                  {new Intl.DateTimeFormat(`${language}-IN`, { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(row.created_at))} · ₹{row.result.productionCostPerM.toFixed(2)}/m
                </p>
              </div>
              <Button variant="outline" onClick={() => setSelected(row)}>
                {tx('View breakdown / Export')}
              </Button>
            </article>
          ))}
        </div>

        {nextPage !== null && (
          <Button variant="outline" disabled={loading} onClick={() => void loadMore()}>
            {tx('Load more')}
          </Button>
        )}

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
      </section>
    </>
  )
}
