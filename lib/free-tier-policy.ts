/** Shared display contract. Policy values originate in the database, not the browser. */
export type FreeQuotaPolicy = {
  version: number
  weeklyLimit: number
  timeZone: 'Asia/Kolkata'
  resetDay: 1
  receiptRetentionDays: number
}

export type FreeQuotaState = {
  used: number
  limit: number
  remaining: number
  periodStart: string
  resetsAt: string
  policyVersion: number
}

/** Reference for tests/display only. The debit uses PostgreSQL's clock. */
export function freeQuotaWindow(serverTime: Date): { start: string; end: string } {
  if (!Number.isFinite(serverTime.getTime())) throw new Error('INVALID_SERVER_TIME')
  const offset = 330 * 60 * 1000
  const local = new Date(serverTime.getTime() + offset)
  const daysSinceMonday = (local.getUTCDay() + 6) % 7
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday) - offset
  return { start: new Date(start).toISOString(), end: new Date(start + 7 * 86400000).toISOString() }
}

/** Reusing a completed id for changed inputs is always a conflict. */
export const FREE_COUNTING_CONTRACT = {
  version: 1,
  action: 'explicit_successful_calculation',
  changedInputs: 'another_explicit_calculation',
  sameRequestRetry: 'no_additional_debit',
  ambiguousResponse: 'retry_same_id',
  carryover: false,
  contentPersistence: 'page_memory_only',
} as const
