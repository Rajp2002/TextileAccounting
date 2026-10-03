import React, { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFreeLeaveGuard, type FreeLeaveReason } from '../hooks/use-free-leave-guard'

const router = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

class HostElement extends EventTarget {
  nodeType = 1
  tagName = 'DIV'
  namespaceURI = 'http://www.w3.org/1999/xhtml'
  textContent = ''
  constructor(public ownerDocument: EventTarget) { super() }
}

type Guard = ReturnType<typeof useFreeLeaveGuard>
let root: Root | null
let current: Guard
let documentHost: EventTarget & { closest: (selector: string) => unknown }
let windowHost: EventTarget
let anchor: { href: string; target: string; hasAttribute: (name: string) => boolean }

function Probe({ reason }: { reason: FreeLeaveReason }) {
  const guard = useFreeLeaveGuard(reason)
  useLayoutEffect(() => { current = guard })
  return null
}
const render = (reason: FreeLeaveReason) => act(() => root!.render(<Probe reason={reason} />))

/** A primary-button click whose target resolves to `anchor`. */
function clickLink(modifiers: Partial<Record<'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey', boolean>> = {}) {
  const event = Object.assign(new Event('click', { cancelable: true, bubbles: true }), {
    button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...modifiers,
  })
  act(() => { documentHost.dispatchEvent(event) })
  return event
}

beforeEach(() => {
  router.push.mockReset()
  anchor = { href: 'https://app.example.test/plans?from=estimator', target: '', hasAttribute: () => false }
  documentHost = Object.assign(new EventTarget(), {
    nodeType: 9, activeElement: null, visibilityState: 'visible', closest: () => anchor,
  })
  windowHost = Object.assign(new EventTarget(), {
    document: documentHost, HTMLIFrameElement: class {}, setTimeout, clearTimeout,
    location: { origin: 'https://app.example.test', pathname: '/free', search: '', assign: vi.fn() },
  })
  vi.stubGlobal('window', windowHost)
  vi.stubGlobal('document', documentHost)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  root = createRoot(new HostElement(documentHost) as unknown as HTMLElement)
})

afterEach(async () => {
  await act(() => root?.unmount())
  root = null
  vi.unstubAllGlobals()
})

describe('useFreeLeaveGuard', () => {
  it('does nothing while the page is clean', async () => {
    await render(null)
    const event = clickLink()
    expect(event.defaultPrevented).toBe(false)
    expect(current.pendingHref).toBeNull()
  })

  it('stops a link that would unmount unsaved inputs and asks first', async () => {
    await render('unsaved')
    const event = clickLink()
    expect(event.defaultPrevented).toBe(true)
    expect(current.pendingHref).toBe('/plans?from=estimator')
    expect(router.push).not.toHaveBeenCalled()

    act(() => current.stay())
    expect(current.pendingHref).toBeNull()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('navigates only after the owner explicitly chooses to leave', async () => {
    await render('unresolved')
    clickLink()
    act(() => current.leave())
    expect(router.push).toHaveBeenCalledWith('/plans?from=estimator')
    expect(current.pendingHref).toBeNull()
  })

  it('leaves new-tab and modified clicks alone, because they keep this page', async () => {
    await render('unsaved')
    expect(clickLink({ metaKey: true }).defaultPrevented).toBe(false)
    anchor.target = '_blank'
    expect(clickLink().defaultPrevented).toBe(false)
  })

  it('asks the browser to confirm a reload or close only while guarded', async () => {
    await render('unsaved')
    const guarded = new Event('beforeunload', { cancelable: true })
    act(() => { windowHost.dispatchEvent(guarded) })
    expect(guarded.defaultPrevented).toBe(true)

    await render(null)
    const clean = new Event('beforeunload', { cancelable: true })
    act(() => { windowHost.dispatchEvent(clean) })
    expect(clean.defaultPrevented).toBe(false)
  })
})
