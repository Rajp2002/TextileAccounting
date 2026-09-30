import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { stockTourSteps, stockTourSection, stockTourSelector, stockTourSurface, fabricStockBalance, fabricStockExample, yarnStockExample, fabricStockTourSteps, fabricStockTourSpecs, yarnStockTourSpecs, yarnStockTourSteps } from '../lib/stock-tour'
import { fabricStockTutorialCopy, fabricStockStepCopy, fabricStockTourControlLabels, fabricStockPreviewCopy, yarnStockTutorialCopy, yarnStockStepCopy, yarnStockTourControlLabels } from '../lib/i18n/stock-tutorial'
import { getTourDefinition, isTourEligible } from '../lib/tours/tour-registry'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
import { tourCommonCopy } from '../lib/i18n/tour-common'
const locales = { en, gu, hi }
const locale = vi.hoisted(() => ({ language: 'en' as 'en' | 'gu' | 'hi' }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: locale.language, t: (key: string) => {
    const [section, name] = key.split('.')
    return (locales[locale.language][section as keyof typeof en] as Record<string, string>)?.[name] ?? key
} }) }))
vi.mock('@/app/actions/tour-preferences', () => ({ recordTourEventAction: vi.fn() }))
vi.mock('@/components/ui/dialog', () => {
    const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container }
})
import { yarnStockText } from '../lib/i18n/yarn-stock'
import StockTourPreview from '../components/stock/StockTourPreview'
import { totalYarnKg, yarnMovementUsage } from '../lib/yarn-stock'
const read = (file: string) => fs.readFileSync(file, 'utf8')
const approved = read('docs/guided-tours/pages/fabric-stock.md').split('\n').filter(line => /^\| `\w+\.(title|body|detail|benefit)`/.test(line)).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))

for (const kind of ['fabric-stock', 'yarn-stock'] as const) describe(kind, () => {
    for (const step of stockTourSteps(kind).filter(id => !id.endsWith('-handoff'))) it(`${step}: target exists and business controls are disabled`, () => {
        const html = renderToStaticMarkup(<StockTourPreview kind={kind} step={step} />)
        const anchor = stockTourSelector(step).slice(1, -1)
        expect(html.split(anchor).length - 1).toBe(1)
        expect(html).not.toMatch(/<(form|a)\b/)
        for (const tag of html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
    })
    it('has complete localized explanations and remains Base-owner only', () => {
        const steps = stockTourSteps(kind)
        expect(new Set(steps).size).toBe(steps.length)
        for (const language of ['en', 'gu', 'hi'] as const) {
            const fields = kind === 'fabric-stock'
                ? fabricStockTourSteps.map(step => fabricStockStepCopy(language, step, fabricStockTourControlLabels(key => key)).body)
                : yarnStockTourSteps.map(step => yarnStockStepCopy(language, step, yarnStockTourControlLabels(language, key => key)).body)
            for (const body of fields) {
                expect(body.trim().length).toBeGreaterThan(0)
                if (language !== 'en') expect(body).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            }
        }
        expect(isTourEligible(kind, 'base', 'owner')).toBe(true)
        expect(isTourEligible(kind, 'premium', 'owner')).toBe(false)
        expect(isTourEligible(kind, 'lite', 'owner')).toBe(false)
        expect(isTourEligible(kind, 'base', 'supervisor')).toBe(false)
    })
})

describe('GT-08 Fabric Stock', () => {
    it('uses exactly the six specified anchors, presets, dialog contexts and detail steps', () => {
        expect(fabricStockTourSteps).toEqual(['fs-balance', 'fs-pending', 'fs-opening', 'fs-correct', 'fs-history', 'fs-handoff'])
        expect(fabricStockTourSpecs.map(spec => spec.anchor)).toEqual(['[data-stock-tour="balance"]', '[data-stock-tour="openingPending"]', '[data-stock-tour="opening"]', '[data-stock-tour="correction"]', '[data-stock-tour="history"]', '[data-tour-anchor="fabric.opening"]'])
        for (const spec of fabricStockTourSpecs) {
            expect(spec.kind).toBe(spec.id === 'fs-handoff' ? 'handoff' : 'sample')
            expect(spec.context).toBe(['fs-opening', 'fs-correct'].includes(spec.id) ? '[data-stock-tour-preview="true"]' : undefined)
            expect(Boolean(spec.detail)).toBe(['fs-correct', 'fs-history'].includes(spec.id))
        }
    })
    it('reconciles the 100 → 600 → 590 example at each step', () => {
        const s = fabricStockExample
        expect(s.production - s.dispatch).toBe(100)
        expect(s.opening).toBe(500)
        expect(s.opening + s.production - s.dispatch).toBe(s.balance)
        expect(s.balance + s.correction).toBe(s.counted)
        expect(fabricStockTourSteps.map(fabricStockBalance)).toEqual([100, 100, 100, 600, 590, null])
        expect(s).not.toHaveProperty('preStartPhysical')
        expect(s).not.toHaveProperty('historicalCommitted')
    })
    it.each(['en', 'gu', 'hi'] as const)('%s: matches approved copy, tokens, limits, native script and invitation benefit', language => {
        const copy = fabricStockTutorialCopy[language]
        expect(Object.keys(copy)).toEqual(Object.keys(fabricStockTutorialCopy.en))
        for (const [section, fields] of Object.entries(copy)) {
            if (typeof fields === 'string') continue // Preserved legacy sample disclosure is also used by Yarn.
            for (const [key, text] of Object.entries(fields)) {
                expect(text).toBe(approved.find(row => row[0] === `\`${section}.${key}\``)?.[['en', 'gu', 'hi'].indexOf(language) + 1])
                if (language !== 'en') {
                    expect(text).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                    expect(text.replace(/\{c:[^}]+\}|Weavly/g, '')).not.toMatch(/[A-Za-z]/)
                }
            }
        }
        const controls = fabricStockTourControlLabels(key => (locales[language].qualityStock as Record<string, string>)[key.replace('qualityStock.', '')])
        expect(Object.values(controls).every(value => typeof value === 'string' && value.length > 0)).toBe(true)
        for (const step of fabricStockTourSteps) {
            const resolved = fabricStockStepCopy(language, step, controls)
            expect(Object.values(resolved).join(' ')).not.toMatch(/\{[^}]+\}/)
            if (language === 'en') {
                expect(resolved.title.length).toBeLessThanOrEqual(48)
                expect(resolved.body.length).toBeLessThanOrEqual(190)
                expect(resolved.detail?.length ?? 0).toBeLessThanOrEqual(260)
            }
        }
        expect(fabricStockStepCopy(language, 'fs-pending', controls).body).toContain(`“${locales[language].qualityStock.pending}”`)
        expect(copy.guide.benefit).toBe(tourInvitationCopy[language].benefits['fabric-stock'])
        expect(JSON.stringify(copy)).not.toMatch(/Pending Dispatches|Earlier dispatch records|જૂના ડિસ્પેચ રેકોર્ડ|पुराने डिस्पैच रिकॉर्ड|650|150/)
    })
    it.each(['en', 'gu', 'hi'] as const)('%s: shows the correct balances, form amounts, history and only one sample banner', language => {
        locale.language = language
        try {
            const labels = locales[language].qualityStock
            for (const step of fabricStockTourSteps) {
                const html = renderToStaticMarkup(<StockTourPreview kind="fabric-stock" step={step} />)
                if (step === 'fs-handoff') { expect(html).toBe(''); continue }
                expect(html).toContain(`${fabricStockBalance(step)} ${labels.metres}</strong>`)
                expect(html).toContain(fabricStockPreviewCopy[language].quality)
                expect(html).not.toMatch(/<(form|a)\b/)
                for (const tag of html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
                if (language !== 'en') for (const value of Object.values(fabricStockPreviewCopy[language])) expect(value).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                expect(html.split(tourCommonCopy[language].sampleBanner).length - 1).toBe(1)
                expect(html).not.toContain('data-stock-tour="tracking"')
                expect(html.includes(`title="${labels.openingPending}"`)).toBe(['fs-balance', 'fs-pending', 'fs-opening'].includes(step))
            }
            const opening = renderToStaticMarkup(<StockTourPreview kind="fabric-stock" step="fs-opening" />)
            expect(opening).toContain('value="500"')
            expect(opening).toContain(`100 + 500 = 600 ${labels.metres}`)
            expect(opening).toContain(fabricStockPreviewCopy[language].countReference)
            const correction = renderToStaticMarkup(<StockTourPreview kind="fabric-stock" step="fs-correct" />)
            expect(correction).toContain('value="590"')
            expect(correction).toContain(`600 → 590 ${labels.metres} (-10 ${labels.metres})`)
            const history = renderToStaticMarkup(<StockTourPreview kind="fabric-stock" step="fs-history" />)
            expect(history).toContain(labels.correction)
            expect(history).toContain(`-10 ${labels.metres}`)
            expect(history).toContain(`${labels.balanceAfter}: 590 ${labels.metres}`)
            expect(history).toContain(fabricStockPreviewCopy[language].correctionReference)
        } finally { locale.language = 'en' }
    })
    it('keys the exact live controls and keeps the audit client in the same layout without a guide', () => {
        expect(fabricStockTourControlLabels(key => key)).toEqual({ pending: 'qualityStock.pending', openingStock: 'qualityStock.opening', correctBalance: 'qualityStock.correct', movementHistory: 'qualityStock.history', refresh: 'qualityStock.refresh', auditInventory: 'qualityStock.audit' })
        const live = read('app/(dashboard)/owner/stock/QualityStockClient.tsx')
        expect(live).toContain('<Button data-tour-anchor="fabric.opening" onClick={() => open(\'opening\')}')
        for (const key of ['audit', 'pending', 'opening', 'correct', 'history', 'refresh']) expect(live).toContain(`tx('${key}')`)
        expect(read('app/(dashboard)/owner/stock/YarnStockClient.tsx')).toContain("t('qualityStock.audit')")
        for (const [language, audit, pending] of [['en', 'Audit Inventory', 'Pending'], ['gu', 'સ્ટોક ઓડિટ', 'બાકી'], ['hi', 'स्टॉक ऑडिट', 'बाकी']] as const) {
            expect(locales[language].qualityStock.audit).toBe(audit)
            expect(locales[language].qualityStock.pending).toBe(pending)
        }
        const audit = read('app/(dashboard)/owner/stock/audit/page.tsx')
        expect(audit).not.toMatch(/StockGuidedTour|TourInvitation/)
        expect(audit).toContain("await requireRole(['owner'])")
        expect(audit).toContain('<div className="stock-workspace-shell">')
        expect(audit).toContain('<InventoryAuditClient initialData={result.data} />')
        expect(getTourDefinition('fabric-stock').contentVersion).toBe('v2')
        expect(getTourDefinition('yarn-stock').contentVersion).toBe('v2')
    })
    it('preserves live mounting and uses the shared runtime for both stock tours', () => {
        const wrapper = read('components/stock/StockGuidedTour.tsx')
        const shell = read('components/tours/ReplicaGuidedTour.tsx')
        expect(wrapper).toContain('<ReplicaGuidedTour tourId={kind}')
        expect(wrapper).toContain("steps={kind === 'fabric-stock' ? fabricStockTourSpecs : yarnStockTourSpecs}")
        expect(wrapper).toContain("handoffStepId={kind === 'fabric-stock' ? 'fs-handoff' : 'ys-handoff'}")
        expect(wrapper).toContain('<div className="stock-workspace-shell">{children}</div>')
        expect(shell).toContain('hidden={step !== null && step !== handoffStepId}')
        expect(shell).toContain('extra={renderExtra?.(step)}')
        expect(fs.existsSync('components/tours/StockTutorial.tsx')).toBe(false)
        expect(read('lib/i18n/stock-tutorial.ts')).not.toContain('fabricStockTutorialHelp')
        for (const file of ['FabricStockTourPreview', 'YarnStockTourPreview']) {
            const source = read(`components/stock/${file}.tsx`)
            expect(source).not.toMatch(/from ['"].*(actions|supabase|next\/navigation|loaders)/)
            expect(source).not.toMatch(/fetch\(|localStorage|sessionStorage|window\.(open|print)|onSubmit=|onClick=/)
            expect(source).toContain('Dialog open modal={false}')
            expect(source).toContain('data-stock-tour-preview="true"')
            expect(source).toContain('showCloseButton={false}')
            expect(source).toContain('onOpenAutoFocus={event => event.preventDefault()}')
            expect(source).toContain('onCloseAutoFocus={event => event.preventDefault()}')
        }
        expect(yarnStockTourSpecs.map(spec => spec.id)).toEqual(stockTourSteps('yarn-stock'))
        for (const spec of yarnStockTourSpecs) {
            expect(spec.kind).toBe(spec.id === 'ys-handoff' ? 'handoff' : 'sample')
            expect(spec.anchor).toBe(stockTourSelector(spec.id))
            expect(spec.context).toBe(stockTourSurface(spec.id) === 'page' ? undefined : '[data-stock-tour-preview="true"]')
        }
    })
})
describe('GT-09 Yarn Stock', () => {
    const approvedYarn = read('docs/guided-tours/pages/yarn-stock.md').split('\n').filter(line => /^\| `\w+\.(title|body|detail|benefit)`/.test(line)).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
    const expectedBalances = { 'ys-balance': 100, 'ys-opening': 100, 'ys-receipt': 120, 'ys-link': 120, 'ys-usage': 100, 'ys-correct': 100 }
    it('uses the seven approved steps, dialog contexts, shared details and live handoff', () => {
        expect(yarnStockTourSteps).toEqual(['ys-balance', 'ys-opening', 'ys-receipt', 'ys-link', 'ys-usage', 'ys-correct', 'ys-handoff'])
        expect(yarnStockTourSpecs.map(spec => spec.anchor)).toEqual(['[data-stock-tour="balance"]', '[data-stock-tour="opening"]', '[data-stock-tour="receipt"]', '[data-stock-tour="link"]', '[data-stock-tour="movement"]', '[data-stock-tour="correction"]', '[data-tour-anchor="yarn.opening"]'])
        expect(yarnStockTourSteps.map(stockTourSurface)).toEqual(['page', 'opening', 'receipt', 'link', 'page', 'correction', 'page'])
        for (const spec of yarnStockTourSpecs) {
            expect(spec.kind).toBe(spec.id === 'ys-handoff' ? 'handoff' : 'sample')
            expect(spec.context).toBe(['ys-opening', 'ys-receipt', 'ys-link', 'ys-correct'].includes(spec.id) ? '[data-stock-tour-preview="true"]' : undefined)
            expect(Boolean(spec.detail)).toBe(['ys-balance', 'ys-usage', 'ys-correct'].includes(spec.id))
        }
        const sections = yarnStockTourSteps.map(step => stockTourSection(step, 'yarn-stock'))
        expect(sections).toEqual([...sections].sort((a, b) => a - b))
        const wrapper = read('components/stock/StockGuidedTour.tsx')
        expect(wrapper).toContain("handoffStepId={kind === 'fabric-stock' ? 'fs-handoff' : 'ys-handoff'}")
        expect(wrapper).toContain('content.yarnStockStepCopy(language, step as YarnStockTourStep, content.yarnStockTourControlLabels(language, t))')
        expect(wrapper).not.toMatch(/YarnStockHelp|yarnStockTutorialHelp|renderExtra=/)
        expect(read('lib/i18n/stock-tutorial.ts')).not.toContain('yarnStockTutorialHelp')
    })
    it('reconciles receipt, production consumption and absolute correction with live stock arithmetic', () => {
        const s = yarnStockExample
        expect(s).toEqual({ warpKgPer100: 6, weftKgPer100: 4, opening: 100, receipt: 20, producedMetres: 200, kgPer100: 10, deduction: 20, balance: 100, counted: 98 })
        const yarns = [{ id: 'tour-yarn', yarn_name: 'Sample yarn', yarn_key: 'sample yarn', weight_kg: s.opening + s.receipt, opening_recorded: true }]
        const recipe = [{ yarn_name: 'Sample yarn', yarn_key: 'sample yarn', role: 'warp' as const, kg_per_100m: s.warpKgPer100 }, { yarn_name: 'Sample yarn', yarn_key: 'sample yarn', role: 'weft' as const, kg_per_100m: s.weftKgPer100 }]
        const usage = yarnMovementUsage({ yarn_id: 'tour-yarn', recipe_snapshot: { meters: s.producedMetres, recipe } }, yarns)!
        expect(usage).toEqual({ meters: 200, kgPer100m: 10 })
        expect(usage.meters * usage.kgPer100m / 100).toBe(s.deduction)
        expect(totalYarnKg(yarns) - s.deduction).toBe(s.balance)
        expect(s.counted - s.balance).toBe(-2)
    })
    it.each(['en', 'gu', 'hi'] as const)('%s: matches approved copy, live control labels, length limits and invitation', language => {
        const copy = yarnStockTutorialCopy[language]
        const text = yarnStockText[language]
        expect(Object.keys(copy)).toEqual(Object.keys(yarnStockTutorialCopy.en))
        for (const [section, fields] of Object.entries(copy)) {
            for (const [key, value] of Object.entries(fields)) {
                expect(value).toBe(approvedYarn.find(row => row[0] === `\`${section}.${key}\``)?.[['en', 'gu', 'hi'].indexOf(language) + 1])
                if (language !== 'en') {
                    expect(value).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                    expect(value.replace(/\{c:[^}]+\}/g, '')).not.toMatch(/[A-Za-z]/)
                }
            }
        }
        const controls = yarnStockTourControlLabels(language, key => (locales[language].qualityStock as Record<string, string>)[key.replace('qualityStock.', '')])
        expect(controls).toEqual({ openingWeight: text.opening, addYarn: text.receipt, linkCosting: text.link, correctBalance: text.correction, movementHistory: text.history, auditInventory: locales[language].qualityStock.audit })
        for (const step of yarnStockTourSteps) {
            const resolved = yarnStockStepCopy(language, step, controls)
            expect(Object.values(resolved).join(' ')).not.toMatch(/\{[^}]+\}/)
            const raw = copy[step.slice(3) as Exclude<keyof typeof copy, 'guide'>]
            for (const value of Object.values(raw)) for (const [, token] of value.matchAll(/\{c:(\w+)\}/g)) expect(Object.values(resolved).join(' ')).toContain(`“${controls[token as keyof typeof controls]}”`)
            if (language === 'en') {
                expect(resolved.title.length).toBeLessThanOrEqual(48)
                expect(resolved.body.length).toBeLessThanOrEqual(190)
                expect(resolved.detail?.length ?? 0).toBeLessThanOrEqual(260)
            }
        }
        expect(copy.guide.benefit).toBe(tourInvitationCopy[language].benefits['yarn-stock'])
    })
    it('teaches production deduction once, yarn held in fabric, and regular weighing versus a full dated audit', () => {
        const copy = yarnStockTutorialCopy.en
        expect(copy.usage.body).toContain('200 × 10 ÷ 100')
        expect(copy.usage.body).toContain('Dispatch does not deduct yarn again.')
        expect(copy.balance.detail).toContain("adds it back from each quality's kg per 100 m")
        expect(copy.usage.detail).toContain('Stock audit still counts them as your yarn')
        expect(copy.correct.body).toContain('Enter 98, not −2.')
        expect(copy.correct.detail).toContain('for regular weighing')
        expect(copy.correct.detail).toContain('full dated audit of fabric and yarn, kept as a record')
        expect(JSON.stringify(copy)).not.toMatch(/dispatch deducts|dispatch deductions|Dispatch uses yarn/)
    })
    it.each(['en', 'gu', 'hi'] as const)('%s: mirrors live sections, sample amounts and disabled controls with one banner', language => {
        locale.language = language
        try {
            const text = yarnStockText[language]
            for (const step of yarnStockTourSteps) {
                const html = renderToStaticMarkup(<StockTourPreview kind="yarn-stock" step={step} />)
                if (step === 'ys-handoff') { expect(html).toBe(''); continue }
                expect(html).toContain(`lang="${language}"`)
                expect(html).toContain(`${expectedBalances[step]} kg</strong>`)
                expect([...html.matchAll(/data-yarn-tour-section="([^"]+)"/g)].map(match => match[1])).toEqual(['header', 'balance', 'date', 'yarns', 'costings', 'history'])
                expect(html.split(stockTourSelector(step).slice(1, -1)).length - 1).toBe(1)
                expect(html.split(tourCommonCopy[language].sampleBanner).length - 1).toBe(1)
                for (const tag of html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? []) expect(tag).toContain('disabled=""')
                expect(html).not.toMatch(/<(form|a)\b/)
                for (const label of [text.refresh, text.opening, text.receipt, text.correction, text.history, text.audit, text.apply, text.export, text.formulas, text.link, locales[language].qualityStock.audit]) expect(html).toContain(label)
            }
            const opening = renderToStaticMarkup(<StockTourPreview kind="yarn-stock" step="ys-opening" />)
            expect(opening).toContain('value="100"')
            const receipt = renderToStaticMarkup(<StockTourPreview kind="yarn-stock" step="ys-receipt" />)
            expect(receipt).toContain('value="20"')
            expect(receipt).toContain('100 + 20 = 120 kg')
            const link = renderToStaticMarkup(<StockTourPreview kind="yarn-stock" step="ys-link" />)
            expect(link).toContain(text.noCostings)
            expect(link).toContain('v2')
            expect(link).toContain(`6 + 4 = 10 ${text.per100}`)
            const usage = renderToStaticMarkup(<StockTourPreview kind="yarn-stock" step="ys-usage" />)
            expect(usage).toContain(`${text.production_consumption} · −20 kg`)
            expect(usage).toContain('200 m × 10 ÷ 100 = 20 kg')
            const correction = renderToStaticMarkup(<StockTourPreview kind="yarn-stock" step="ys-correct" />)
            expect(correction).toContain('value="98"')
            expect(correction).toContain('100 → 98 kg (-2 kg)')
        } finally { locale.language = 'en' }
    })
    it('anchors only the real Opening weight control and keeps its existing lock and action', () => {
        const live = read('app/(dashboard)/owner/stock/YarnStockClient.tsx')
        expect(live).toContain(`<Button data-tour-anchor="yarn.opening" variant="outline" disabled={Boolean(request)} onClick={() => open({ kind: 'opening' })}>{text.opening}</Button>`)
        expect(live.match(/data-tour-anchor="yarn.opening"/g)).toHaveLength(1)
        expect(live).toContain("t('qualityStock.audit')")
    })
})
