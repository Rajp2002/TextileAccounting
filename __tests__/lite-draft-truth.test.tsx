import React, { act, useLayoutEffect } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isDraftStored, useAutosave, type DraftWriteOutcome } from '../hooks/useAutosave'
import { createEstimatorDraft, getEstimatorDraftStorageKey, type EstimatorDraftInput } from '../lib/estimator-drafts'

// LT02 (LC29): an immediate draft write reports what actually happened. A
// disabled or blocked write must never read as "stored on this device".

class HostElement extends EventTarget {
  nodeType = 1
  tagName = 'DIV'
  namespaceURI = 'http://www.w3.org/1999/xhtml'
  textContent = ''
  constructor(public ownerDocument: EventTarget) { super() }
}

type State = { value: string }
type Autosave = ReturnType<typeof useAutosave<State>>
const key = getEstimatorDraftStorageKey('org-a', 'user-a')
const input = (value: string): EstimatorDraftInput<State> => ({
  state: { value }, qualityLabel: value, partyName: '', warpInstruction: '', weftInstruction: '',
})
const shouldPersist = (data: EstimatorDraftInput<unknown>) => Boolean(data.qualityLabel)

let root: Root | null
let current: Autosave
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> }
let values: Map<string, string>

async function mount(enabled = true) {
  function Probe() {
    const autosave = useAutosave<State>({ orgId: 'org-a', userId: 'user-a', enabled, shouldPersist })
    useLayoutEffect(() => { current = autosave })
    return null
  }
  await act(() => root!.render(<Probe />))
  await act(() => vi.advanceTimersByTime(0))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  values = new Map()
  storage = {
    getItem: vi.fn((storageKey: string) => values.get(storageKey) ?? null),
    setItem: vi.fn((storageKey: string, value: string) => { values.set(storageKey, value) }),
    removeItem: vi.fn((storageKey: string) => { values.delete(storageKey) }),
  }
  const documentHost = Object.assign(new EventTarget(), { nodeType: 9, activeElement: null, visibilityState: 'visible' })
  const windowHost = Object.assign(new EventTarget(), { document: documentHost, HTMLIFrameElement: class {}, setTimeout, clearTimeout })
  vi.stubGlobal('window', windowHost)
  vi.stubGlobal('document', documentHost)
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  root = createRoot(new HostElement(documentHost) as unknown as HTMLElement)
})

afterEach(async () => {
  await act(() => root?.unmount())
  root = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('immediate draft writes report their real outcome', () => {
  it('a disabled hook writes nothing and says so', async () => {
    await mount(false)
    let outcome: DraftWriteOutcome | undefined
    await act(() => { outcome = current.saveDraftNow(input('A')) })
    expect(outcome).toBe('disabled')
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(isDraftStored(outcome!)).toBe(false)
  })

  it('an accepted write is written', async () => {
    await mount()
    let outcome: DraftWriteOutcome | undefined
    await act(() => { outcome = current.saveDraftNow(input('A')) })
    expect(outcome).toBe('written')
    expect(values.has(key)).toBe(true)
    expect(isDraftStored(outcome!)).toBe(true)
  })

  it('a storage exception is unavailable', async () => {
    await mount()
    storage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError') })
    let outcome: DraftWriteOutcome | undefined
    await act(() => { outcome = current.saveDraftNow(input('A')) })
    expect(outcome).toBe('unavailable')
  })

  it('inputs with nothing to recover are not reported as stored', async () => {
    await mount()
    let outcome: DraftWriteOutcome | undefined
    await act(() => { outcome = current.saveDraftNow(input('')) })
    expect(outcome).toBe('nothing_to_store')
    expect(isDraftStored(outcome!)).toBe(false)
  })

  it('a write waiting on the restore decision is blocked, and the recoverable draft is untouched', async () => {
    const stored = createEstimatorDraft(input('Earlier'), { savedAt: Date.now() - 60_000 })
    values.set(key, JSON.stringify(stored))
    await mount()
    expect(current.hasDraft).toBe(true)
    let outcome: DraftWriteOutcome | undefined
    await act(() => { outcome = current.saveDraftNow(input('Newer')) })
    expect(outcome).toBe('blocked')
    expect(JSON.parse(values.get(key)!).qualityLabel).toBe('Earlier')
  })

  it('flushing with nothing pending writes nothing and is not a stored claim', async () => {
    await mount()
    let outcome: DraftWriteOutcome | undefined
    await act(() => { outcome = current.flushDraft() })
    expect(outcome).toBe('nothing_to_store')
  })
})

describe('estimator messages follow the outcome', () => {
  const source = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
  const offline = source.slice(source.indexOf('const browserIsOnline = typeof navigator'), source.indexOf('const clientRequestId = quoteRequestIdRef.current ?? createClientRequestUuid()'))

  it('only claims device storage for a stored outcome, and names the page-only case', () => {
    expect(offline).toContain("const offlineDraft = saveDraftNow(buildCurrentDraft(undefined, 'costing'))")
    expect(offline).toContain('isDraftStored(offlineDraft)')
    expect(offline).toContain("offlineDraft === 'disabled'")
    expect(offline).toContain('This Cost Estimate is kept on this page only. Keep the page open until you reconnect, then save.')
    expect(offline).not.toMatch(/draftSaved\s*\?/)
  })

  it('the refresh guard and the failure toast use the stored check', () => {
    expect(source).toContain('return isDraftStored(saveDraftNow(buildCurrentDraft()))')
    expect(source).toContain('const draftStoredBeforeSubmit = isDraftStored(saveDraftNow(buildCurrentDraft(clientRequestId, \'costing\')))')
  })
})

describe('offline save copy is translated', () => {
  it('has Hindi and Gujarati for every message in the offline toast', async () => {
    const { BASE_PLAN_PHRASES } = await import('../lib/i18n/base-plan-phrases')
    const source = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
    const offline = source.slice(source.indexOf('const browserIsOnline = typeof navigator'), source.indexOf('const clientRequestId = quoteRequestIdRef.current ?? createClientRequestUuid()'))
    const phrases = [...offline.matchAll(/tx\('([^']+)'\)/g)].map(match => match[1])
    expect(phrases.length).toBe(5)
    for (const phrase of phrases) {
      expect(BASE_PLAN_PHRASES.hi[phrase], phrase).toBeTruthy()
      expect(BASE_PLAN_PHRASES.gu[phrase], phrase).toBeTruthy()
    }
  })
})
