import React, { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutosave } from '../hooks/useAutosave'
import { createEstimatorDraft, getEstimatorDraftStorageKey, type EstimatorDraftInput } from '../lib/estimator-drafts'

// This hook renders no UI. A minimal host lets React run its real effects and
// rerenders without replacing its hooks or adding a DOM dependency.
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
let windowHost: EventTarget
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
  windowHost = Object.assign(new EventTarget(), {
    document: documentHost, HTMLIFrameElement: class {}, setTimeout, clearTimeout,
  })
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

describe('autosave status reflects the active editor draft', () => {
  it('does not confuse readable storage or an untouched form with a saved draft', async () => {
    await mount()
    expect(current.storageStatus).toBe('available')
    expect(current.draftSaveStatus).toBe('idle')
    await act(() => current.saveDraft(input('')))
    await act(() => vi.advanceTimersByTime(2_000))
    expect(current.draftSaveStatus).toBe('idle')
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('stays pending until the debounce writes the current inputs, without changing save callbacks', async () => {
    await mount()
    const saveDraft = current.saveDraft
    await act(() => { current.markUserEdit(); current.saveDraft(input('First')) })
    expect(current.draftSaveStatus).toBe('pending')
    await act(() => vi.advanceTimersByTime(1_500))
    await act(() => { current.markUserEdit(); current.saveDraft(input('Latest')) })
    await act(() => vi.advanceTimersByTime(1_999))
    expect(current.draftSaveStatus).toBe('pending')
    expect(values.has(key)).toBe(false)
    await act(() => vi.advanceTimersByTime(1))
    expect(current.draftSaveStatus).toBe('saved')
    expect(JSON.parse(values.get(key)!).state.value).toBe('Latest')
    expect(current.saveDraft).toBe(saveDraft)
    await act(() => current.markUserEdit())
    expect(current.draftSaveStatus).toBe('pending')
  })

  it('reports a failed write even if an older draft exists, then reports a successful retry', async () => {
    await mount()
    await act(() => { current.saveDraftNow(input('Older')) })
    expect(current.draftSaveStatus).toBe('saved')
    storage.setItem.mockImplementationOnce(() => { throw new Error('quota') })
    await act(() => { expect(current.saveDraftNow(input('Newer'))).toBe('unavailable') })
    expect(current.draftSaveStatus).toBe('error')
    expect(current.storageStatus).toBe('unavailable')
    expect(JSON.parse(values.get(key)!).state.value).toBe('Older')
    await act(() => { expect(current.flushDraft()).toBe('written') })
    expect(current.draftSaveStatus).toBe('saved')
    expect(JSON.parse(values.get(key)!).state.value).toBe('Newer')
  })

  it('returns to idle after a user reverts to default values and cancels the older pending write', async () => {
    await mount()
    await act(() => { current.markUserEdit(); current.saveDraft(input('Temporary edit')) })
    await act(() => vi.advanceTimersByTime(1_500))
    await act(() => { current.markUserEdit(); current.saveDraft(input('')) })
    expect(current.draftSaveStatus).toBe('idle')
    await act(() => vi.advanceTimersByTime(2_000))
    await act(() => windowHost.dispatchEvent(new Event('pagehide')))
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(current.draftSaveStatus).toBe('idle')
  })

  it('keeps recovery separate from the editor and never overwrites a pending recovery choice', async () => {
    const recoverable = createEstimatorDraft(input('Recoverable'))
    values.set(key, JSON.stringify(recoverable))
    await mount()
    expect(current.hasDraft).toBe(true)
    expect(current.draftSaveStatus).toBe('idle')
    await act(() => { current.markUserEdit(); current.saveDraft(input('Different')) })
    await act(() => vi.advanceTimersByTime(2_000))
    await act(() => { expect(current.saveDraftNow(input('Different'))).toBe('blocked') })
    expect(JSON.parse(values.get(key)!).state.value).toBe('Recoverable')
    await act(() => { expect(current.restoreDraft()?.state.value).toBe('Recoverable') })
    expect(current.draftSaveStatus).toBe('saved')
    await act(() => current.suppressAutosaveUntilChanged({ preserveDraftStatus: true }))
    await act(() => current.saveDraft(input('')))
    expect(current.draftSaveStatus).toBe('saved')
  })

  it('does not call an in-memory recovery copy saved when storage can no longer confirm it', async () => {
    values.set(key, JSON.stringify(createEstimatorDraft(input('Recoverable'))))
    await mount()
    storage.getItem.mockImplementationOnce(() => { throw new Error('blocked') })
    await act(() => { expect(current.restoreDraft()?.state.value).toBe('Recoverable') })
    expect(current.draftSaveStatus).toBe('pending')
  })

  it('resets the status after clearing and does not resurrect a cleared draft on pagehide', async () => {
    await mount()
    await act(() => { current.markUserEdit(); current.saveDraft(input('Draft')) })
    await act(() => windowHost.dispatchEvent(new Event('pagehide')))
    expect(current.draftSaveStatus).toBe('saved')
    expect(values.has(key)).toBe(true)
    await act(() => current.clearDraft())
    expect(current.draftSaveStatus).toBe('idle')
    await act(() => { current.saveDraft(input('Programmatic reset')); windowHost.dispatchEvent(new Event('pagehide')) })
    await act(() => vi.advanceTimersByTime(2_000))
    expect(values.has(key)).toBe(false)
    expect(current.draftSaveStatus).toBe('idle')
  })

  it('withdraws the saved status if another tab clears the active draft', async () => {
    await mount()
    await act(() => { current.saveDraftNow(input('Draft')) })
    values.delete(key)
    await act(() => windowHost.dispatchEvent(Object.assign(new Event('storage'), { key, newValue: null })))
    expect(current.draftSaveStatus).toBe('pending')
    expect(current.draftConflict?.kind).toBe('cleared')
  })

  it('does not offer browser draft saving when autosave is disabled', async () => {
    await mount(false)
    await act(() => { current.markUserEdit(); current.saveDraft(input('Free input')) })
    await act(() => vi.advanceTimersByTime(2_000))
    expect(current.draftSaveStatus).toBe('idle')
    expect(storage.setItem).not.toHaveBeenCalled()
  })
})
