import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { stockTourSteps, stockTourSection, fabricStockExample, yarnStockExample, type StockTourKind } from '../lib/stock-tour'
import { stockTutorialCopy } from '../lib/i18n/stock-tutorial'
import { isTourEligible } from '../lib/tours/tour-registry'
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: 'en', t: (text: string) => text }) }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container }
})
import StockTourPreview from '../components/stock/StockTourPreview'
const kinds: StockTourKind[] = ['fabric-stock', 'yarn-stock']
for (const kind of kinds) describe(kind, () => {
    for (const step of stockTourSteps(kind)) it(`${step}: target exists and business controls are disabled`, () => {
        const html = renderToStaticMarkup(<StockTourPreview kind={kind} step={step} />)
        expect(html.match(new RegExp(`data-stock-tour="${step}"`, 'g'))).toHaveLength(1)
        expect(html).not.toMatch(/<(form|a)\b/)
        for (const tag of html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
    })
    it('has ordered sections and complete localized explanations', () => {
        const steps = stockTourSteps(kind)
        expect(new Set(steps).size).toBe(steps.length)
        const sections = steps.map(step => stockTourSection(step, kind))
        expect(sections).toEqual([...sections].sort((a, b) => a - b))
        for (const language of ['en', 'gu', 'hi'] as const) for (const step of steps) {
            const field = stockTutorialCopy[kind][language].fields[step]!
            expect(field.every(value => value.trim().length > 0)).toBe(true)
            if (language !== 'en') expect(field[1]).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
        }
        expect(isTourEligible(kind, 'base', 'owner')).toBe(true)
        expect(isTourEligible(kind, 'premium', 'owner')).toBe(true)
        expect(isTourEligible(kind, 'lite', 'owner')).toBe(false)
        expect(isTourEligible(kind, 'base', 'supervisor')).toBe(false)
    })
})
it('fabric examples balance correctly', () => {
    const s = fabricStockExample
    expect(s.opening + s.production - s.dispatch).toBe(s.balance)
    expect(s.balance + s.correction).toBe(s.counted)
})
it('preserves live state and keeps previews isolated', () => {
    const wrapper = fs.readFileSync('components/stock/StockGuidedTour.tsx', 'utf8')
    expect(wrapper).toContain('<div hidden={step !== null}>{children}</div>')
    for (const file of ['FabricStockTourPreview', 'YarnStockTourPreview']) {
        const source = fs.readFileSync(`components/stock/${file}.tsx`, 'utf8')
        expect(source).not.toMatch(/from ['"].*(actions|supabase|next\/navigation|loaders)/)
        expect(source).not.toMatch(/fetch\(|localStorage|sessionStorage|window\.(open|print)|onSubmit=|onClick=/)
    }
})

it('yarn examples reconcile receipt and dispatch quantities', () => {
    const s = yarnStockExample
    expect(s.dispatchedMetres / 100 * s.kgPer100).toBe(s.deduction)
    expect(s.opening + s.receipt - s.deduction).toBe(s.balance)
})
it('historical yarn previews hide mutation controls', () => {
    const html = renderToStaticMarkup(<StockTourPreview kind="yarn-stock" step="historical" />)
    expect(html).not.toContain('data-stock-tour="formulas"')
    expect(html).not.toContain('Add yarn')
    expect(html).not.toContain('Correct balance')
    expect(html).toContain('100 kg')
})
