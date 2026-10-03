import type { CostingResultSnapshot, EstimateState, EstimatorV3Totals } from './estimator'

export const FREE_COSTING_EDIT_MS = 30 * 60 * 1000
export type FreeEditWindow = {
  createdAt: string; updatedAt: string; editExpiresAt: string; serverTime: string; revision: number
}
export type SavedFreeCosting = {
  id: string; label: string; created_at: string; updated_at: string; revision: number
  estimate: EstimateState; result: CostingResultSnapshot; totals: EstimatorV3Totals
  editWindow?: FreeEditWindow
}
export function freeEditWindow(row: Pick<SavedFreeCosting, 'created_at' | 'updated_at' | 'revision'>, serverTime: string): FreeEditWindow {
  return { createdAt: row.created_at, updatedAt: row.updated_at, revision: row.revision,
    editExpiresAt: new Date(Date.parse(row.created_at) + FREE_COSTING_EDIT_MS).toISOString(), serverTime }
}
export function remainingFreeEditMs(window: FreeEditWindow | undefined, now: number): number {
  if (!window) return 0
  const remaining = Date.parse(window.editExpiresAt) - now
  return Number.isFinite(remaining) ? Math.max(0, remaining) : 0
}
export function formatFreeEditTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
