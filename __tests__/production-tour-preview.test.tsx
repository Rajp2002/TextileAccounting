import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { productionTourSteps } from '../lib/production-tour'

vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: 'en', tx: (text: string) => text }) }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container }
})
import ProductionTourPreview from '../components/production/ProductionTourPreview'

describe('Production preview safety and targets', () => {
    for (const step of productionTourSteps) it(`${step} has one target and no actionable business controls`, () => {
        const html = renderToStaticMarkup(<ProductionTourPreview step={step} />)
        expect(html.match(new RegExp(`data-production-tour="${step}"`, 'g'))).toHaveLength(1)
        expect(html).not.toMatch(/<(form|a)\b/)
        for (const tag of html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
    })
    it('has no business writes, local draft writes, navigation or printing', () => {
        const source = fs.readFileSync('components/production/ProductionTourPreview.tsx', 'utf8')
        expect(source).not.toMatch(/from ['"].*(actions|supabase|next\/navigation|loaders)/)
        expect(source).not.toMatch(/fetch\(|localStorage|window\.(open|print)|onSubmit=|onClick=/)
    })
    it('preserves the live page and starts only from the invitation', () => {
        const source = fs.readFileSync('components/production/ProductionGuidedTour.tsx', 'utf8')
        expect(source).toContain('<div hidden={step !== null}>{children}</div>')
        expect(source).toContain('useState<ProductionTourStep | null>(null)')
        expect(source.indexOf('returnScroll.current =')).toBeLessThan(source.indexOf('setStep(productionTourSteps'))
    })
})
