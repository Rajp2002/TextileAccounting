import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { makeDefaultEstimateState } from '../lib/estimator'
import { validateEstimatorSnapshot } from '../lib/estimator-validation'
import {
  checkPlausibility,
  convertPlausibilityCheck,
  formatPlausibleRange,
  PLAUSIBLE_RANGES,
  plausibilityConfirmationKey,
  plausibilityRuleForField,
  suggestTypoFix,
} from '../lib/input-plausibility'
import { PlausibilityNudge } from '../components/estimator/PlausibilityNudge'

vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: 'en', tx: (text: string) => text, t: (key: string) => key }) }))

const estimatorClientSource = readFileSync(join(process.cwd(), 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'), 'utf8')

function costingWith(edit: (estimate: ReturnType<typeof makeDefaultEstimateState>) => void) {
  const estimate = makeDefaultEstimateState()
  estimate.warpRows[0] = { ...estimate.warpRows[0], label: 'Warp', calcDenier: 75, beamEnds: 6_200, yarnRate: 120 }
  estimate.weftRows[0] = { ...estimate.weftRows[0], label: 'Weft', calcDenier: 100, picks: 68, effectiveCostingWidthCm: 160, yarnRate: 120 }
  estimate.perPickCostPaisa = 0.16
  edit(estimate)
  return validateEstimatorSnapshot(estimate, { requireTapeLength: false })
}

describe('usual input ranges', () => {
  it('asks about 711 D and offers 71 D', () => {
    expect(checkPlausibility('denier', 711)).toMatchObject({ direction: 'high', suggestion: 71 })
    expect(checkPlausibility('denier', 7.5)).toMatchObject({ direction: 'low', suggestion: 75 })
  })

  it('leaves usual, blank and zero values alone', () => {
    for (const value of [20, 75, 300, 450]) expect(checkPlausibility('denier', value)).toBeNull()
    expect(checkPlausibility('denier', 0)).toBeNull()
    expect(checkPlausibility('denier', null)).toBeNull()
    expect(checkPlausibility('wastePct', 0)).toBeNull()
  })

  it('guesses the typo only when one fix is clearly most likely', () => {
    const fitsRate = (value: number) => value >= 50 && value <= 1_000
    expect(suggestTypoFix(1_100, fitsRate)).toBe(110)
    expect(suggestTypoFix(7_500, fitsRate)).toBe(750)
    expect(suggestTypoFix(62_000, value => value >= 100 && value <= 20_000)).toBe(6_200)
    expect(suggestTypoFix(688, value => value >= 10 && value <= 150)).toBe(68)
    // 5000 D has no fix inside the usual range, so nothing is offered.
    expect(checkPlausibility('denier', 5_000)?.suggestion).toBeNull()
  })

  it('asks a width typed in inches in inches', () => {
    const check = checkPlausibility('widthCm', 630 * 2.54)
    expect(check?.direction).toBe('high')
    const inInches = convertPlausibilityCheck(check!, 2.54, 'inch')
    expect(inInches.suggestion).toBe(63)
    expect(formatPlausibleRange(inInches.range)).toBe('30–80 inch')
  })

  it('formats ranges the way the fields show them', () => {
    expect(formatPlausibleRange(PLAUSIBLE_RANGES.denier)).toBe('20–450 D')
    expect(formatPlausibleRange(PLAUSIBLE_RANGES.wastePct)).toBe('up to 15%')
    expect(formatPlausibleRange(PLAUSIBLE_RANGES.yarnRatePerKg)).toBe('₹50–1,000/kg')
  })

  it('maps the estimator number fields to their ranges', () => {
    expect(plausibilityRuleForField('calcDenier')).toBe('denier')
    expect(plausibilityRuleForField('shortagePct')).toBe('wastePct')
    expect(plausibilityRuleForField('yarnShortagePct')).toBe('wastePct')
    expect(plausibilityRuleForField('qualityLabel')).toBeUndefined()
    expect(plausibilityConfirmationKey('denier', 711)).toBe('denier:711')
  })
})

describe('save-time review uses the same ranges', () => {
  it('flags 711 D with the rule and value the field can confirm', () => {
    const validation = costingWith(estimate => { estimate.warpRows[0].calcDenier = 711 })
    expect(validation.warnings).toContainEqual(expect.objectContaining({
      field: 'warpRows.0.calcDenier',
      plausibility: { rule: 'denier', value: 711 },
    }))
  })

  it('has no warnings for an ordinary costing', () => {
    expect(costingWith(() => {}).warnings).toBeUndefined()
  })

  it('names the direction for a rate below the usual range', () => {
    const validation = costingWith(estimate => { estimate.weftRows[0].yarnRate = 12 })
    expect(validation.warnings).toContainEqual(expect.objectContaining({
      field: 'weftRows.0.yarnRate',
      message: 'Weft layer 1 (Weft) yarn rate is below ₹50/kg. Confirm the rate and unit.',
    }))
  })

  it('checks the weaving rate in paise per pick', () => {
    const validation = costingWith(estimate => { estimate.perPickCostPaisa = 1.6 })
    expect(validation.warnings).toContainEqual(expect.objectContaining({
      field: 'perPickCostPaisa',
      plausibility: { rule: 'paisePerPick', value: 160 },
    }))
  })

  it('questions a warping rate only while warping is outsourced', () => {
    const inHouse = costingWith(estimate => { estimate.warpingRatePerKg = 80 })
    expect(inHouse.warnings ?? []).not.toContainEqual(expect.objectContaining({ field: 'warpingRatePerKg' }))
    const outsourced = costingWith(estimate => { estimate.warpingMode = 'outsourced'; estimate.warpingRatePerKg = 80 })
    expect(outsourced.warnings).toContainEqual(expect.objectContaining({ field: 'warpingRatePerKg' }))
  })
})

describe('the question under the field', () => {
  it('asks whether the value is correct and offers the fix', () => {
    const html = renderToStaticMarkup(
      <PlausibilityNudge check={checkPlausibility('denier', 711)!} onUseSuggestion={() => {}} onConfirm={() => {}} />,
    )
    expect(html).toContain('711 D is higher than usual (20–450 D). Is it correct?')
    expect(html).toContain('Change to 71 D')
    expect(html).toContain('Yes, it&#x27;s correct')
  })

  it('counts an answer at the field as the save-time review', () => {
    expect(estimatorClientSource).toContain('<PlausibilityConfirmationProvider store={plausibilityConfirmations}>')
    expect(estimatorClientSource).toContain('acknowledgedWarningKey === warningKey || warningsConfirmedAtFields')
  })
})
