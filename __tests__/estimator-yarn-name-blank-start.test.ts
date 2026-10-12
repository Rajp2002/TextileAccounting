import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_WARP_ROW } from '../lib/estimator'
import {
  applyYarnSuggestionToRow,
  buildSavedYarnOptions,
  filterYarnOptions,
} from '../lib/estimator-yarn-suggestions'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const client = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

// Text of one top-level function: from its signature to the closing brace at column 0.
function functionBody(source: string, signature: string) {
  const start = source.indexOf(signature)
  expect(start, signature).toBeGreaterThan(-1)
  return source.slice(start, source.indexOf('\n}\n', start))
}

describe('estimator yarn names start blank', () => {
  it('does not copy the factory profile yarn names or rates into the first warp and weft rows', () => {
    expect(client).not.toMatch(/profile\.default_(warp|weft)_yarn_(name|rate_per_kg)/)
  })

  it('builds new estimates with a blank first warp and weft name', () => {
    const baseline = functionBody(client, 'function buildEstimatorBaseline(')
    expect(baseline).toContain('withBlankFirstYarnNames(makeDefaultEstimateState())')
    expect(functionBody(client, 'function withBlankFirstYarnNames(')).toContain("label: ''")
  })

  it('removes the Confirm Values step from yarn picks', () => {
    for (const gone of [
      'verification-banner',
      'Confirm Values',
      'unverifiedYarnRows',
      'unverifiedNotice',
      'needsVerification',
      'handleConfirmYarnVerification',
      'handleYarnFieldManualEdit',
    ]) {
      expect(client.includes(gone), gone).toBe(false)
    }
  })

  it('keeps a Rate Book pick filling the name, rate and denier', () => {
    const rateBook = [{ id: 'rate-50-600', name: '50/600 Polyester', category: 'yarn_warp', currentValue: 191 }]
    const [option] = buildSavedYarnOptions(rateBook, [])

    expect(filterYarnOptions([option], '50', 'yarn_warp').map(o => o.name)).toEqual(['50/600 Polyester'])

    const row = applyYarnSuggestionToRow({ ...DEFAULT_WARP_ROW, id: 'warp-1', label: '' }, option)
    expect(row).toMatchObject({ label: '50/600 Polyester', calcDenier: 50, yarnRate: 191 })
  })
})
