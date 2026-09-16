import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { comparisonCostingSteps, costingTourSurface, makeSavedCostingTourExamples, savedCostingTourEnding, savedCostingTourSteps } from '../lib/saved-costings-tour'
import { savedCostingStepCopy, savedCostingsTutorialCopy } from '../lib/i18n/saved-costings-tutorial'
import { compareSavedCostingSnapshots, orderSavedCostingsForComparison } from '../lib/saved-costings'

const baseOptions = { free: false, full: false, quotations: false, ending: 'existing' as const, openLabel: 'Use', previewLabel: 'Export', newLabel: 'New Costing' }
const tutorial = readFileSync(new URL('../components/estimator/SavedCostingsTutorial.tsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('../app/(dashboard)/owner/quotes/QuotesClient.tsx', import.meta.url), 'utf8')

describe('Saved Costings guided tour', () => {
 it('limits Free and retained Free core guidance to historical snapshots and document privacy', () => {
  expect(savedCostingTourSteps(true, true)).toEqual(['snapshots', 'freeSelect', 'internal', 'finish'])
  expect(savedCostingsTutorialCopy.en.fields.snapshots[1]).toContain('retained Free snapshots')
 })
 it('teaches purpose, selection, economics and decisions before the state-aware ending', () => {
  expect(savedCostingTourSteps(false)).toEqual(['find', 'versions', 'economics', 'reuse', 'internal', 'finish'])
  expect(savedCostingTourSteps(false, true)).toEqual(['find', 'versions', 'economics', 'reuse', 'internal', 'production', 'finish'])
  expect(savedCostingTourSteps(false)).not.toContain('compareSelect')
 })
 it('keeps comparison discoverable as an optional sample walkthrough', () => {
  expect(comparisonCostingSteps).toEqual(['compareSelect', 'comparison', 'comparisonDetails', 'finish'])
  expect(tutorial).toContain('onStepChange(comparisonCostingSteps[0])')
  expect(tutorial).toContain('!free && <Button')
  expect(tutorial).toContain('copy.fields.organize')
  expect(tutorial).toContain('copy.fields.share')
  expect(tutorial).toContain('quotations ? [copy.fields.quotations] : []')
 })
 it('derives reversible sample surfaces for forward, back and exit navigation', () => {
  expect(['versions', 'economics', 'internal', 'production', 'finish', null].map(step => costingTourSurface(step as Parameters<typeof costingTourSurface>[0]))).toEqual(['library', 'library', 'export', 'library', 'page', 'page'])
  expect(comparisonCostingSteps.map(costingTourSurface)).toEqual(['library', 'comparison', 'comparison', 'page'])
 })
 it('uses two isolated, comparable versions of the same costing with real economic changes', () => {
  const rows = makeSavedCostingTourExamples()
  expect(new Set(rows.map(row => row.costing_group_id)).size).toBe(1)
  expect(rows.every(row => row.id.startsWith('tour-preview-'))).toBe(true)
  const ordered = orderSavedCostingsForComparison(rows)
  const result = compareSavedCostingSnapshots(ordered[0], ordered[1])
  expect(result.comparable).toBe(true)
  expect(ordered.map(row => row.version_number)).toEqual([1, 2])
  expect(result.price.sellingPricePerM.delta).toBeGreaterThan(0)
 })
 it('selects existing, empty and unavailable endings without promising a persistent demo', () => {
  expect(savedCostingTourEnding(4)).toBe('existing')
  expect(savedCostingTourEnding(0)).toBe('empty')
  expect(savedCostingTourEnding(0, true)).toBe('unavailable')
  expect(savedCostingTourEnding(4, true)).toBe('unavailable')
  expect(savedCostingStepCopy('en', 'finish', baseOptions)[1]).toContain('one of your saved costings')
  expect(savedCostingStepCopy('en', 'finish', {...baseOptions, ending: 'empty'})[1]).toContain('Choose New Costing')
  expect(savedCostingStepCopy('en', 'finish', {...baseOptions, ending: 'empty', quotations: true, newLabel: 'New Estimate'})[1]).toContain('Choose New Estimate')
  expect(savedCostingStepCopy('en', 'finish', {...baseOptions, ending: 'unavailable'})[1]).toContain('refresh')
  for (const ending of ['existing', 'empty', 'unavailable'] as const) {
   expect(savedCostingStepCopy('en', 'finish', {...baseOptions, ending})[1]).not.toMatch(/sample demo costing|delete it anytime/)
  }
 })
 it('matches Base activation and Full applied-production targets without promising a write', () => {
  const base = savedCostingStepCopy('en', 'production', baseOptions)[1]
  expect(base).toContain('Activate for Production')
  expect(base).toContain('Activate Quality for Production picker')
  expect(base).toContain('Find the intended quality and version')
  expect(base).not.toContain('with this costing selected')
  expect(base).toContain('Assign Looms')
  expect(base).toContain('records no output, stock or wages')
  const full = savedCostingStepCopy('en', 'production', {...baseOptions, full: true})[1]
  expect(full).toContain('Applied production')
  expect(full).toContain('Production → Activate Quality')
  expect(full).not.toContain('Activate for Production')
 })
 it('distinguishes new-quality duplication from a customer quotation draft', () => {
  expect(savedCostingStepCopy('en', 'reuse', baseOptions)[1]).toContain('new quality')
  const full = savedCostingStepCopy('en', 'reuse', {...baseOptions, full: true, quotations: true, openLabel: 'Open'})[1]
  expect(full).toContain('Open loads this version')
  expect(full).toContain('new customer quotation draft')
  expect(full).toContain('Neither action sends')
 })
 it('retains document privacy in every core tour and translates every variant', () => {
  const keys = Object.keys(savedCostingsTutorialCopy.en.fields)
  for (const lang of ['en', 'hi', 'gu'] as const) {
   const copy = savedCostingsTutorialCopy[lang]
   expect(Object.keys(copy.fields).sort()).toEqual([...keys].sort())
   expect(Object.values(copy.fields).every(pair => pair.every(text => text.trim().length > 0))).toBe(true)
   expect(copy.compare.length).toBeGreaterThan(0)
   expect(copy.help.length).toBeGreaterThan(0)
   for (const options of [baseOptions, {...baseOptions, full: true, quotations: true}, {...baseOptions, free: true}]) {
    for (const step of [...savedCostingTourSteps(options.free, true), ...comparisonCostingSteps]) {
     expect(savedCostingStepCopy(lang, step, options).join(' ')).not.toMatch(/\{(?:open|preview|new)\}/)
    }
   }
   expect(copy.fields.internal[1]).toContain('Internal Cost Estimate')
   expect(copy.fields.internal[1]).toContain('Customer Quotation')
  }
 })
 it('keeps selected real versions outside the sample library and guards sample writes', () => {
  expect(page).toContain('selectedRecordIdByGroup={{}} onSelectRecord={() => {}}')
  expect(page).toContain('selectedRecordIdByGroup={selectedRecordIdByGroup} onSelectRecord={selectRecord}')
  expect(page).toContain('onOpen={() => {}} onStartFrom={() => {}} onSaveAsNewQuality={() => {}} onExport={() => {}}')
  expect(page).toContain('showCostingDeleteNudge && !tourStep && !demoCostingDeleted && quotes.length === 0 && initialTemplates.length === 0')
 })
 it('uses one completion action for button and keyboard, without completing the core via optional comparison', () => {
  expect(tutorial).toContain("if (!comparisonTour) {")
  expect(tutorial).toContain("if (userId) void persistTourCompleted('saved-costings', userId)")
  expect(tutorial).toContain("onComplete?.()")
  expect(tutorial).toContain('onClick={advance}')
  expect(tutorial).toContain('advance: next')
  expect(tutorial).toContain("if (event.key === 'Escape') {event.preventDefault(); event.stopImmediatePropagation(); change(null); return}")
  expect(tutorial).toContain('trigger?.focus({preventScroll: true})')
 })
})
