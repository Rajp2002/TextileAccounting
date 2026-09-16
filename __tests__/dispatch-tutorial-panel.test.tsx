import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchTourHelp, dispatchTourSteps, type DispatchTourStep } from '../lib/dispatch-tour'
import { dispatchTutorialCopy } from '../lib/i18n/dispatch-tutorial'

const state = vi.hoisted(() => ({ expanded: false, step: 'overview' as string, hook: 0, language: 'en' as 'en' | 'gu' | 'hi' }))
// Seed the disclosure hook so SSR can verify both views without a browser DOM.
vi.mock('react', async importOriginal => {
    const actual = await importOriginal<typeof React>()
    return { ...actual, useState: <T,>(initial: T) => actual.useState(state.hook++ === 0 && state.expanded ? state.step as T : initial) }
})
vi.mock('react-dom', () => ({ createPortal: (children: React.ReactNode) => children }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: state.language }) }))
vi.mock('@/hooks/use-mobile-tour', () => ({ useMobileTour: () => ({ mobile: false }) }))
vi.mock('@/lib/tours/tour-preferences', () => ({ persistTourCompleted: vi.fn() }))
import DispatchTutorial from '../components/tours/DispatchTutorial'

function renderPanel(step: DispatchTourStep, expanded: boolean) {
    state.step = step
    state.expanded = expanded
    state.hook = 0
    vi.stubGlobal('document', { body: {} })
    return renderToStaticMarkup(<DispatchTutorial step={step} onStepChange={vi.fn()} launcher={{ current: null }} returnScroll={{ current: { x: 0, y: 0 } }} />)
}
afterEach(() => vi.unstubAllGlobals())

describe('Dispatch optional help and core panel', () => {
    for (const language of ['en', 'gu', 'hi'] as const) for (const step of dispatchTourSteps) {
        it(`${language} ${step} keeps help opt-in and exposes its contextual topics`, () => {
            state.language = language
            const closed = renderPanel(step, false)
            expect(closed).toContain('aria-expanded="false"')
            expect(closed).not.toContain('id="dispatch-tour-help"')
            expect(closed).toContain('aria-valuemax="11"')
            expect(closed).toContain(`aria-valuenow="${dispatchTourSteps.indexOf(step) + 1}"`)
            const open = renderPanel(step, true)
            expect(open).toContain('aria-expanded="true"')
            expect(open).toContain('id="dispatch-tour-help"')
            for (const topic of dispatchTourHelp[step]) {
                // Render the text separately to use the same HTML escaping as the panel.
                const description = renderToStaticMarkup(<p>{dispatchTutorialCopy[language].fields[topic][1]}</p>).slice(3, -4)
                expect(open).toContain(description)
            }
            for (const control of ['skip', 'back', 'next']) expect(open).toContain(`data-tour-control="${control}"`)
        })
    }
})
