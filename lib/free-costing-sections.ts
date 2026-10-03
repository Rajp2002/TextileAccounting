import type { EstimatorValidationResult } from './estimator-validation'
import type { FreeText } from './i18n/free-tier'

const sections = [
  { id: 'details', label: 'sectionDetails', field: 'qualityLabel', number: 1 },
  { id: 'warp', label: 'sectionWarp', field: 'warpRows.0.label', number: 2 },
  { id: 'weft', label: 'sectionWeft', field: 'weftRows.0.label', number: 3 },
  { id: 'weaving', label: 'sectionWeaving', field: 'perPickCostPaisa', number: 4 },
  { id: 'preparation', label: 'sectionPreparation', field: 'warpingRatePerKg', number: 5 },
  { id: 'overhead', label: 'sectionOverhead', field: 'overheadOverridePerM', number: 6 },
  { id: 'processing', label: 'sectionProcessing', field: 'processingRatePerM', number: 7 },
  { id: 'pricing', label: 'sectionPricing', field: 'profitPct', number: 9 },
] as const satisfies ReadonlyArray<{ id: string; label: FreeText; field: string; number: number }>
type SectionId = typeof sections[number]['id']
export type FreeCostingSection = { id: SectionId; label: FreeText; field: string; number: number; status: 'complete' | 'incomplete' | 'review' }

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
