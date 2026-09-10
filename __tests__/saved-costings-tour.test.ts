import { describe, expect, it } from 'vitest'
import { costingTourSurface, makeSavedCostingTourExamples, savedCostingTourSteps } from '../lib/saved-costings-tour'
import { savedCostingsTutorialCopy } from '../lib/i18n/saved-costings-tutorial'
import { compareSavedCostingSnapshots, orderSavedCostingsForComparison } from '../lib/saved-costings'

describe('Saved Costings guided tour', () => {
 it('restricts Free and retained Free snapshots to snapshot/export functions', () => {
  expect(savedCostingTourSteps(true, true, true)).toEqual(['snapshots', 'searchAndFilters', 'search', 'freeFilters', 'freeSelect', 'internal', 'customer', 'share', 'finish'])
 })
 it('orders paid selection before breakdown and comparison selection before results', () => {
  const steps = savedCostingTourSteps(false)
  expect(steps.indexOf('versions')).toBeLessThan(steps.indexOf('breakdown'))
  expect(steps.indexOf('compareSelect')).toBeLessThan(steps.indexOf('comparison'))
  expect(steps).not.toContain('production')
  expect(steps).not.toContain('quotations')
  expect(savedCostingTourSteps(false, true, true)).toContain('production')
  expect(savedCostingTourSteps(false, true, true)).toContain('quotations')
 })
 it('derives reversible dialog states with no residual dialog on finish/skip', () => {
  expect(['versions','breakdown','internal','customer','share','compareSelect','comparison','compareSelect','share',null].map(step => costingTourSurface(step as Parameters<typeof costingTourSurface>[0]))).toEqual(['library','library','export','export','export','library','comparison','library','export','page'])
 })
 it('uses two isolated, canonical versions of the same costing', () => {
  const rows = makeSavedCostingTourExamples()
  expect(new Set(rows.map(row => row.costing_group_id)).size).toBe(1)
  expect(rows.every(row => row.id.startsWith('tour-preview-'))).toBe(true)
  const ordered = orderSavedCostingsForComparison(rows)
  const result = compareSavedCostingSnapshots(ordered[0], ordered[1])
  expect(result.comparable).toBe(true)
  expect(ordered.map(row => row.version_number)).toEqual([1, 2])
  expect(result.price.sellingPricePerM.delta).not.toBeNull()
 })
 it('has explicit nonempty translations for every entitlement-specific step', () => {
  for (const lang of ['en','hi','gu'] as const) {
   for (const step of new Set([...savedCostingTourSteps(true), ...savedCostingTourSteps(false,true,true)])) {
    expect(savedCostingsTutorialCopy[lang].fields[step].every(text => text.trim().length > 0)).toBe(true)
   }
  }
 })
 it('guides users to explore and delete demo sample costing on finish step', () => {
  expect(savedCostingsTutorialCopy.en.fields.finish[1]).toContain('sample demo costing')
  expect(savedCostingsTutorialCopy.en.fields.finish[1]).toContain('delete it anytime')
  expect(savedCostingsTutorialCopy.hi.fields.finish[1]).toContain('डेमो नमूना')
  expect(savedCostingsTutorialCopy.gu.fields.finish[1]).toContain('ડેમો નમૂનો')
 })
})
