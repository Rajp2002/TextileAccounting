export type CostingJourneySource = 'blank' | 'saved_quality' | 'saved_costing' | 'restored_draft'
export type CostingJourney = { source: CostingJourneySource; sequence: number }
export function nextCostingJourney(previous: CostingJourney | null, source: CostingJourneySource): CostingJourney {
  return { source, sequence: (previous?.sequence ?? 0) + 1 }
}
