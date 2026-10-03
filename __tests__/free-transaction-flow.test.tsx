import React, { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFreeMeter } from '../hooks/use-free-meter'
import { FreeTransactionRecovery } from '../components/estimator/FreeTransactionRecovery'
import { makeFreeEstimate } from '../lib/free-estimator-defaults'

// The meter talks to the browser Supabase client only to watch sign-out.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }),
}))

// Same minimal host as autosave-status.test.tsx: React runs the real hook and
// its effects without a DOM dependency.
class HostElement extends EventTarget {
  nodeType = 1
  tagName = 'DIV'
  namespaceURI = 'http://www.w3.org/1999/xhtml'
  textContent = ''
  constructor(public ownerDocument: EventTarget) { super() }
}

type Meter = ReturnType<typeof useFreeMeter>
type Call = { url: string; body: Record<string, unknown> | null }
type Plain = { status: number; body: unknown }
type Reply = Plain | 'network' | Promise<Plain>

const PERIOD = { periodStart: '2026-09-30T18:30:00.000Z', resetsAt: '2026-10-31T18:30:00.000Z', policyVersion: 2 }
const status = (remaining: number, token: string | null = 'token-1', accountId = 'user-a') => ({
  status: 200,
  body: {
    plan: 'free', accessState: 'active', estimationEnabled: true, tourEnabled: false, tourState: 'completed',
    requestToken: token, demo: null,
    quota: { used: 2 - remaining, limit: 2, remaining, ...PERIOD },
    account: { id: accountId, name: 'Owner', email: 'owner@example.test', organizationName: 'Mill' },
  },
})
const saved = (remaining: number, requestId = 'request-1') => ({
  status: 200,
  body: {
    result: { productionCostPerM: 12.5 }, totals: { totalProductionCostPerM: 12.5 },
    quota: { used: 2 - remaining, limit: 2, remaining, ...PERIOD, replayed: false, requestId },
    requestId, savedCostingId: requestId,
  },
})
const warning = { status: 200, body: { needsAcknowledgement: true, warningFields: ['ppi'] } }

let root: Root | null
let current: Meter
let calls: Call[]
let statusReplies: Reply[]
let calculateReplies: Reply[]

function respond(reply: Reply | undefined): Promise<Response> {
  if (!reply || reply === 'network') return Promise.reject(new TypeError('Failed to fetch'))
  if (reply instanceof Promise) return reply.then(respond)
  return Promise.resolve(new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } }))
}
function deferred() {
  let resolve!: (reply: Plain) => void
  const promise = new Promise<Plain>(done => { resolve = done })
  return { promise, resolve }
}

let onPaid: ReturnType<typeof vi.fn<(tier: string) => void>>
function Probe({ estimate }: { estimate: ReturnType<typeof makeFreeEstimate> }) {
  const meter = useFreeMeter(true, estimate, 'Quality A', onPaid)
  useLayoutEffect(() => { current = meter })
  return null
}
let estimate: ReturnType<typeof makeFreeEstimate>

async function mount() {
  estimate = makeFreeEstimate()
  await act(() => root!.render(<Probe estimate={estimate} />))
  await act(async () => { await Promise.resolve() })
}

/** The owner edits a bound input on the page. */
async function edit(change: Partial<ReturnType<typeof makeFreeEstimate>>) {
  estimate = { ...estimate, ...change }
  await act(() => root!.render(<Probe estimate={estimate} />))
}

/** Renders the mounted recovery card exactly as EstimatorClient wires it. */
function recoveryHtml(meter: Meter) {
  return renderToStaticMarkup(
    <FreeTransactionRecovery
      transaction={meter.transaction}
      busy={meter.busy}
      onConfirm={meter.confirmReview}
      onCorrect={meter.correctReview}
      onRetry={meter.retry}
      onRelease={meter.release}
    />,
  )
}

beforeEach(() => {
  onPaid = vi.fn()
  calls = []
  statusReplies = []
  calculateReplies = []
  const documentHost = Object.assign(new EventTarget(), { nodeType: 9, activeElement: null, visibilityState: 'visible' })
  const windowHost = Object.assign(new EventTarget(), {
    document: documentHost, HTMLIFrameElement: class {}, setTimeout, clearTimeout,
    location: { assign: vi.fn() },
  })
  vi.stubGlobal('window', windowHost)
  vi.stubGlobal('document', documentHost)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null
    calls.push({ url, body })
    if (url === '/api/free/status') return respond(statusReplies.shift() ?? status(2))
    if (url === '/api/free/calculate') return respond(calculateReplies.shift())
    return respond({ status: 200, body: {} })
  }))
  root = createRoot(new HostElement(documentHost) as unknown as HTMLElement)
})

afterEach(async () => {
  await act(() => root?.unmount())
  root = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const calculateCalls = () => calls.filter(call => call.url === '/api/free/calculate')

describe('F01 initial unusual-value warning', () => {
  it('lets the owner either correct the inputs or explicitly confirm them, without locking the editor', async () => {
    statusReplies.push(status(2))
    calculateReplies.push(warning)
    await mount()
    await act(() => current.submit(false))

    expect(calculateCalls()).toHaveLength(1)
    expect(calculateCalls()[0].body).toMatchObject({ warningsAcknowledged: false, requestToken: 'token-1' })
    // A known, non-debited review must not look like an uncertain outcome.
    expect(current.pending).toBe(false)
    const html = recoveryHtml(current)
    expect(html).toContain('I reviewed the inputs; calculate')
    expect(html).toContain('data-free-recovery-action="correct"')
    expect(html).not.toContain('Retry the same calculation')
  })

  it('confirms the reviewed payload once, with the same token and the acknowledgement', async () => {
    calculateReplies.push(warning, saved(1))
    await mount()
    await act(() => current.submit(false))
    await act(() => current.confirmReview())

    const [first, second] = calculateCalls()
    expect(calculateCalls()).toHaveLength(2)
    expect(second.body).toEqual({ ...first.body, warningsAcknowledged: true })
    expect(current.completed?.id).toBe('request-1')
    expect(current.transaction).toEqual({ phase: 'editing' })
  })

  it('correction returns to editing with no debit; the next explicit calculation is a new request', async () => {
    statusReplies.push(status(2), status(2, 'token-1'), status(2, 'token-2'))
    calculateReplies.push(warning, saved(1, 'request-2'))
    await mount()
    await act(() => current.submit(false))
    await act(() => current.correctReview())
    expect(current.transaction).toEqual({ phase: 'editing' })
    expect(calculateCalls()).toHaveLength(1)

    await act(() => current.submit(false))
    expect(calculateCalls()[1].body).toMatchObject({ requestToken: 'token-2', warningsAcknowledged: false })
  })
})

describe('F01 editing during review', () => {
  it('an edit voids the review of the old values, so they can never be confirmed afterwards', async () => {
    calculateReplies.push(warning)
    await mount()
    await act(() => current.submit(false))
    expect(current.transaction.phase).toBe('review')

    await edit({ profitPct: estimate.profitPct + 5 })
    expect(current.transaction).toEqual({ phase: 'editing' })
    await act(() => current.confirmReview())
    expect(calculateCalls()).toHaveLength(1)
  })
})

describe('F02 acknowledged commit with a lost response', () => {
  it('resolves by replaying the same payload, token and acknowledgement exactly once', async () => {
    calculateReplies.push(warning, 'network', saved(1))
    await mount()
    await act(() => current.submit(false))
    await act(() => current.confirmReview())

    expect(current.transaction.phase).toBe('unknown')
    expect(current.pending).toBe(true)
    const html = recoveryHtml(current)
    expect(html).toContain('Retry the same calculation')
    expect(html).not.toContain('I reviewed the inputs; calculate')

    await act(() => current.retry())
    const [, acknowledged, replay] = calculateCalls()
    expect(calculateCalls()).toHaveLength(3)
    expect(replay.body).toEqual(acknowledged.body)
    expect(replay.body).toMatchObject({ warningsAcknowledged: true, requestToken: 'token-1' })
    expect(current.completed?.id).toBe('request-1')
    expect(current.pending).toBe(false)
  })

  it('a rapid second press while the first is in flight sends nothing new', async () => {
    calculateReplies.push(saved(1))
    await mount()
    await act(async () => { await Promise.all([current.submit(false), current.submit(false)]) })
    expect(calculateCalls()).toHaveLength(1)
  })
})

describe('F03 late rejection after an uncertain send', () => {
  it('keeps the original identity, offers saved history and an explicit release, never a new request', async () => {
    calculateReplies.push('network', { status: 400, body: { code: 'FREE_REQUEST_EXPIRED' } })
    await mount()
    await act(() => current.submit(false))
    await act(() => current.retry())

    expect(current.transaction).toMatchObject({ phase: 'unknown', code: 'FREE_REQUEST_EXPIRED', retryable: false, attempt: { requestToken: 'token-1' } })
    const html = recoveryHtml(current)
    expect(html).not.toContain('Retry the same calculation')
    expect(html).toContain('href="/free/costings"')
    expect(html).toContain('data-free-recovery-action="release"')
    // Submitting again is refused until the owner explicitly releases it.
    await act(() => current.submit(false))
    expect(calculateCalls()).toHaveLength(2)

    await act(() => current.release())
    expect(current.transaction).toEqual({ phase: 'editing' })
  })
})

describe('F04 save confirmed, then the balance refresh fails', () => {
  it('keeps the saved result confirmed and reports only the balance as unverified', async () => {
    // Mount read, pre-submit token read, then the post-save refresh fails.
    statusReplies.push(status(2), status(2), { status: 503, body: { code: 'FREE_TEMPORARY_ERROR' } })
    calculateReplies.push(saved(1))
    await mount()
    await act(() => current.submit(false))

    expect(current.completed?.id).toBe('request-1')
    // The transaction succeeded; it must not be reported as an uncertain outcome.
    expect(current.transaction).toEqual({ phase: 'editing' })
    expect(recoveryHtml(current)).not.toContain('Unable to confirm the outcome')
    expect(current.statusError).toBe('FREE_TEMPORARY_ERROR')
    // The pre-save status still says 2 left; it must not be shown as current.
    expect(current.balanceUnverified).toBe(true)

    await act(async () => { await current.refresh() })
    expect(current.balanceUnverified).toBe(false)
    expect(current.completed?.id).toBe('request-1')
  })

  it('an input-only edit makes the result stale without touching balance freshness', async () => {
    calculateReplies.push(saved(1))
    await mount()
    await act(() => current.submit(false))
    await edit({ profitPct: estimate.profitPct + 5 })
    expect(current.stale).toBe(true)
    expect(current.statusError).toBe('')
    expect(current.balanceUnverified).toBe(false)
  })
})

describe('F04 current balance comes only from the newest status read', () => {
  it('an older status read that returns late cannot restore a larger balance', async () => {
    const slow = deferred()
    statusReplies.push(status(2), slow.promise, status(1))
    await mount()
    let older!: Promise<unknown>
    await act(async () => { older = current.refresh(); await Promise.resolve() })
    await act(async () => { await current.refresh() })
    expect(current.status?.quota.remaining).toBe(1)
    await act(async () => { slow.resolve(status(2)); await older })
    expect(current.status?.quota.remaining).toBe(1)
  })

  it('a replayed receipt from an earlier month never becomes the current balance', async () => {
    const previousMonth = { periodStart: '2026-08-31T18:30:00.000Z', resetsAt: '2026-09-30T18:30:00.000Z', policyVersion: 2 }
    const replay = { status: 200, body: { ...saved(0).body, quota: { used: 2, limit: 2, remaining: 0, ...previousMonth, replayed: true, requestId: 'request-1' } } }
    calculateReplies.push('network', replay)
    await mount()
    await act(() => current.submit(false))
    await act(() => current.retry())

    expect(current.completed?.quota).toMatchObject({ replayed: true, periodStart: previousMonth.periodStart })
    expect(current.status?.quota).toMatchObject({ remaining: 2, periodStart: PERIOD.periodStart })
  })
})

describe('F06 paid access arrives while a Free attempt is unresolved', () => {
  const paidStatus = { status: 200, body: { ...status(2, null).body, plan: 'lite', accessState: 'paid', estimationEnabled: false } }

  it('holds the switch to the paid estimator until the owner releases the unresolved attempt', async () => {
    calculateReplies.push('network')
    await mount()
    await act(() => current.submit(false))
    expect(current.transaction.phase).toBe('unknown')

    statusReplies.push(paidStatus)
    await act(async () => { await current.refresh() })
    // A paid answer cannot replay the Free receipt, so the request can no longer be checked here.
    expect(current.transaction).toMatchObject({ phase: 'unknown', code: 'FREE_PAID_ACTIVE', retryable: false, attempt: { requestToken: 'token-1' } })
    expect(onPaid).not.toHaveBeenCalled()
    expect(recoveryHtml(current)).toContain('Your paid plan is active')

    await act(() => current.release())
    expect(onPaid).toHaveBeenCalledWith('lite')
  })

  it('switches immediately when nothing is unresolved', async () => {
    statusReplies.push(status(2), paidStatus)
    await mount()
    await act(async () => { await current.refresh() })
    expect(onPaid).toHaveBeenCalledWith('lite')
  })
})

describe('F15 existing browser events after a save', () => {
  const events = () => calls.filter(call => call.url === '/api/free/events').map(call => call.body)

  it('reports result_viewed keyed by the request, and quota_reached only when the receipt shows zero', async () => {
    calculateReplies.push(saved(1, 'request-1'))
    await mount()
    await act(() => current.submit(false))
    expect(events()).toEqual([{ eventId: 'request-1', name: 'result_viewed', language: 'en', entryPoint: 'estimator' }])
  })

  it('a save that uses the last costing also reports quota_reached for the same request', async () => {
    calculateReplies.push(saved(0, 'request-2'))
    await mount()
    await act(() => current.submit(false))
    expect(events().map(event => event?.name)).toEqual(['result_viewed', 'quota_reached'])
    expect(new Set(events().map(event => event?.eventId))).toEqual(new Set(['request-2']))
  })

  it('a review, an uncertain send or a rejection reports nothing', async () => {
    calculateReplies.push(warning, 'network', { status: 409, body: { code: 'FREE_QUOTA_EXHAUSTED' } })
    await mount()
    await act(() => current.submit(false))
    await act(() => current.confirmReview())
    await act(() => current.retry())
    expect(events()).toEqual([])
  })
})

describe('F14 account change during the session', () => {
  it('clears the previous owner\'s result and attempt when the status belongs to another account', async () => {
    statusReplies.push(status(2), status(2), status(1), status(2, 'token-9', 'user-b'))
    calculateReplies.push(saved(1))
    await mount()
    await act(() => current.submit(false))
    expect(current.completed?.id).toBe('request-1')

    await act(async () => { await current.refresh() })
    expect(current.completed).toBeNull()
    expect(current.transaction).toEqual({ phase: 'editing' })
    expect(current.status?.account.id).toBe('user-b')
  })

  it('ignores a delayed calculation response that returns after the owner changed', async () => {
    const late = deferred()
    // Every read after the switch belongs to the new owner.
    statusReplies.push(status(2), status(2), status(2, 'token-9', 'user-b'), status(2, 'token-9', 'user-b'))
    calculateReplies.push(late.promise)
    await mount()
    let submitted!: Promise<void>
    await act(async () => { submitted = current.submit(false); await Promise.resolve() })
    expect(current.pending).toBe(true)

    await act(async () => { await current.refresh() })
    await act(async () => { late.resolve(saved(1)); await submitted })
    expect(current.completed).toBeNull()
    expect(current.transaction).toEqual({ phase: 'editing' })
  })
})
