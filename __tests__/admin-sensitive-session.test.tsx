import React, { act, useLayoutEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSensitiveSessionBoundary } from '@/components/admin/sensitive-boundary'

const auth = vi.hoisted(() => ({ callback: null as null | ((event: string, session: { user: { id: string } } | null) => void), unsubscribe: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { onAuthStateChange: (callback: typeof auth.callback) => { auth.callback = callback; return { data: { subscription: { unsubscribe: auth.unsubscribe } } } } } }) }))

class HostElement extends EventTarget {
    nodeType = 1
    tagName = 'DIV'
    namespaceURI = 'http://www.w3.org/1999/xhtml'
    textContent = ''
    constructor(public ownerDocument: EventTarget) { super() }
}
let root: Root | null
let current: ReturnType<typeof useSensitiveSessionBoundary>
let windowHost: EventTarget
let documentHost: EventTarget & { visibilityState: string }
let replace: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>
function Probe() {
    const surface = useRef<HTMLDivElement>(null)
    const result = useSensitiveSessionBoundary('synthetic-founder', 'founder', surface)
    useLayoutEffect(() => { current = result })
    return null
}
function CandidateProbe() {
    const surface = useRef<HTMLDivElement>(null)
    const result = useSensitiveSessionBoundary('synthetic-founder', 'founder_candidate', surface, 'synthetic-session-tag')
    useLayoutEffect(() => { current = result })
    return null
}
beforeEach(async () => {
    auth.unsubscribe.mockClear()
    replace = vi.fn() // Intentionally never navigates: old content must still unmount.
    fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ userId: 'synthetic-founder' }), { status: 200 }))
    documentHost = Object.assign(new EventTarget(), { nodeType: 9, activeElement: null, visibilityState: 'visible' })
    windowHost = Object.assign(new EventTarget(), { document: documentHost, HTMLIFrameElement: class {}, setInterval, clearInterval, location: { replace } })
    vi.stubGlobal('window', windowHost)
    vi.stubGlobal('document', documentHost)
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    root = createRoot(new HostElement(documentHost) as unknown as HTMLElement)
    await act(() => root!.render(<Probe />))
    fetchMock.mockClear()
})
afterEach(async () => { await act(() => root?.unmount()); root = null; vi.unstubAllGlobals() })

describe('private surfaces after auth changes', () => {
    it('conceals a same-user sign-in and checks the live provider session tag before revealing enrollment', async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ userId: 'synthetic-founder', sessionTag: 'synthetic-session-tag' })))
        await act(() => root!.render(<CandidateProbe />))
        fetchMock.mockClear()
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ userId: 'synthetic-founder', sessionTag: 'different-provider-session' })))
        await act(async () => { auth.callback!('SIGNED_IN', { user: { id: 'synthetic-founder' } }); await Promise.resolve() })
        expect(current.invalidated).toBe(true)
        expect(replace).toHaveBeenCalledWith('/admin/login')
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/auth/session', expect.objectContaining({ cache: 'no-store' }))
    })
    it.each(['SIGNED_OUT','SIGNED_IN'])('unmounts old children even when %s navigation stalls', async event => {
        await act(() => auth.callback!(event, event === 'SIGNED_OUT' ? null : { user: { id: 'another-principal' } }))
        expect(current.invalidated).toBe(true)
        expect(current.message).toContain('session changed')
        expect(replace).toHaveBeenCalledWith('/admin/login')
        expect(fetchMock).not.toHaveBeenCalled()
    })
    it('treats a failed focus revalidation as hidden, never healthy or logged out data', async () => {
        fetchMock.mockRejectedValueOnce(new Error('offline'))
        await act(async () => { windowHost.dispatchEvent(new Event('focus')); await Promise.resolve() })
        expect(current.message).toContain('cannot be verified')
        expect(current.invalidated).toBe(false)
    })
    it('hides while offline and verifies a restored page without extending interactive idle', async () => {
        await act(() => windowHost.dispatchEvent(new Event('offline')))
        expect(current.message).toContain('offline')
        await act(async () => { windowHost.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })); await Promise.resolve() })
        expect(current.generation).toBe(1)
        expect(current.message).toBeNull()
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/session', expect.objectContaining({ cache: 'no-store' }))
        expect(fetchMock.mock.calls.every(([, options]) => !options.method)).toBe(true)
    })
    it('invalidates rather than reveal another principal returned by the authoritative endpoint', async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ userId: 'different-principal' }), { status: 200 }))
        await act(async () => { windowHost.dispatchEvent(new Event('focus')); await Promise.resolve() })
        expect(current.invalidated).toBe(true)
    })
    it('rechecks SPA back restoration without pageshow and stays hidden after denial', async () => {
        fetchMock.mockResolvedValueOnce(new Response('{}', { status: 403 }))
        await act(async () => { windowHost.dispatchEvent(new Event('popstate')); await Promise.resolve() })
        expect(current.generation).toBe(1)
        expect(current.invalidated).toBe(true)
        expect(current.message).toContain('session changed')
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/session', expect.objectContaining({ cache: 'no-store' }))
        expect(fetchMock.mock.calls.every(([, options]) => !options.method)).toBe(true)
    })
})
