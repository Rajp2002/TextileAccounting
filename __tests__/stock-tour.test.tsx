import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { stockTourSteps, stockTourSection, stockTourSelector, fabricStockTourSteps, fabricStockTourSpecs, yarnStockTourSpecs, yarnStockTourSteps } from '../lib/stock-tour'
import { fabricStockTutorialCopy, fabricStockStepCopy, fabricStockTourControlLabels, yarnStockTutorialCopy, yarnStockStepCopy, yarnStockTourControlLabels } from '../lib/i18n/stock-tutorial'
import { getTourDefinition, isTourEligible } from '../lib/tours/tour-registry'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
const locales = { en, gu, hi }
import { yarnStockText } from '../lib/i18n/yarn-stock'
import { FABRIC_SAMPLE, YARN_SAMPLE, fabricStockPhase, fabricStockSample, fabricStockSampleForm, yarnStockPhase, yarnStockSample, yarnStockSampleEntry } from '../lib/tours/sample-data/stock'
import { TOUR_SURFACE_SELECTOR } from '../lib/tours/sample-surface'
import type { FabricStockTourStep, YarnStockTourStep } from '../lib/stock-tour'
import { totalYarnKg, yarnMovementUsage } from '../lib/yarn-stock'
const read = (file: string) => fs.readFileSync(file, 'utf8')
const approved = read('docs/guided-tours/pages/fabric-stock.md').split('\n').filter(line => /^\| `\w+\.(title|body|detail|benefit)`/.test(line)).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))

for (const kind of ['fabric-stock', 'yarn-stock'] as const) describe(kind, () => {
    const client = read(kind === 'fabric-stock' ? 'app/(dashboard)/owner/stock/QualityStockClient.tsx' : 'app/(dashboard)/owner/stock/YarnStockClient.tsx')
    for (const step of stockTourSteps(kind).filter(id => !id.endsWith('-handoff'))) it(`${step}: its target is an element of the real page`, () => {
        const [, attribute, value] = stockTourSelector(step).match(/^\[(data-[\w-]+)="([^"]+)"\]$/)!
        expect(client, `${step} needs ${attribute}="${value}" on the real page`).toMatch(new RegExp(`${attribute}=\\{[^}]*['"]${value}['"]|${attribute}="${value}"|${attribute}=\\{entry\\?\\.kind`))
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
            expect(spec.context).toBe(['fs-opening', 'fs-correct', 'fs-history'].includes(spec.id) ? TOUR_SURFACE_SELECTOR : undefined)
            expect(Boolean(spec.detail)).toBe(['fs-correct', 'fs-history'].includes(spec.id))
        }
    })
    it('reconciles the 100 → 600 → 590 example at each step on the real board', () => {
        const s = FABRIC_SAMPLE
        expect(s.production - s.dispatch).toBe(100)
        expect(s.opening).toBe(500)
        const balances = fabricStockTourSteps.filter(step => step !== 'fs-handoff').map(step => fabricStockSample('en', fabricStockPhase(step as FabricStockTourStep)).total_meters)
        expect(balances).toEqual([100, 100, 100, 600, 590])
        expect(fabricStockSampleForm('en', 'fs-opening')).toMatchObject({ kind: 'opening', meters: '500' })
        expect(fabricStockSampleForm('en', 'fs-correct')).toMatchObject({ kind: 'correction', meters: '590' })
        expect(fabricStockSampleForm('en', 'fs-balance')).toBeNull()
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
    it.each(['en', 'gu', 'hi'] as const)('%s: the sample board tells the opening, dispatch and correction story in its own language', language => {
        const pending = fabricStockSample(language, 'pending'), corrected = fabricStockSample(language, 'corrected')
        expect(pending.qualities[0]).toMatchObject({ opening_recorded: false, meters: 100, production_meters: 200 })
        expect(corrected.qualities[0]).toMatchObject({ opening_recorded: true, meters: 590 })
        expect(corrected.movements.map(row => row.kind)).toEqual(['correction', 'opening', 'dispatch', 'production'])
        expect(corrected.movements[0]).toMatchObject({ meters_delta: -10, balance_after: 590 })
        expect(corrected.movements.every(row => row.id.startsWith('tour-') && row.quality_id.startsWith('tour-'))).toBe(true)
        if (language !== 'en') expect(corrected.qualities[0].quality_label).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
    })
    it('keys the exact live controls, and the Stock Audit is gone from the page', () => {
        expect(fabricStockTourControlLabels(key => key)).toEqual({ pending: 'qualityStock.pending', openingStock: 'qualityStock.opening', correctBalance: 'qualityStock.correct', movementHistory: 'qualityStock.history', refresh: 'qualityStock.refresh' })
        const live = read('app/(dashboard)/owner/stock/QualityStockClient.tsx')
        expect(live).toContain('<Button data-tour-anchor="fabric.opening" onClick={() => open(\'opening\')}')
        for (const key of ['pending', 'opening', 'correct', 'history', 'refresh']) expect(live).toContain(`tx('${key}')`)
        // The Stock Audit was deleted on 2026-10-14.
        expect(live).not.toContain('/owner/stock/audit')
        expect(live).not.toContain("tx('audit')")
        expect(fs.existsSync('app/(dashboard)/owner/stock/audit/page.tsx')).toBe(false)
        for (const [language, pending] of [['en', 'Pending'], ['gu', 'બાકી'], ['hi', 'बाकी']] as const) {
            expect(locales[language].qualityStock.pending).toBe(pending)
        }
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
        // The sample is the real page, never a hand-built lookalike.
        const sample = read('components/stock/StockSampleWorkspace.tsx')
        expect(sample).toContain("import QualityStockClient from '@/app/(dashboard)/owner/stock/QualityStockClient'")
        expect(sample).toContain("import YarnStockClient from '@/app/(dashboard)/owner/stock/YarnStockClient'")
        expect(wrapper).toContain("dynamic(() => import('./StockSampleWorkspace'), { ssr: false })")
        expect(fs.existsSync('components/stock/StockTourPreview.tsx')).toBe(false)
        expect(yarnStockTourSpecs.map(spec => spec.id)).toEqual(stockTourSteps('yarn-stock'))
        for (const spec of yarnStockTourSpecs) {
            expect(spec.kind).toBe(spec.id === 'ys-handoff' ? 'handoff' : 'sample')
            expect(spec.anchor).toBe(stockTourSelector(spec.id))
            expect(spec.context).toBe(['ys-opening', 'ys-receipt', 'ys-link', 'ys-correct'].includes(spec.id) ? TOUR_SURFACE_SELECTOR : undefined)
        }
    })
})
describe('GT-09 Yarn Stock', () => {
    const approvedYarn = read('docs/guided-tours/pages/yarn-stock.md').split('\n').filter(line => /^\| `\w+\.(title|body|detail|benefit)`/.test(line)).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
    it('uses the seven approved steps, dialog contexts, shared details and live handoff', () => {
        expect(yarnStockTourSteps).toEqual(['ys-balance', 'ys-opening', 'ys-receipt', 'ys-link', 'ys-usage', 'ys-correct', 'ys-handoff'])
        expect(yarnStockTourSpecs.map(spec => spec.anchor)).toEqual(['[data-stock-tour="balance"]', '[data-stock-tour="opening"]', '[data-stock-tour="receipt"]', '[data-stock-tour="link"]', '[data-stock-tour="movement"]', '[data-stock-tour="correction"]', '[data-tour-anchor="yarn.opening"]'])
        for (const spec of yarnStockTourSpecs) {
            expect(spec.kind).toBe(spec.id === 'ys-handoff' ? 'handoff' : 'sample')
            expect(spec.context).toBe(['ys-opening', 'ys-receipt', 'ys-link', 'ys-correct'].includes(spec.id) ? TOUR_SURFACE_SELECTOR : undefined)
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
        const s = YARN_SAMPLE
        expect(s).toEqual({ warpKgPer100: 6, weftKgPer100: 4, opening: 100, receipt: 20, producedMetres: 200, kgPer100: 10, used: 20, counted: 98 })
        const yarns = [{ id: 'tour-yarn', yarn_name: 'Sample yarn', yarn_key: 'sample yarn', weight_kg: s.opening + s.receipt, opening_recorded: true }]
        const recipe = [{ yarn_name: 'Sample yarn', yarn_key: 'sample yarn', role: 'warp' as const, kg_per_100m: s.warpKgPer100 }, { yarn_name: 'Sample yarn', yarn_key: 'sample yarn', role: 'weft' as const, kg_per_100m: s.weftKgPer100 }]
        const usage = yarnMovementUsage({ yarn_id: 'tour-yarn', recipe_snapshot: { meters: s.producedMetres, recipe } }, yarns)!
        expect(usage).toEqual({ meters: 200, kgPer100m: 10 })
        expect(usage.meters * usage.kgPer100m / 100).toBe(s.used)
        expect(totalYarnKg(yarns) - s.used).toBe(100)
        expect(s.counted - 100).toBe(-2)
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
    it.each(['en', 'gu', 'hi'] as const)('%s: the sample board and dialogs carry the approved amounts in their own language', language => {
        const phases = yarnStockTourSteps.filter(step => step !== 'ys-handoff').map(step => yarnStockSample(language, yarnStockPhase(step as YarnStockTourStep), step !== 'ys-link').yarns[0].weight_kg)
        expect(phases).toEqual([100, 100, 120, 120, 100, 100])
        const used = yarnStockSample(language, 'used', true)
        expect(used.movements[0]).toMatchObject({ kind: 'production_consumption', kg_delta: -20, balance_after: 100 })
        expect(yarnMovementUsage(used.movements[0], used.yarns)).toEqual({ meters: 200, kgPer100m: 10 })
        expect(used.movements.every(row => row.id.startsWith('tour-') && row.yarn_id.startsWith('tour-'))).toBe(true)
        expect(yarnStockSample(language, 'received', false).qualities[0]).toMatchObject({ recipe: null, costing_id: null })
        expect(yarnStockSampleEntry(language, 'ys-opening')).toMatchObject({ kind: 'opening', weight: '100' })
        expect(yarnStockSampleEntry(language, 'ys-receipt')).toMatchObject({ kind: 'receipt', weight: '20' })
        expect(yarnStockSampleEntry(language, 'ys-correct')).toMatchObject({ kind: 'correction', weight: '98' })
        expect(yarnStockSampleEntry(language, 'ys-link')).toMatchObject({ kind: 'recipe' })
        expect(yarnStockSampleEntry(language, 'ys-balance')).toBeNull()
        if (language !== 'en') expect(used.yarns[0].yarn_name).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
    })
    it('anchors only the real Opening weight control and keeps its existing lock and action', () => {
        const live = read('app/(dashboard)/owner/stock/YarnStockClient.tsx')
        expect(live).toContain(`<Button data-tour-anchor="yarn.opening" variant="outline" disabled={Boolean(request)} onClick={() => open({ kind: 'opening' })}>{text.opening}</Button>`)
        expect(live.match(/data-tour-anchor="yarn.opening"/g)).toHaveLength(1)
        expect(live).toContain("t('qualityStock.audit')")
    })
})
