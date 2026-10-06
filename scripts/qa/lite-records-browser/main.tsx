import React from 'react'
import { createRoot } from 'react-dom/client'
import QuotesClient from '../../../app/(dashboard)/owner/quotes/QuotesClient'
import RatesClient from '../../../app/(dashboard)/owner/rates/RatesClient'
import SavedFreeCostings from '../../../app/free/costings/SavedFreeCostings'
import { LitePriorFreeHistory } from '../../../components/estimator/LitePriorFreeHistory'
import { OwnerPlanProvider } from '../../../components/providers/owner-plan-provider'
import { I18nProvider } from '../../../lib/i18n/context'
import { Toaster } from 'sonner'
import { f1State } from '../../../__tests__/fixtures/costing-characterization'
import { buildCostingResult, calcFullTotals } from '../../../lib/estimator'
import { createEstimatorDraft, getEstimatorDraftStorageKey } from '../../../lib/estimator-drafts'
import type { CostRateRow } from '../../../lib/cost-rates'
import type { SubscriptionTier } from '../../../lib/subscription-access'
import '../../../app/globals.css'
const params = new URL(location.href).searchParams
localStorage.setItem('weavly_language', params.get('lang') ?? 'en')
const tier = (params.get('tier') ?? 'lite') as SubscriptionTier
const makeQuote = (id: string, label: string, version: number) => {
  const state = f1State({ profitPct: version === 1 ? 12 : 15 })
  const result = buildCostingResult(state, calcFullTotals(state))
  return { id, status: 'draft' as const, party_name: null, quality_label: label, quote_price_per_meter: 45.5 + version, landed_cost_per_meter: 38.5 + version, intended_margin_percent: 12, created_at: `2026-10-0${version}T10:00:00Z`, updated_at: `2026-10-0${version}T10:00:00Z`, meters: 5000, snapshot_data: state, version_number: version, costing_group_id: label, record_kind: 'costing' as const, costing_result_snapshot: result, production_cost_per_meter: 36.5 + version, expected_profit_per_meter: 5, actual_margin_percent: 12, is_archived: false, is_favorite: version === 2 }
}
const quotes = [makeQuote('11111111-1111-4111-8111-111111111111', 'Cotton Roto Sheeting', 2), makeQuote('22222222-2222-4222-8222-222222222222', 'Cotton Roto Sheeting', 1), makeQuote('33333333-3333-4333-8333-333333333333', 'Premium Airjet Twill with a longer descriptive quality name', 1)]
const rates: CostRateRow[] = [{ id: '44444444-4444-4444-8444-444444444444', name: '80/72 Roto Polyester', category: 'yarn_warp', unit: 'per_kg', current_value: 180, previous_value: 175, effective_date: '2026-10-01', last_reviewed_at: '2026-06-01', review_interval_days: 30, source: 'Synthetic supplier', notes: 'Confirm supplier price before future estimates', apply_as_default: false, updated_at: '2026-10-01T10:00:00Z', is_active: true, is_reviewed: false, discovery_source: 'saved_costing', fabric_names: ['Cotton Roto Sheeting'], saved_quality_count: 1 }, { id: '55555555-5555-4555-8555-555555555555', name: '30/1000 Multi Cotton with a longer descriptive yarn name', category: 'yarn_weft', unit: 'per_kg', current_value: 285, previous_value: 280, effective_date: '2026-10-01', last_reviewed_at: '2026-10-01', review_interval_days: 90, source: 'Synthetic supplier', notes: null, apply_as_default: false, updated_at: '2026-10-01T10:00:00Z', is_active: true, is_reviewed: true, discovery_source: 'saved_quality', fabric_names: ['Premium Airjet Twill'], saved_quality_count: 1 }]
Reflect.set(window, '__liteRecords', { calls: [], mode: 'ok', delay: 100, rates, quotes })
Reflect.set(window, '__liteDraft', { key: getEstimatorDraftStorageKey('synthetic-org', 'synthetic-owner'), draft: createEstimatorDraft({ state: f1State({ orderQuantityM: 1234 }), partyName: 'Unsaved customer', qualityLabel: 'Unsaved quality', warpInstruction: '', weftInstruction: '' }) })
const originalFetch = window.fetch.bind(window)
window.fetch = (input, init) => String(input).startsWith('/api/free/costings')
  ? Promise.resolve(params.get('priorError') ? new Response('Synthetic failure', { status: 500 }) : Response.json({ costings: [{ id: '66666666-6666-4666-8666-666666666666', label: 'Earlier Free receipt', created_at: '2026-10-01T10:00:00Z', estimate: quotes[0].snapshot_data, result: quotes[0].costing_result_snapshot, totals: calcFullTotals(quotes[0].snapshot_data), revision: 2 }], serverTime: '2026-10-06T10:00:00Z', nextPage: null }))
  : originalFetch(input, init)
const view = params.get('view') ?? (location.pathname.endsWith('/rates') ? 'rates' : 'quotes')
const fixture = view === 'rates' ? <RatesClient initialRates={params.get('empty') ? [] : rates} initialConflicts={[]} defaultReviewIntervalDays={90} userId="synthetic-owner" orgId="synthetic-org" /> : <QuotesClient initialQuotes={params.get('empty') ? [] : quotes} initialTemplates={[]} initialWorkers={[]} userId="synthetic-owner" orgId="synthetic-org" canUseProductionPipeline={tier === 'base'} organizationName="Synthetic Weaving Factory" loadError={params.get('error') === '1'} />
createRoot(document.getElementById('root')!).render(<I18nProvider><OwnerPlanProvider access={{ subscriptionTier: tier, effectiveTier: tier }}><main className="mx-auto min-h-screen max-w-7xl bg-background px-3 py-4 pb-24 text-ink" style={{ fontFamily: 'system-ui, sans-serif' }}>{params.get('prior') && (tier === 'lite' && !params.get('baseline') ? <LitePriorFreeHistory><SavedFreeCostings embedded idPrefix="lite-prior-" /></LitePriorFreeHistory> : <SavedFreeCostings embedded />)}{fixture}</main><Toaster /><nav aria-label="Synthetic mobile destinations" className="fixed bottom-0 left-0 right-0 flex min-h-16 items-center justify-around border-t border-hairline bg-surface p-2 md:hidden"><a href="/owner/estimator">Cost Estimate</a><a href="/owner/quotes">Saved Costings</a><a href="/owner/rates">Rate Book</a></nav></OwnerPlanProvider></I18nProvider>)
