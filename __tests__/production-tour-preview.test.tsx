import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { productionTourAllSteps } from '../lib/production-tour'

const locale = vi.hoisted(() => ({ language: 'en' as 'en' | 'gu' | 'hi' }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: locale.language, tx: (text: string) => text }) }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container }
})
import ProductionTourPreview from '../components/production/ProductionTourPreview'

describe('Production preview safety and targets', () => {
    for (const language of ['en', 'gu', 'hi'] as const) for (const step of productionTourAllSteps) it(`${language}: ${step} has one target and no actionable business controls`, () => {
        locale.language = language
        const html = renderToStaticMarkup(<ProductionTourPreview step={step} />)
        expect(html.match(new RegExp(`data-production-tour="${step}"`, 'g'))).toHaveLength(1)
        expect(html).not.toMatch(/<(form|a)\b/)
        for (const tag of html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
    })
    it('shows the related inputs together at the point of the decision', () => {
        locale.language = 'en'
        const activation = renderToStaticMarkup(<ProductionTourPreview step="activate" />)
        expect(activation).toContain('Weaver wage')
        expect(activation).toContain('Activate</button>')
        const operators = renderToStaticMarkup(<ProductionTourPreview step="operators" />)
        expect(operators).toContain('Manage Workers')
        expect(operators).toContain('Assign / Replace Operator')
        const date = renderToStaticMarkup(<ProductionTourPreview step="date" />)
        expect(date).toMatch(/data-production-tour="date"[\s\S]*Date[\s\S]*Shift/)
        const pending = renderToStaticMarkup(<ProductionTourPreview step="pending" />)
        expect(pending).toMatch(/data-production-tour="pending"[\s\S]*value=""[\s\S]*value="0"/)
        expect(pending).toContain('Not running')
    })
    it('has no business writes, local draft writes, navigation or printing', () => {
        const source = fs.readFileSync('components/production/ProductionTourPreview.tsx', 'utf8')
        expect(source).not.toMatch(/from ['"].*(actions|supabase|next\/navigation|loaders)/)
        expect(source).not.toMatch(/fetch\(|localStorage|window\.(open|print)|onSubmit=|onClick=/)
    })
    it('preserves the live page and starts only from explicit launch controls', () => {
        const source = fs.readFileSync('components/production/ProductionGuidedTour.tsx', 'utf8')
        expect(source).toContain('<div hidden={step !== null}>{children}</div>')
        expect(source).toContain('useState<ProductionTourStep | null>(null)')
        expect(source.indexOf('returnScroll.current =')).toBeLessThan(source.indexOf('setStep(productionTourSteps'))
        expect(source).toContain('data-tour-control="production-details"')
        expect(source).toContain('setStep(productionTourDetailSteps[0])')
        expect(source).toContain('returnFocus.current = event.currentTarget')
    })
    it('restores the initiating control and only marks the core Finish complete', () => {
        const source = fs.readFileSync('components/tours/ProductionTutorial.tsx', 'utf8')
        expect(source).toContain('productionTourSequence(step)')
        expect(source).toContain("if (step === 'finish') void persistTourCompleted('production', userId)")
        // Package 2D: the focus strategy is named here and implemented in the
        // shared tour hook (behavior covered by guided-tour-focus.test.ts).
        expect(source).toContain("focusReturn: 'return-focus-or-launcher'")
        const tourHook = fs.readFileSync('hooks/use-guided-tour.ts', 'utf8')
        expect(tourHook).toContain('returnFocus?.current ?? launcherElement')
        expect(tourHook).toContain('trigger?.isConnected ? trigger : launcherElement')
        expect(tourHook).toContain('trigger?.focus({ preventScroll: true })')
        expect(tourHook).toContain('window.scrollTo({ left: scroll.x, top: scroll.y')
    })
})
