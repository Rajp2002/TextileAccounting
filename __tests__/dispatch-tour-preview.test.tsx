import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { dispatchTourSteps } from '../lib/dispatch-tour'

vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: 'en', t: (text: string) => text }) }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container }
})
import DispatchTourPreview from '../components/dispatches/DispatchTourPreview'

describe('Dispatch preview safety and targets', () => {
    for (const step of dispatchTourSteps) it(`${step} has one target and no actionable business controls`, () => {
        const html = renderToStaticMarkup(<DispatchTourPreview step={step} />)
        expect(html.match(new RegExp(`data-dispatch-tour="${step}"`, 'g'))).toHaveLength(1)
        expect(html).not.toMatch(/<(form|a)\b/)
        for (const tag of html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
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
