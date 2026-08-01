import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Full Suite automatic costing snapshots', () => {
  const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
  const actions = read('app/(dashboard)/owner/estimator/actions.ts')
  const savedCostings = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')

  it('keeps the standalone Base costing action but removes redundant Full Suite costing actions', () => {
    expect(estimator).toContain("'Save New Version' : 'Save Costing'")
    expect(estimator).not.toContain('id="btn-save-costing"')
    expect(estimator).not.toContain('id="btn-save-costing-market"')
  })

  it('persists estimator snapshots when starting either production workflow', () => {
    expect(actions).toContain("'start_party_order_from_estimator_v2'")
    expect(actions).toContain("record_kind:          'market_run'")
    expect(actions).toContain(".from('estimator_quotes')")
    expect(estimator).toContain('Party order started and costing saved')
    expect(estimator).toContain('Market Run started and costing saved')
  })

  it('shows market-run costing snapshots in the shared Full Suite library', () => {
    expect(savedCostings).not.toContain("quote.record_kind !== 'market_run'")
    expect(savedCostings).toContain("record.record_kind === 'market_run'")
  })
})
