import type { EstimatorValidationResult } from './estimator-validation'
import type { FreeText } from './i18n/free-tier'

// tone is the section's tile colour in the estimator (app/globals.css, .estimator-step-tile).
const sections = [
  { id: 'details', label: 'sectionDetails', field: 'qualityLabel', number: 1, tone: 1 },
  { id: 'warp', label: 'sectionWarp', field: 'warpRows.0.label', number: 2, tone: 2 },
  { id: 'weft', label: 'sectionWeft', field: 'weftRows.0.label', number: 3, tone: 3 },
  { id: 'weaving', label: 'sectionWeaving', field: 'perPickCostPaisa', number: 4, tone: 4 },
  { id: 'preparation', label: 'sectionPreparation', field: 'warpingRatePerKg', number: 5, tone: 5 },
  { id: 'overhead', label: 'sectionOverhead', field: 'overheadOverridePerM', number: 6, tone: 6 },
  { id: 'processing', label: 'sectionProcessing', field: 'processingRatePerM', number: 7, tone: 9 },
  { id: 'pricing', label: 'sectionPricing', field: 'profitPct', number: 9, tone: 7 },
] as const satisfies ReadonlyArray<{ id: string; label: FreeText; field: string; number: number; tone: number }>
type SectionId = typeof sections[number]['id']
export type FreeCostingSection = { id: SectionId; label: FreeText; field: string; number: number; tone: number; status: 'complete' | 'incomplete' | 'review' }

function sectionForField(field: string): SectionId {
  if (field.startsWith('warpRows')) return 'warp'
  if (field.startsWith('weftRows')) return 'weft'
  if (field === 'perPickCostPaisa') return 'weaving'
  if (/^(warping|sizing)/.test(field)) return 'preparation'
  if (/^(overhead|monthly|loom|avgOutput|hoursPerShift)/.test(field)) return 'overhead'
  if (/^(winding|processing|finishing|enabledSections\.(winding|processing|finishing))/.test(field)) return 'processing'
  if (/^(commission|profit|transport|orderQuantity|enabledSections\.(commission|transport))/.test(field)) return 'pricing'
  return 'details'
}

/** Uses input validation only: checking sections must never reveal an unmetered price. */
export function getFreeCostingSections(validation: EstimatorValidationResult, qualityLabel: string, warningsAcknowledged: boolean): FreeCostingSection[] {
  const issues = qualityLabel.trim() ? validation.issues : [{ field: 'qualityLabel' }, ...validation.issues]
  const warnings = warningsAcknowledged ? [] : validation.warnings ?? []
  return sections.map(section => {
    const issue = issues.find(item => sectionForField(item.field) === section.id)
    const warning = warnings.find(item => sectionForField(item.field) === section.id)
    return { ...section, field: issue?.field ?? warning?.field ?? section.field, status: issue ? 'incomplete' : warning ? 'review' : 'complete' }
  })
}

/**
 * Which body the Live cost sheet shows. Free keeps the checklist until a calculation exists. Lite and Base
 * calculate live, so they only swap to it when a missing input blocks the result; with nothing incomplete the
 * result view still explains any other blocker. The guided tour always teaches the real result.
 */
export function liveCostSheetView(input: {
  metered: boolean
  tutorialActive: boolean
  hasValidCostResult: boolean
  sections: ReadonlyArray<Pick<FreeCostingSection, 'status'>>
}): 'checklist' | 'result' {
  if (input.tutorialActive || input.hasValidCostResult) return 'result'
  if (input.metered) return 'checklist'
  return input.sections.some(section => section.status === 'incomplete') ? 'checklist' : 'result'
}
