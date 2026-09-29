import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { productionTourSteps, productionTourSelector } from '../lib/production-tour'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
import { tourCommonCopy } from '../lib/i18n/tour-common'

const state = vi.hoisted(() => ({ language: 'en' as 'en' | 'gu' | 'hi', pathname: '/owner/production' }))
const dictionaries = { en, gu, hi }
function translate(key: string, values: Record<string, string> = {}) {
    const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dictionaries[state.language])
    return String(value).replace(/\{(\w+)\}/g, (token, name) => values[name] ?? token)
}
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: state.language, t: translate, tx: (text: string) => text }) }))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/components/tours/ReplicaGuidedTour', () => ({ default: ({ children }: { children: React.ReactNode }) => <section data-replica-shell>{children}</section> }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    const Content = ({ children, ...props }: { children: React.ReactNode; 'data-production-tour-preview'?: string }) => <div data-production-tour-preview={props['data-production-tour-preview']}>{children}</div>
    return { Dialog: Container, DialogContent: Content, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container }
})
import ProductionTourPreview from '../components/production/ProductionTourPreview'
import ProductionGuidedTour from '../components/production/ProductionGuidedTour'

describe('Production preview safety and targets', () => {
    for (const language of ['en', 'gu', 'hi'] as const) for (const step of productionTourSteps.filter(step => step !== 'pd-handoff')) it(`${language}: ${step} has one target and no actionable business controls`, () => {
        state.language = language
        const html = renderToStaticMarkup(<ProductionTourPreview step={step} />)
        const attribute = productionTourSelector(step).slice(1, -1)
        expect(html.split(attribute)).toHaveLength(2)
        expect(html).not.toMatch(/<(form|a)\b/)
        for (const tag of html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
        if (step.startsWith('pd-')) {
            expect(html).toContain(tourCommonCopy[language].sampleBanner)
            expect(html).not.toMatch(/Overview &amp; Looms|Loom Board|Save machine production|Production cost|Print collection sheet|Sample weaver|નમૂના વણકર|नमूना बुनकर/)
            expect(html).not.toMatch(/data-production-tour="(?:date|reading|save|draft|history)"/)
        }
    })
    it.each(['en', 'gu', 'hi'] as const)('%s uses the shared live labels and approved sample names', language => {
        state.language = language
        const labels = dictionaries[language].production
        const operators = renderToStaticMarkup(<ProductionTourPreview step="pd-operators" />)
        const loom = { en: 'Sample loom 1', gu: 'નમૂના લૂમ 1', hi: 'नमूना लूम 1' }[language]
        expect(operators).toContain(labels.manageOperatorsForLoom.replace('{loom}', loom))
        expect(operators).toContain(labels.machineBoard)
        expect(operators).toContain(labels.manageWorkers)
        expect(operators).toContain(labels.switchQuality)
        expect(operators).toContain(labels.qualityActions)
        const activation = renderToStaticMarkup(<ProductionTourPreview step="pd-activate" />)
        expect(activation).toContain(labels.activateQuality)
        expect(activation).toContain(`${labels.cost}: ₹40/m`)
        expect(activation).toContain('Weaver wage')
        expect(activation).toContain('Activate</button>')
        expect(activation).toContain('data-production-tour-preview="true"')
        const looms = renderToStaticMarkup(<ProductionTourPreview step="pd-looms" />)
        expect(looms).toContain(labels.assignLooms)
        expect(looms.match(/type="checkbox"/g)).toHaveLength(3)
        expect(looms.match(/checked=""/g)).toHaveLength(2)
        const prerequisite = renderToStaticMarkup(<ProductionTourPreview step="pd-prereq" />)
        for (const key of ['costings', 'yarnStock', 'machines', 'workers'] as const) expect(prerequisite).toContain(dictionaries[language].navigation[key])
    })
    it('removes Overview samples at handoff; Daily Sheet is covered by its dedicated preview suite', () => {
        state.language = 'en'
        expect(renderToStaticMarkup(<ProductionTourPreview step="pd-handoff" />)).toBe('')
        expect(fs.readFileSync('components/production/DailySheetTourPreview.tsx', 'utf8')).toContain('data-daily-tour={id}')
    })
    it('has no business writes, local draft writes, navigation or printing', () => {
        const source = fs.readFileSync('components/production/ProductionTourPreview.tsx', 'utf8')
        expect(source).not.toMatch(/from ['"].*(actions|supabase|next\/navigation|loaders)/)
        expect(source).not.toMatch(/fetch\(|localStorage|window\.(open|print)|onSubmit=|onClick=/)
        expect(source).toContain('open modal={false}')
        expect(source).toContain('showCloseButton={false}')
        expect(source).toContain('onOpenAutoFocus={event => event.preventDefault()}')
        expect(source).toContain('onCloseAutoFocus={event => event.preventDefault()}')
    })
    it('renders children only on Daily Sheet, with no guide or preview', () => {
        state.pathname = '/owner/production/daily-sheet'
        expect(renderToStaticMarkup(<ProductionGuidedTour userId="u1" orgId="o1"><input defaultValue="retained daily draft" /></ProductionGuidedTour>)).toBe('<input value="retained daily draft"/>')
        state.pathname = '/owner/production'
        expect(renderToStaticMarkup(<ProductionGuidedTour userId="u1" orgId="o1"><p>live child</p></ProductionGuidedTour>)).toContain('<section data-replica-shell="true"><p>live child</p></section>')
    })
    it('reuses opt-in, state preservation, completion and focus behavior without the details runtime', () => {
        const source = fs.readFileSync('components/production/ProductionGuidedTour.tsx', 'utf8')
        const shell = fs.readFileSync('components/tours/ReplicaGuidedTour.tsx', 'utf8')
        const runtime = fs.readFileSync('components/tours/GuidedTour.tsx', 'utf8')
        expect(source).toContain('<ReplicaGuidedTour tourId="production"')
        expect(source).toContain('handoffStepId="pd-handoff"')
        expect(source).toContain("dynamic(() => import('./ProductionTourPreview'), { ssr: false })")
        expect(source).not.toMatch(/production-details|productionTourDetailSteps|ProductionTutorial|walkthrough=/)
        expect(fs.existsSync('components/tours/ProductionTutorial.tsx')).toBe(false)
        expect(shell).toContain('useState<S | null>(null)')
        expect(shell).toContain('<div hidden={step !== null && step !== handoffStepId}>{children}</div>')
        expect(shell).toContain('launchScroll.current = { x: window.scrollX, y: window.scrollY }')
        expect(shell).toContain('returnFocus={returnFocus}')
        expect(runtime).toContain('persistTourCompleted')
        expect(runtime).toContain("spec.kind === 'handoff'")
    })
})
