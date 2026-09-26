import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('yarn review and selling-margin preferences', () => {
  const onboarding = read('app/(dashboard)/owner/estimator/FactoryCostWizard.tsx')
  const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
  const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')
  const rateActions = read('app/(dashboard)/owner/rates/actions.ts')
  const sidebar = read('components/navigation/owner-sidebar.tsx')
  const migration = read('supabase/migrations/20260723113000_yarn_review_and_margin_defaults.sql')

  it('captures both defaults in first-run setup', () => {
    expect(onboarding).toContain('Target margin')
    expect(onboarding).toContain('Review yarn rates')
  })

  it('prefills new estimates with the configured margin', () => {
    expect(estimator).toContain('profitPct:         Number(initialProfile.default_margin_pct ?? base.profitPct)')
    expect(estimator).toContain('default_margin_pct:      data.profitPct ?? state.profitPct')
  })

  it('uses the configured cadence for newly discovered and manually added yarns', () => {
    expect(rateActions).toContain(".select('yarn_review_interval_days')")
    expect(rateActions).toContain('review_interval_days: yarnReviewIntervalDays')
    expect(rates).toContain('defaultDraft(defaultReviewIntervalDays)')
    expect(migration).toContain('apply_yarn_review_interval_to_discovered_rate')
  })

  it('surfaces due reviews in navigation and highlights affected yarns', () => {
    expect(sidebar).toContain('yarnReviewDueCount')
    expect(sidebar).toContain('BellRing')
    expect(rates).toContain("reviewState === 'overdue' ? 'bg-red-50/70")
    expect(rates).toContain("reviewState === 'due_soon' ? 'bg-amber-50/70")
  })
})
