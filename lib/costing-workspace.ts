export const COSTING_RECORD_KINDS = ['costing', 'quotation', 'market_run'] as const

export type CostingRecordKind = (typeof COSTING_RECORD_KINDS)[number]

export function normalizeCostingRecordKind(
  value: string | null | undefined,
  fallback: CostingRecordKind = 'quotation',
): CostingRecordKind {
  return COSTING_RECORD_KINDS.includes(value as CostingRecordKind)
    ? value as CostingRecordKind
    : fallback
}

export function isStandaloneCosting(recordKind: string | null | undefined) {
  return normalizeCostingRecordKind(recordKind) === 'costing'
}
