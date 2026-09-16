import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { dispatchTourSteps } from '../lib/dispatch-tour'

const state = vi.hoisted(() => ({ language: 'en' as 'en' | 'gu' | 'hi' }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: state.language, t: (text: string) => text }) }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container }
})
import DispatchTourPreview from '../components/dispatches/DispatchTourPreview'

describe('Dispatch preview safety and targets', () => {
    for (const language of ['en', 'gu', 'hi'] as const) for (const step of dispatchTourSteps) it(`${language} ${step} has one target and no actionable business controls`, () => {
        state.language = language
        const html = renderToStaticMarkup(<DispatchTourPreview step={step} />)
        expect(html.match(new RegExp(`data-dispatch-tour="${step}"`, 'g'))).toHaveLength(1)
        expect(html).not.toMatch(/<(form|a)\b/)
        for (const tag of html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
    })
    it('shows the workflow quantities at the right stage', () => {
        state.language = 'en'
        const draft = renderToStaticMarkup(<DispatchTourPreview step="lots" />)
        expect(draft).toContain('value="60"')
        expect(draft).toContain('value="40"')
        expect(draft).toContain('₹4000')
        const difference = renderToStaticMarkup(<DispatchTourPreview step="difference" />)
        expect(difference).toContain('challan.review')
        expect(difference).not.toContain('challan.paid')
        const payment = renderToStaticMarkup(<DispatchTourPreview step="payment" />)
        expect(payment).toContain('₹3920')
        expect(payment).toContain('value="2000"')
        const balance = renderToStaticMarkup(<DispatchTourPreview step="balance" />)
        expect(balance).toContain('₹1920')
    })
    it('has no business writes, local draft writes, navigation or printing', () => {
        const source = fs.readFileSync('components/dispatches/DispatchTourPreview.tsx', 'utf8')
        expect(source).not.toMatch(/from ['"].*(actions|supabase|next\/navigation|loaders)/)
        expect(source).not.toMatch(/fetch\(|localStorage|window\.(open|print)|onSubmit=|onClick=/)
    })
    it('preserves the live page and starts only from the invitation', () => {
        const source = fs.readFileSync('components/dispatches/DispatchGuidedTour.tsx', 'utf8')
        expect(source).toContain('<div hidden={step !== null}>{children}</div>')
        expect(source).toContain('useState<DispatchTourStep | null>(null)')
        expect(source.indexOf('returnScroll.current =')).toBeLessThan(source.indexOf('setStep(dispatchTourSteps'))
    })
})
