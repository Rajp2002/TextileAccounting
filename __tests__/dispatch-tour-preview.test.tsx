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
    for (const language of ['en', 'gu', 'hi'] as const) for (const step of dispatchTourSteps.filter(step => step !== 'handoff')) it(`${language} ${step} has one target and no actionable business controls`, () => {
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
        expect(draft).toContain('₹4,000')
        const difference = renderToStaticMarkup(<DispatchTourPreview step="difference" />)
        expect(difference).toContain('₹3,920')
        expect(difference).not.toContain('challan.paid')
        const payment = renderToStaticMarkup(<DispatchTourPreview step="payment" />)
        expect(payment).toContain('₹3,920')
        expect(payment).toContain('value="2000"')
        expect(payment).toContain('₹1,920')
    })
    it('has no business writes, local draft writes, navigation or printing', () => {
        const source = fs.readFileSync('components/dispatches/DispatchTourPreview.tsx', 'utf8')
        expect(source).not.toMatch(/from ['"].*(actions|supabase|next\/navigation|loaders)/)
        expect(source).not.toMatch(/fetch\(|localStorage|window\.(open|print)|onSubmit=|onClick=/)
    })
    it('renders no replica at handoff', () => {
        expect(renderToStaticMarkup(<DispatchTourPreview step="handoff" />)).toBe('')
    })
    it('keeps Received as sent separate from the receipt fields and shows one shared sample banner', () => {
        const html = renderToStaticMarkup(<DispatchTourPreview step="receipt" />)
        const toolbar = html.indexOf('data-dispatch-receipt-toolbar')
        const fields = html.indexOf('data-dispatch-receipt-fields')
        expect(toolbar).toBeGreaterThan(0)
        expect(html.indexOf('challan.receivedAsSent')).toBeGreaterThan(toolbar)
        expect(html.indexOf('challan.receivedAsSent')).toBeLessThan(fields)
        expect(html.slice(fields)).not.toContain('challan.receivedAsSent')
        expect(html.match(/rounded-lg border border-hairline bg-surface-soft px-3 py-2/g)).toHaveLength(1)
        const source = fs.readFileSync('components/dispatches/DispatchTourPreview.tsx', 'utf8')
        expect(source).toContain('tourCommonCopy[language].sampleBanner')
        expect(source).not.toContain('max-w-6xl')
        expect(source).toContain('modal={false}')
        expect(source).toContain('showCloseButton={false}')
    })
})
