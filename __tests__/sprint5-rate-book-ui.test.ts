import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getRateHistoryEventKind,
  getRateHistoryEventLabel,
} from '../lib/cost-rates'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Sprint 5 Rate Book UI boundary', () => {
  it('distinguishes a same-value review from a rate change', () => {
    expect(getRateHistoryEventKind(112, null)).toBe('recorded')
    expect(getRateHistoryEventKind(112, 112)).toBe('reviewed')
    expect(getRateHistoryEventKind(112, 112, 'archived')).toBe('archived')
    expect(getRateHistoryEventKind(125, 112)).toBe('changed')
    expect(getRateHistoryEventLabel(112, 112, 'per_kg')).toBe('Value reviewed — no rate change')
    expect(getRateHistoryEventLabel(125, 112, 'per_kg')).toBe('Changed from ₹112.00/kg')
    expect(getRateHistoryEventLabel(125, 125, 'per_kg', 'archived')).toBe('Rate archived from active Rate Book')
    expect(getRateHistoryEventLabel(125, 125, 'per_kg', 'restored')).toBe('Rate restored to active Rate Book')
  })

  it('exposes a direct owner confirmation path with visible feedback', () => {
    const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')
    const actions = read('app/(dashboard)/owner/rates/actions.ts')

    expect(actions).toContain('export async function confirmCostRateReview')
    expect(actions).toContain("supabase.rpc('save_cost_rate_atomic_versioned'")
    expect(client).toContain('Confirm current rate')
    expect(client).toContain('Confirming…')
    expect(client).toContain('Existing costing snapshots were not changed.')
  })

  it('uses separate, reversible Rate Book archive and activity language', () => {
    const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    expect(client).toContain('Rate activity')
    expect(client).toContain('from Rate Book?')
    expect(client).toContain('Restore')
    expect(client).toContain('Saved Qualities keep their recipe values')
    expect(client).toContain('Loading rate activity…')
    expect(client).toContain('Archiving…')
    expect(client).toContain('Restoring…')
    expect(client).toContain('Recorded by {row.actor_name')
    expect(client).toContain('getRateHistoryEventLabel')
    expect(read('lib/cost-rates.ts')).toContain('Value reviewed — no rate change')
  })

  it('keeps the current Rate Book mutation boundary away from quote updates', () => {
    const actions = read('app/(dashboard)/owner/rates/actions.ts')
    const quotes = read('app/(dashboard)/owner/estimator/actions.ts')

    expect(actions).not.toMatch(/from\('estimator_quotes'\)[\s\S]{0,240}\.update/)
    expect(actions).toContain("supabase.rpc('review_cost_rate_atomic'")
    expect(actions).toContain("supabase.rpc('set_cost_rate_active_atomic'")
    expect(quotes).toContain('estimator_quotes')
    expect(quotes).toContain('costing_group_id')
  })

  it('makes the canonical legacy audit metadata-only and keeps snapshot exports explicit', () => {
    const migration = read('supabase/migrations/20260801151421_sprint5_rate_activity_and_legacy_audit.sql')
    const estimatorActions = read('app/(dashboard)/owner/estimator/actions.ts')
    const exportModel = read('lib/estimator-export.ts')

    expect(migration).toContain('previous_value numeric(12,4)')
    expect(migration).toContain("event_type IN ('recorded', 'reviewed', 'changed', 'archived', 'restored')")
    expect(migration).toContain("WHEN ordered_history.prior_value = ordered_history.value THEN 'reviewed'")
    expect(migration).toContain('review_cost_rate_atomic')
    expect(migration).toContain('set_cost_rate_active_atomic')
    expect(migration).toContain('REVOKE ALL ON TABLE public.cost_rate_history FROM PUBLIC, anon, authenticated')
    expect(migration).not.toMatch(/UPDATE public\.estimator_quotes/)

    const auditStart = estimatorActions.indexOf('export async function auditHistoricalCostingSnapshot')
    const auditAction = estimatorActions.slice(auditStart, auditStart + 2600)
    expect(auditAction).toContain('auditHistoricalCosting(costing)')
    expect(auditAction).toContain('reconciliation_status: audit.status')
    expect(auditAction).not.toContain('production_cost_per_meter:')
    expect(auditAction).not.toContain('costing_result_snapshot:')

    expect(exportModel).toContain("options.mode === 'customer'")
    expect(exportModel).toContain('needs owner review before it can be used as a customer quotation')
    expect(read('app/(dashboard)/owner/quotes/QuotesClient.tsx')).toContain('Costing snapshot archived')
    expect(read('app/(dashboard)/owner/quotes/QuotesClient.tsx')).toContain('This archives only this costing snapshot.')
  })
})
