export const COSTING_RECORD_KINDS = ['costing', 'quotation', 'market_run'] as const

export type CostingRecordKind = (typeof COSTING_RECORD_KINDS)[number]

export type CostingWorkspaceCapabilities = {
  canUseProduction: boolean
  ratesWorkspace: true
  versionedCostings: true
  costingComparison: true
  professionalExports: true
  partyContext: boolean
  quotationLifecycle: boolean
  productionConversion: boolean
}

export function getCostingWorkspaceCapabilities(canUseProduction: boolean): CostingWorkspaceCapabilities {
  return {
    canUseProduction,
    ratesWorkspace: true,
    versionedCostings: true,
    costingComparison: true,
    professionalExports: true,
    // Base costings are quality-first records. Customer context belongs to a
    // quotation or export, not to the reusable costing baseline.
    partyContext: canUseProduction,
    quotationLifecycle: canUseProduction,
    productionConversion: canUseProduction,
  }
}

export function normalizeCostingRecordKind(
  value: string | null | undefined,
  fallback: CostingRecordKind = 'quotation',
): CostingRecordKind {
  return COSTING_RECORD_KINDS.includes(value as CostingRecordKind)
    ? value as CostingRecordKind
    : fallback
}

export function getNewEstimateRecordKind(
  canUseProduction: boolean,
  requestedKind?: 'costing' | 'quotation',
): CostingRecordKind {
  if (!canUseProduction) return 'costing'
  return requestedKind === 'costing' ? 'costing' : 'quotation'
}

export function isStandaloneCosting(recordKind: string | null | undefined) {
  return normalizeCostingRecordKind(recordKind) === 'costing'
}

export function canUseQuotationLifecycle(
  recordKind: string | null | undefined,
  canUseProduction: boolean,
) {
  return canUseProduction && normalizeCostingRecordKind(recordKind) === 'quotation'
}

export function shouldCreateImmutableRevision(
  recordKind: string | null | undefined,
  status: string | null | undefined,
  hasLinkedOrder: boolean,
) {
  return normalizeCostingRecordKind(recordKind) === 'costing'
    || hasLinkedOrder
    || status === 'accepted'
}
