import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { liveCostSheetView, type FreeCostingSection } from '@/lib/free-costing-sections'

const section = (status: FreeCostingSection['status']) => ({ status })
const base = { metered: false, tutorialActive: false, hasValidCostResult: false, sections: [section('complete'), section('incomplete')] }

describe('Live cost sheet body', () => {
  it('shows the input checklist on Lite and Base when a missing input blocks the live result', () => {
    expect(liveCostSheetView(base)).toBe('checklist')
  })

  it('shows the full result once the live result is valid, even if a quality name is still missing', () => {
    expect(liveCostSheetView({ ...base, hasValidCostResult: true })).toBe('result')
  })

  it('falls back to the result view when nothing is incomplete, so blocked results are still explained', () => {
    expect(liveCostSheetView({ ...base, sections: [section('complete'), section('review')] })).toBe('result')
    expect(liveCostSheetView({ ...base, sections: [] })).toBe('result')
  })

  it('keeps the Free checklist until a calculation exists, including the ready and review states', () => {
    expect(liveCostSheetView({ ...base, metered: true, sections: [section('complete')] })).toBe('checklist')
    expect(liveCostSheetView({ ...base, metered: true, sections: [section('review')] })).toBe('checklist')
    expect(liveCostSheetView({ ...base, metered: true, hasValidCostResult: true })).toBe('result')
  })

  it('never swaps the real result for the checklist while the guided tour is open', () => {
    expect(liveCostSheetView({ ...base, tutorialActive: true })).toBe('result')
    expect(liveCostSheetView({ ...base, metered: true, tutorialActive: true })).toBe('result')
  })
})

// The sheet is wired in a client component, so its sizing and gating are asserted on the source text.
const client = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
const sheetStart = client.indexOf('function MobileLiveEstimateShortcut(')
const sheet = client.slice(sheetStart, client.indexOf('function CostingAssumptionsSummary(', sheetStart))

describe('Live cost sheet wiring', () => {
  it('feeds the section checklist for every plan, not only Free', () => {
    expect(client).toContain('inputSections={getFreeCostingSections(estimatorValidation, qualityLabel, warningsAcknowledged)}')
    expect(client).not.toMatch(/inputSections=\{freeMode \?/)
  })

  it('sizes the sheet to its content outside the tour and keeps the stretched layout the tour CSS targets', () => {
    expect(sheet).toContain('liveCostSheetView(')
    expect(sheet).toMatch(/adaptiveSheet \? `[^`]*md:top-1\/2[^`]*md:max-h-\[calc\(100dvh-3rem\)\]/)
    expect(sheet).toContain('"md:bottom-6 md:top-6 md:max-h-none md:w-[min(calc(100vw-3rem),38rem)]"')
    expect(sheet).toMatch(/const adaptiveSheet = !isTutorialActive/)
  })

  it('stops repeating the missing-input message under the actions while the checklist already names it', () => {
    expect(sheet).toContain('checklist: showChecklist')
    expect(client).toMatch(/actionReadinessMessage=\{view\.checklist \? null : actionReadinessMessage\}/)
  })
})
