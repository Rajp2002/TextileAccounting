import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { stockTourSteps, stockTourSection, fabricStockExample, yarnStockExample, fabricStockTourSteps, type StockTourKind } from '../lib/stock-tour'
import { stockTutorialCopy, fabricStockTutorialHelp, fabricStockPreviewCopy } from '../lib/i18n/stock-tutorial'
import { isTourEligible } from '../lib/tours/tour-registry'
const locale = vi.hoisted(() => ({ language: 'en' as 'en' | 'gu' | 'hi' }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: locale.language, t: (text: string) => text }) }))
vi.mock('@/lib/tours/tour-preferences', () => ({ persistTourCompleted: vi.fn() }))
vi.mock('react-dom', async original => ({
    ...await original<typeof import('react-dom')>(),
    createPortal: (children: React.ReactNode) => children,
}))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container }
})
import StockTourPreview from '../components/stock/StockTourPreview'
import StockTutorial from '../components/tours/StockTutorial'
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
    expect(s.preStartPhysical - s.historicalCommitted).toBe(s.opening)
    expect(s.opening + s.production - s.dispatch).toBe(s.balance)
    expect(s.balance + s.correction).toBe(s.counted)
})
describe('fabric core workflow and contextual detail', () => {
    it('keeps the seven business decisions in order', () => {
        expect(fabricStockTourSteps).toEqual(['balance', 'tracking', 'openingPending', 'opening', 'correction', 'counted', 'finish'])
        const fields = stockTutorialCopy['fabric-stock'].en.fields
        expect(fields.balance![1]).toContain('confirmed dispatches')
        expect(fields.balance![1]).toContain('draft does not deduct')
        expect(fields.tracking![1]).toContain('Historical production was not imported')
        expect(fields.openingPending![1]).toContain('Dispatch → Earlier dispatch records → Pending Dispatches')
        expect(fields.openingPending![1]).toContain('If access is restricted')
        expect(fields.opening![1]).toContain('does not replace')
        expect(fields.correction![1]).toContain('closes opening stock')
        expect(fields.counted![1]).toContain('590 as the verified total, not −10')
        expect(fields.finish![1]).toContain('If opening is missing')
        expect(fields.finish![1]).toContain('if already recorded')
    })
    for (const language of ['en', 'gu', 'hi'] as const) it(`${language}: renders every core target and preserves optional detail`, () => {
        locale.language = language
        try {
            const copy = stockTutorialCopy['fabric-stock'][language]
            for (const step of fabricStockTourSteps) {
                const html = renderToStaticMarkup(<StockTourPreview kind="fabric-stock" step={step} />)
                expect(html.match(new RegExp(`data-stock-tour="${step}"`, 'g'))).toHaveLength(1)
                expect(html).toContain(fabricStockPreviewCopy[language].quality)
                for (const tag of html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
                const help = fabricStockTutorialHelp[language][step]!
                expect(help.every(value => value.trim().length > 0)).toBe(true)
                if (language !== 'en') for (const value of [...help, ...Object.values(fabricStockPreviewCopy[language])]) {
                    expect(value).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                }
            }
            for (const number of ['650', '150', '500']) expect(copy.fields.openingPending![1]).toContain(number)
            for (const number of ['590', '−10']) expect(copy.fields.counted![1]).toContain(number)
            const opening = renderToStaticMarkup(<StockTourPreview kind="fabric-stock" step="opening" />)
            expect(opening).toContain('value="500"')
            expect(opening).toContain(fabricStockPreviewCopy[language].countReference)
            const correction = renderToStaticMarkup(<StockTourPreview kind="fabric-stock" step="counted" />)
            expect(correction).toContain('value="590"')
            expect(correction).toContain('(-10 m)')
            const history = renderToStaticMarkup(<StockTourPreview kind="fabric-stock" step="finish" />)
            expect(history).toContain('qualityStock.correction')
            expect(history).toContain('-10 m')
            expect(history).toContain('590 m')
            expect(history).toContain(fabricStockPreviewCopy[language].correctionReference)
        } finally { locale.language = 'en' }
    })
    it('keeps maintenance details available through localized help', () => {
        const help = fabricStockTutorialHelp.en
        expect(help.balance![1]).toContain('edits to historical production')
        expect(help.tracking![1]).toContain('without a quality')
        expect(help.opening![1]).toContain('three characters')
        expect(help.opening![1]).toContain('two decimal places')
        expect(help.correction![1]).toContain('close the form, Refresh stock')
        expect(help.finish![1]).toContain('filters cards only')
        expect(help.finish![1]).toContain('Load older movements')
        expect(help.finish![1]).toContain('Production links')
    })
    it('renders a collapsed help control on each Fabric step without adding it to Yarn', () => {
        vi.stubGlobal('document', { body: {} })
        try {
            for (const language of ['en', 'gu', 'hi'] as const) {
                locale.language = language
                for (const step of fabricStockTourSteps) {
                    const html = renderToStaticMarkup(<StockTutorial kind="fabric-stock" step={step} onStepChange={() => {}} launcher={{ current: null }} returnScroll={{ current: { x: 0, y: 0 } }} />)
                    expect(html).toContain('aria-expanded="false"')
                    expect(html).toContain(fabricStockTutorialHelp[language][step]![0])
                    expect(html).not.toContain(fabricStockTutorialHelp[language][step]![1])
                    expect(html).toContain('aria-valuemax="7"')
                }
            }
            const yarn = renderToStaticMarkup(<StockTutorial kind="yarn-stock" step="balance" onStepChange={() => {}} launcher={{ current: null }} returnScroll={{ current: { x: 0, y: 0 } }} />)
            expect(yarn).not.toContain('fabric-stock-tour-help')
        } finally { locale.language = 'en'; vi.unstubAllGlobals() }
    })
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
