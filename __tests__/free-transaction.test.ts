import { describe, expect, it } from 'vitest'
import {
  classifyFreeResponse,
  confirmFreeReview,
  correctFreeReview,
  freePreflight,
  freeRequestIdOf,
  freeAttemptPayload,
  isFreeAttemptUnresolved,
  releaseFreeAttempt,
  resolveFreeSend,
  retryFreeAttempt,
  startFreeAttempt,
  type FreeAttempt,
  type FreeTransaction,
} from '@/lib/free-transaction'
import { makeFreeEstimate } from '@/lib/free-estimator-defaults'

const PERIOD = { periodStart: '2026-09-30T18:30:00.000Z', resetsAt: '2026-10-31T18:30:00.000Z', policyVersion: 2 }
// One estimate: makeFreeEstimate() mints fresh row ids on every call.
const ESTIMATE = makeFreeEstimate()
const attempt = (overrides: Partial<FreeAttempt> = {}): FreeAttempt => ({
  estimate: ESTIMATE, label: 'Quality A', requestToken: 'token-1', accountId: 'user-a',
  acknowledged: false, possiblyCommitted: false, ...overrides,
})
const savedBody = {
  result: { productionCostPerM: 12.5 }, totals: { totalProductionCostPerM: 12.5 },
  quota: { used: 1, limit: 2, remaining: 1, ...PERIOD, replayed: false, requestId: 'request-1' },
  requestId: 'request-1', savedCostingId: 'request-1',
}
const submitting = (a: FreeAttempt): FreeTransaction => ({ phase: 'submitting', attempt: a })

describe('classifyFreeResponse', () => {
  it('reads a review response with its affected fields, with or without the outcome discriminant', () => {
    expect(classifyFreeResponse(200, { outcome: 'review_required', needsAcknowledgement: true, warningFields: ['ppi', 'warpRows.0.yarnRate'] }))
      .toEqual({ kind: 'review_required', fields: ['ppi', 'warpRows.0.yarnRate'] })
    // Already-deployed servers send no discriminant.
    expect(classifyFreeResponse(200, { needsAcknowledgement: true, warningFields: ['ppi'] })).toEqual({ kind: 'review_required', fields: ['ppi'] })
    expect(classifyFreeResponse(200, { needsAcknowledgement: true })).toEqual({ kind: 'review_required', fields: [] })
  })

  it('accepts a saved Free result only when the identity, money and receipt balance are all present', () => {
    expect(classifyFreeResponse(200, savedBody)).toMatchObject({ kind: 'saved', savedCostingId: 'request-1', quota: { remaining: 1 } })
    expect(classifyFreeResponse(200, { ...savedBody, savedCostingId: undefined })).toEqual({ kind: 'uncertain', code: 'FREE_TEMPORARY_ERROR' })
    expect(classifyFreeResponse(200, { ...savedBody, quota: { ...savedBody.quota, remaining: 'one' } })).toEqual({ kind: 'uncertain', code: 'FREE_TEMPORARY_ERROR' })
    expect(classifyFreeResponse(200, null)).toEqual({ kind: 'uncertain', code: 'FREE_TEMPORARY_ERROR' })
  })

  it('treats a 2xx paid computation as a paid result, never as a saved Free costing', () => {
    const outcome = classifyFreeResponse(200, { result: savedBody.result, totals: savedBody.totals, quota: null, paid: true })
    expect(outcome.kind).toBe('paid_result')
    expect(outcome).not.toHaveProperty('savedCostingId')
  })

  it('separates codes that prove this send was not debited from codes whose outcome is uncertain', () => {
    for (const code of ['FREE_INVALID_INPUT', 'FREE_QUOTA_EXHAUSTED', 'FREE_THROTTLED', 'FREE_PAUSED', 'FREE_ACCESS_DENIED', 'FREE_REQUEST_EXPIRED', 'FREE_REQUEST_INVALID_OR_EXPIRED', 'FREE_REQUEST_CONFLICT']) {
      expect(classifyFreeResponse(code === 'FREE_PAUSED' ? 503 : 400, { code })).toEqual({ kind: 'rejected', code })
    }
    expect(classifyFreeResponse(503, { code: 'FREE_RETRY_SAME_REQUEST' })).toEqual({ kind: 'uncertain', code: 'FREE_RETRY_SAME_REQUEST' })
    expect(classifyFreeResponse(503, { code: 'FREE_TEMPORARY_ERROR' })).toEqual({ kind: 'uncertain', code: 'FREE_TEMPORARY_ERROR' })
    // A proxy or platform error page carries no Free code.
    expect(classifyFreeResponse(413, '<html>')).toEqual({ kind: 'uncertain', code: 'FREE_TEMPORARY_ERROR' })
  })
})

describe('resolveFreeSend', () => {
  it('moves an initial unacknowledged warning to review without treating it as uncertain', () => {
    const next = resolveFreeSend(attempt(), { kind: 'review_required', fields: ['ppi'] })
    expect(next.transaction).toMatchObject({ phase: 'review', attempt: { requestToken: 'token-1', acknowledged: false, possiblyCommitted: false } })
    expect(isFreeAttemptUnresolved(next.transaction)).toBe(false)
  })

  it('never treats a warning after an acknowledged send as proof that nothing was saved', () => {
    const next = resolveFreeSend(attempt({ acknowledged: true, possiblyCommitted: true }), { kind: 'review_required', fields: [] })
    expect(next.transaction).toMatchObject({ phase: 'unknown', attempt: { acknowledged: true, possiblyCommitted: true }, retryable: true })
  })

  it('keeps the original request and acknowledgement when the outcome is uncertain', () => {
    const next = resolveFreeSend(attempt({ acknowledged: true }), { kind: 'uncertain', code: 'FREE_RETRY_SAME_REQUEST' })
    expect(next.transaction).toMatchObject({
      phase: 'unknown', code: 'FREE_RETRY_SAME_REQUEST', retryable: true,
      attempt: { requestToken: 'token-1', acknowledged: true, possiblyCommitted: true },
    })
    expect(isFreeAttemptUnresolved(next.transaction)).toBe(true)
  })

  it('clears a known non-debited rejection so the owner can edit, with no possible charge to reconcile', () => {
    expect(resolveFreeSend(attempt(), { kind: 'rejected', code: 'FREE_INVALID_INPUT' }).transaction).toEqual({ phase: 'rejected', code: 'FREE_INVALID_INPUT' })
  })

  it('does not let a later rejection resolve an earlier possibly committed send', () => {
    const expired = resolveFreeSend(attempt({ possiblyCommitted: true }), { kind: 'rejected', code: 'FREE_REQUEST_EXPIRED' })
    expect(expired.transaction).toMatchObject({ phase: 'unknown', code: 'FREE_REQUEST_EXPIRED', retryable: false, attempt: { requestToken: 'token-1' } })
    // Same-request replay can still answer whether the original was saved.
    const exhausted = resolveFreeSend(attempt({ possiblyCommitted: true }), { kind: 'rejected', code: 'FREE_QUOTA_EXHAUSTED' })
    expect(exhausted.transaction).toMatchObject({ phase: 'unknown', retryable: true })
  })

  it('reports a saved result with its receipt and returns to editing', () => {
    const outcome = classifyFreeResponse(200, savedBody)
    const next = resolveFreeSend(attempt({ possiblyCommitted: true }), outcome)
    expect(next.transaction).toEqual({ phase: 'editing' })
    expect(next.saved).toMatchObject({ savedCostingId: 'request-1', quota: { remaining: 1 } })
  })

  it('keeps an unresolved Free attempt open when paid access answers instead', () => {
    const paid = classifyFreeResponse(200, { result: {}, totals: {}, quota: null, paid: true })
    const fresh = resolveFreeSend(attempt(), paid)
    expect(fresh.transaction).toEqual({ phase: 'editing' })
    expect(fresh.saved).toBeUndefined()
    expect(fresh.paidResult).toBeDefined()
    const raced = resolveFreeSend(attempt({ possiblyCommitted: true }), paid)
    expect(raced.transaction).toMatchObject({ phase: 'unknown', code: 'FREE_PAID_ACTIVE', retryable: false })
    expect(raced.saved).toBeUndefined()
  })
})

describe('transitions', () => {
  it('starts only from an idle or finished state', () => {
    expect(startFreeAttempt({ phase: 'editing' }, attempt())).toEqual(submitting(attempt()))
    expect(startFreeAttempt({ phase: 'rejected', code: 'FREE_INVALID_INPUT' }, attempt())).toEqual(submitting(attempt()))
    const unknown: FreeTransaction = { phase: 'unknown', attempt: attempt({ possiblyCommitted: true }), code: 'FREE_TEMPORARY_ERROR', retryable: true }
    expect(startFreeAttempt(unknown, attempt({ requestToken: 'token-2' }))).toBe(unknown)
  })

  it('confirms the reviewed payload unchanged, adding only the acknowledgement', () => {
    const review: FreeTransaction = { phase: 'review', attempt: attempt(), fields: [] }
    expect(confirmFreeReview(review)).toEqual(submitting(attempt({ acknowledged: true })))
    expect(confirmFreeReview({ phase: 'editing' })).toEqual({ phase: 'editing' })
  })

  it('correction drops only a known non-debited review', () => {
    expect(correctFreeReview({ phase: 'review', attempt: attempt(), fields: [] })).toEqual({ phase: 'editing' })
    const unknown: FreeTransaction = { phase: 'unknown', attempt: attempt({ possiblyCommitted: true }), code: 'FREE_TEMPORARY_ERROR', retryable: true }
    expect(correctFreeReview(unknown)).toBe(unknown)
  })

  it('retries the same bound request, including the acknowledgement already sent', () => {
    const a = attempt({ acknowledged: true, possiblyCommitted: true })
    expect(retryFreeAttempt({ phase: 'unknown', attempt: a, code: 'FREE_TEMPORARY_ERROR', retryable: true })).toEqual(submitting(a))
    expect(retryFreeAttempt({ phase: 'unknown', attempt: a, code: 'FREE_REQUEST_EXPIRED', retryable: false }))
      .toMatchObject({ phase: 'unknown', retryable: false })
  })

  it('releases an unresolved identity only when replay can no longer answer', () => {
    const a = attempt({ possiblyCommitted: true })
    const retryable: FreeTransaction = { phase: 'unknown', attempt: a, code: 'FREE_TEMPORARY_ERROR', retryable: true }
    expect(releaseFreeAttempt(retryable)).toBe(retryable)
    expect(releaseFreeAttempt({ phase: 'unknown', attempt: a, code: 'FREE_REQUEST_EXPIRED', retryable: false })).toEqual({ phase: 'editing' })
  })

  it('sends exactly the frozen request body', () => {
    const a = attempt({ acknowledged: true })
    expect(freeAttemptPayload(a)).toEqual({ estimate: a.estimate, label: 'Quality A', requestToken: 'token-1', warningsAcknowledged: true })
  })
})

describe('freePreflight', () => {
  const valid = { valid: true as const, issues: [] as [] }
  it('stops before any request when the current inputs are invalid', () => {
    expect(freePreflight({ valid: false, issues: [{ field: 'ppi', message: 'Enter PPI.' }] }, false)).toEqual({ action: 'fix', field: 'ppi' })
  })
  it('asks for review of local warnings before sending, then sends the acknowledgement', () => {
    const warned = { ...valid, warnings: [{ field: 'ppi', message: 'PPI is unusual.' }] }
    expect(freePreflight(warned, false)).toEqual({ action: 'review' })
    expect(freePreflight(warned, true)).toEqual({ action: 'submit', acknowledged: true })
  })
  it('sends an unacknowledged request when there is nothing local to review', () => {
    expect(freePreflight(valid, false)).toEqual({ action: 'submit', acknowledged: false })
    expect(freePreflight(valid, true)).toEqual({ action: 'submit', acknowledged: false })
  })
})

describe('freeRequestIdOf', () => {
  it('reads the request id from a server-shaped token without trusting it for anything else', () => {
    const id = '6f9a1c2e-0b7d-4c1a-9e3f-2d5b8a7c4e10'
    const token = `${Buffer.from(JSON.stringify({ version: 1, requestId: id })).toString('base64url')}.signature`
    expect(freeRequestIdOf(token)).toBe(id)
  })
  it('returns null for anything else', () => {
    expect(freeRequestIdOf('token-1')).toBeNull()
    expect(freeRequestIdOf(`${Buffer.from('{"requestId":"not-a-uuid"}').toString('base64url')}.x`)).toBeNull()
    expect(freeRequestIdOf('%%%.x')).toBeNull()
  })
})
