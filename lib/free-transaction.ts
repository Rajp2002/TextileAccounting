import type { CostingResultSnapshot, EstimateState, EstimatorV3Totals } from './estimator'
import type { FreeEditWindow } from './free-costing-window'
import type { EstimatorValidationResult } from './estimator-validation'

/**
 * One explicit Free calculation, frozen when the owner presses Calculate.
 * Every resend of it uses this exact body; only the acknowledgement may be
 * added, and once sent it is never withdrawn.
 */
export type FreeAttempt = {
  estimate: EstimateState
  costingId?: string
  expectedRevision?: number
  label: string
  requestToken: string
  /** Account that owned the page when the attempt began. */
  accountId: string
  acknowledged: boolean
  /** A send of this attempt may have committed a debit and saved result. */
  possiblyCommitted: boolean
}
export type FreeReceiptQuota = {
  used: number; limit: number; remaining: number
  periodStart: string; resetsAt: string; policyVersion: number; replayed: boolean
}
export type FreeSaved = {
  editWindow?: FreeEditWindow; costingsUsed?: number
  kind: 'saved'; requestId: string; savedCostingId: string
  result: CostingResultSnapshot; totals: EstimatorV3Totals; quota: FreeReceiptQuota
}
export type FreePaidResult = { kind: 'paid_result'; result: CostingResultSnapshot; totals: EstimatorV3Totals }
export type FreeSendOutcome =
  | { kind: 'review_required'; fields: string[] }
  | FreeSaved
  | FreePaidResult
  | { kind: 'rejected'; code: string }
  | { kind: 'uncertain'; code: string }

/**
 * Review is a known, non-debited answer the owner acts on; unknown means a send
 * may have committed and only the same request can answer. Neither is a
 * generic "pending" flag.
 */
export type FreeTransaction =
  | { phase: 'editing' }
  | { phase: 'submitting'; attempt: FreeAttempt }
  | { phase: 'review'; attempt: FreeAttempt; fields: string[] }
  | { phase: 'unknown'; attempt: FreeAttempt; code: string; retryable: boolean }
  | { phase: 'rejected'; code: string }

export const FREE_EDITING: FreeTransaction = { phase: 'editing' }

/** Raised before the debit commits, or inside its rolled-back transaction. */
const NOT_DEBITED = new Set([
  'FREE_AUTH_REQUIRED', 'FREE_ACCESS_DENIED', 'FREE_ACCESS_INACTIVE', 'FREE_PROVISIONING_RETRY', 'FREE_PROVISIONING_PENDING',
  'FREE_THROTTLED', 'FREE_PAUSED', 'FREE_INVALID_INPUT', 'FREE_QUOTA_EXHAUSTED', 'FREE_REQUEST_CONFLICT',
  'FREE_REQUEST_EXPIRED', 'FREE_REQUEST_INVALID_OR_EXPIRED', 'FREE_EDIT_WINDOW_EXPIRED', 'FREE_COSTING_CONFLICT',
])
/** After an uncertain send, these still let a same-request replay answer. */
const REPLAY_CAN_ANSWER = new Set(['FREE_THROTTLED', 'FREE_PAUSED', 'FREE_QUOTA_EXHAUSTED', 'FREE_PROVISIONING_RETRY'])

const UNCERTAIN = { kind: 'uncertain', code: 'FREE_TEMPORARY_ERROR' } as const
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function receiptQuota(value: unknown): FreeReceiptQuota | null {
  if (!isObject(value)) return null
  const { used, limit, remaining, periodStart, resetsAt, policyVersion, replayed } = value
  if (!isCount(used) || !isCount(limit) || !isCount(remaining) || !isText(periodStart) || !isText(resetsAt) || !isCount(policyVersion)) return null
  return { used, limit, remaining, periodStart, resetsAt, policyVersion, replayed: replayed === true }
}

/** Classify one HTTP answer to a calculate request. A 2xx alone proves nothing. */
export function classifyFreeResponse(status: number, body: unknown): FreeSendOutcome {
  if (status >= 200 && status < 300) {
    if (!isObject(body)) return UNCERTAIN
    // Field names only: the browser shows the shared validator's own message
    // for each, so no business values travel back in the response.
    if (body.needsAcknowledgement === true) return { kind: 'review_required', fields: Array.isArray(body.warningFields) ? body.warningFields.filter(isText) : [] }
    if (!isObject(body.result) || !isObject(body.totals)) return UNCERTAIN
    const result = body.result as unknown as CostingResultSnapshot, totals = body.totals as unknown as EstimatorV3Totals
    if (body.paid === true && body.quota === null) return { kind: 'paid_result', result, totals }
    const quota = receiptQuota(body.quota)
    if (!quota || !isText(body.requestId) || !isText(body.savedCostingId)) return UNCERTAIN
    return { kind: 'saved', requestId: body.requestId, savedCostingId: body.savedCostingId, result, totals, quota, editWindow:body.editWindow as FreeEditWindow | undefined, costingsUsed:body.costingsUsed === 0 ? 0 : 1 }
  }
  const code = isObject(body) && isText(body.code) ? body.code : 'FREE_TEMPORARY_ERROR'
  return NOT_DEBITED.has(code) ? { kind: 'rejected', code } : { kind: 'uncertain', code }
}

/** Apply the answer to the attempt that was sent. */
export function resolveFreeSend(attempt: FreeAttempt, outcome: FreeSendOutcome): { transaction: FreeTransaction; saved?: FreeSaved; paidResult?: FreePaidResult } {
  const unknown = (code: string, retryable: boolean): FreeTransaction => ({ phase: 'unknown', attempt: { ...attempt, possiblyCommitted: true }, code, retryable })
  switch (outcome.kind) {
    case 'review_required':
      // The server warns only unacknowledged sends, and validation of the same
      // body is deterministic, so no unacknowledged send of it was debited.
      // After an acknowledged send this answer proves nothing.
      return attempt.acknowledged
        ? { transaction: unknown('FREE_TEMPORARY_ERROR', true) }
        : { transaction: { phase: 'review', attempt: { ...attempt, possiblyCommitted: false }, fields: outcome.fields } }
    case 'saved':
      return { transaction: FREE_EDITING, saved: outcome }
    case 'paid_result':
      // Paid access computes without the Free receipt, so it cannot say
      // whether an earlier uncertain Free send was saved.
      return attempt.possiblyCommitted ? { transaction: unknown('FREE_PAID_ACTIVE', false) } : { transaction: FREE_EDITING, paidResult: outcome }
    case 'rejected':
      return attempt.possiblyCommitted
        ? { transaction: unknown(outcome.code, REPLAY_CAN_ANSWER.has(outcome.code)) }
        : { transaction: { phase: 'rejected', code: outcome.code } }
    case 'uncertain':
      return { transaction: unknown(outcome.code, true) }
  }
}

export const isFreeAttemptUnresolved = (transaction: FreeTransaction) => transaction.phase === 'submitting' || transaction.phase === 'unknown'

export function startFreeAttempt(transaction: FreeTransaction, attempt: FreeAttempt): FreeTransaction {
  return transaction.phase === 'editing' || transaction.phase === 'rejected' ? { phase: 'submitting', attempt } : transaction
}
export function confirmFreeReview(transaction: FreeTransaction): FreeTransaction {
  return transaction.phase === 'review' ? { phase: 'submitting', attempt: { ...transaction.attempt, acknowledged: true } } : transaction
}
export function correctFreeReview(transaction: FreeTransaction): FreeTransaction {
  return transaction.phase === 'review' ? FREE_EDITING : transaction
}
export function retryFreeAttempt(transaction: FreeTransaction): FreeTransaction {
  return transaction.phase === 'unknown' && transaction.retryable ? { phase: 'submitting', attempt: transaction.attempt } : transaction
}
/** Explicit, owner-chosen release once the same request can no longer answer. */
export function releaseFreeAttempt(transaction: FreeTransaction): FreeTransaction {
  return transaction.phase === 'unknown' && !transaction.retryable ? FREE_EDITING : transaction
}

export function freeAttemptPayload(attempt: FreeAttempt) {
  return { estimate: attempt.estimate, label: attempt.label, requestToken: attempt.requestToken, warningsAcknowledged: attempt.acknowledged, ...(attempt.costingId ? {costingId:attempt.costingId,expectedRevision:attempt.expectedRevision} : {}) }
}

/**
 * The shared validator runs on the current inputs before any Free request, as
 * it does before a paid save. The server repeats it and stays authoritative.
 */
export function freePreflight(validation: EstimatorValidationResult, reviewed: boolean): { action: 'fix'; field: string | null } | { action: 'review' } | { action: 'submit'; acknowledged: boolean } {
  if (!validation.valid) return { action: 'fix', field: validation.issues[0]?.field ?? null }
  const warned = (validation.warnings?.length ?? 0) > 0
  if (warned && !reviewed) return { action: 'review' }
  return { action: 'submit', acknowledged: warned }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/**
 * The request id inside a server-signed request token. Read only to look the
 * request up in the owner's own saved costings; the server verifies tokens.
 */
export function freeRequestIdOf(token: string): string | null {
  const payload = token.split('.')[0] ?? ''
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) return null
  try {
    const identity: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - payload.length % 4) % 4)))
    const requestId = isObject(identity) ? identity.requestId : null
    return typeof requestId === 'string' && UUID.test(requestId) ? requestId : null
  } catch { return null }
}

/**
 * A released attempt that may still have committed. Releasing frees the page
 * for a new calculation; it does not forget the old identity, which stays
 * checkable against saved history (a saved costing's id is its request id).
 */
export type FreeUnreconciled = {
  attempt: FreeAttempt
  requestId: string | null
  code: string
  check: 'checking' | 'found' | 'not_found' | 'check_failed'
  checkedAt: string | null
}

/** Apply one read of saved history. Null ids mean the read failed. Absence is never proof. */
export function reconcileWithSaved(entries: FreeUnreconciled[], savedIds: ReadonlySet<string> | null, checkedAt: string): FreeUnreconciled[] {
  return entries.map(entry => {
    if (entry.check === 'found') return entry
    if (!savedIds || !entry.requestId) return { ...entry, check: 'check_failed', checkedAt }
    return { ...entry, check: savedIds.has(entry.requestId) ? 'found' : 'not_found', checkedAt }
  })
}
