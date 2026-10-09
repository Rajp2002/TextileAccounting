import React, { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchTourSteps, dispatchTourSpecs, type DispatchTourStep } from '../lib/dispatch-tour'
import { dispatchStepCopy, dispatchTourControlLabels } from '../lib/i18n/dispatch-tutorial'
import { TourPanel } from '../components/tours/TourPanel'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'

const controls = vi.hoisted(() => ({ launch: null as null | (() => Promise<void>), changeStep: null as null | ((step: DispatchTourStep | null) => void) }))
// ReplicaGuidedTour hands its tour to the page through context; the page header's Guide reads it.
vi.mock('@/components/tours/TourInvitation', async () => {
    const { createContext, useContext } = await import('react')
    const PageTour = createContext<{ onLaunch?: () => Promise<void>; sample?: boolean } | null>(null)
    return { PageTourProvider: PageTour.Provider, usePageTour: () => useContext(PageTour) }
})
vi.mock('next/dynamic', () => ({ default: () => ({ onStepChange }: { onStepChange: (step: DispatchTourStep | null) => void }) => {
    controls.changeStep = onStepChange
    return <div data-runtime="true" />
} }))
import ReplicaGuidedTour from '../components/tours/ReplicaGuidedTour'
import { usePageTour } from '../components/tours/TourInvitation'

/** Stands in for the page header's Guide: it takes the live (non-sample) tour's launcher. */
function GuideProbe() {
    const tour = usePageTour()
    useEffect(() => { if (tour && !tour.sample) controls.launch = tour.onLaunch as () => Promise<void> })
    return <button type="button">Guide</button>
}

const locales = { en, gu, hi }
describe('Dispatch shared panel', () => {
    for (const language of ['en', 'gu', 'hi'] as const) for (const step of dispatchTourSteps) {
        it(`${language} ${step} uses the shared panel with optional detail only where specified`, () => {
            const dictionary = locales[language].challan as Record<string, string>
            const copy = dispatchStepCopy(language, step, dispatchTourControlLabels(key => dictionary[key.replace('challan.', '')]))
            const index = dispatchTourSteps.indexOf(step)
            const html = renderToStaticMarkup(<TourPanel tourId="dispatch" stepId={step} {...copy} index={index} total={10}
                sample={step !== 'handoff'} status="ready" isLast={step === 'handoff'} onExit={vi.fn()} onBack={vi.fn()} onNext={vi.fn()} panelRef={{ current: null }} language={language} />)
            expect(html).toContain('aria-modal="true"')
            expect(html).toContain(`data-tour-step="${step}"`)
            expect(html).not.toMatch(/progressbar|dispatch-tour-help|More help/)
            expect(html.includes('data-tour-control="more"')).toBe(['confirm', 'payment'].includes(step))
            if (copy.detail) {
                expect(html).toContain('aria-expanded="false"')
                expect(html).toContain(renderToStaticMarkup(<p>{copy.detail}</p>).slice(3, -4))
            }
            expect(html.includes('data-tour-control="back"')).toBe(index > 0)
            for (const control of ['exit', 'next']) expect(html).toContain(`data-tour-control="${control}"`)
            expect(html).toContain(renderToStaticMarkup(<p>{copy.body}</p>).slice(3, -4))
        })
    }
})

// A minimal host for React DOM's real reconciler. No mocked useState or repeated
// SSR renders: updates below reuse the same root, DOM node and mounted child.
// Geometry, accessibility and browser APIs remain the separate harness's job.
class HostNode extends EventTarget {
    nodeType = 1
    nodeName: string
    tagName: string
    namespaceURI = 'http://www.w3.org/1999/xhtml'
    parentNode: HostNode | null = null
    childNodes: HostNode[] = []
    attributes = new Map<string, string>()
    style: Record<string, string> = {}
    private text = ''
    constructor(public ownerDocument: HostDocument, tag: string) {
        super()
        this.tagName = this.nodeName = tag.toUpperCase()
    }
    get firstChild(): HostNode | null { return this.childNodes[0] ?? null }
    get lastChild(): HostNode | null { return this.childNodes.at(-1) ?? null }
    get textContent(): string { return this.text + this.childNodes.map(child => child.textContent).join('') }
    set textContent(value: string) { this.text = value; this.childNodes = [] }
    appendChild(child: HostNode) { child.parentNode?.removeChild(child); this.childNodes.push(child); child.parentNode = this; return child }
    removeChild(child: HostNode) { this.childNodes.splice(this.childNodes.indexOf(child), 1); child.parentNode = null; return child }
    insertBefore(child: HostNode, before: HostNode) { child.parentNode?.removeChild(child); this.childNodes.splice(this.childNodes.indexOf(before), 0, child); child.parentNode = this; return child }
    setAttribute(key: string, value: string) { this.attributes.set(key, String(value)) }
    removeAttribute(key: string) { this.attributes.delete(key) }
    getAttribute(key: string) { return this.attributes.get(key) ?? null }
    hasAttribute(key: string) { return this.attributes.has(key) }
    find(key: string): HostNode | undefined { return this.hasAttribute(key) ? this : this.childNodes.map(child => child.find(key)).find(Boolean) }
}
class HostDocument extends EventTarget {
    nodeType = 9
    documentElement = new HostNode(this, 'html')
    body = new HostNode(this, 'body')
    activeElement = this.body
    defaultView = { document: this, HTMLIFrameElement: class {}, event: undefined, scrollX: 0, scrollY: 240, scrollTo: vi.fn() }
    createElement(tag: string) { return new HostNode(this, tag) }
    createElementNS(_namespace: string, tag: string) { return this.createElement(tag) }
    createTextNode(text: string) { const node = new HostNode(this, '#text'); node.nodeType = 3; node.textContent = text; return node }
}
let root: Root | undefined
afterEach(async () => {
    if (root) await act(() => root?.unmount())
    root = undefined
    vi.unstubAllGlobals()
})

describe('ReplicaGuidedTour state preservation', () => {
    it('keeps a changed stateful child mounted through samples, handoff, Back, Exit and replay', async () => {
        const document = new HostDocument()
        vi.stubGlobal('document', document)
        vi.stubGlobal('window', document.defaultView)
        vi.stubGlobal('HTMLElement', HostNode)
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
        const container = document.createElement('div')
        document.body.appendChild(container)
        let mounts = 0, unmounts = 0
        let changeValue: React.Dispatch<React.SetStateAction<string>> | undefined
        function StatefulChild() {
            const [value, setValue] = useState('original')
            changeValue = setValue
            useEffect(() => { mounts++; return () => { unmounts++ } }, [])
            return <div data-stateful>{value}</div>
        }
        root = createRoot(container as unknown as HTMLElement)
        await act(() => root!.render(<ReplicaGuidedTour tourId="dispatch" workspaceClassName="dispatch-workspace-shell"
            steps={dispatchTourSpecs} handoffStepId="handoff"
            copy={() => ({ title: 'Title', body: 'Body' })} renderReplica={step => <div data-sample>{step}</div>}
            userId="u1" orgId="o1"><GuideProbe /><StatefulChild /></ReplicaGuidedTour>))
        const child = container.find('data-stateful')!
        const live = child.parentNode!
        await act(() => changeValue!('retained draft'))
        expect(child.textContent).toBe('retained draft')
        expect(live.hasAttribute('hidden')).toBe(false)
        await act(async () => { await controls.launch!() })
        expect(live.hasAttribute('hidden')).toBe(true)
        expect(container.find('data-tour-replica')?.getAttribute('class')).toBe('dispatch-workspace-shell')
        for (const step of dispatchTourSteps) {
            await act(() => controls.changeStep!(step))
            expect(container.find('data-stateful')).toBe(child)
            expect(child.textContent).toBe('retained draft')
            expect(live.hasAttribute('hidden')).toBe(step !== 'handoff')
            expect(Boolean(container.find('data-sample'))).toBe(step !== 'handoff')
        }
        await act(() => controls.changeStep!('payment'))
        expect(live.hasAttribute('hidden')).toBe(true)
        await act(() => controls.changeStep!(null))
        expect(live.hasAttribute('hidden')).toBe(false)
        expect(container.find('data-sample')).toBeUndefined()
        await act(async () => { await controls.launch!() })
        await act(() => controls.changeStep!('handoff'))
        await act(() => controls.changeStep!(null))
        expect(container.find('data-stateful')).toBe(child)
        expect(child.textContent).toBe('retained draft')
        expect({ mounts, unmounts }).toEqual({ mounts: 1, unmounts: 0 })
        expect(document.defaultView.scrollTo).toHaveBeenCalledWith({ left: 0, top: 240, behavior: 'instant' })
        await act(() => root!.unmount())
        root = undefined
        expect({ mounts, unmounts }).toEqual({ mounts: 1, unmounts: 1 })
    })
})
