import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { stockTourSelector, fabricStockTourSteps, fabricStockTourSpecs } from '../lib/stock-tour'
import { fabricStockTutorialCopy, fabricStockStepCopy, fabricStockTourControlLabels } from '../lib/i18n/stock-tutorial'
import { getTourDefinition, isTourEligible } from '../lib/tours/tour-registry'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
const locales = { en, gu, hi }
import { FABRIC_SAMPLE, fabricStockPhase, fabricStockSample, fabricStockSampleForm } from '../lib/tours/sample-data/stock'
import { TOUR_SURFACE_SELECTOR } from '../lib/tours/sample-surface'
import type { FabricStockTourStep } from '../lib/stock-tour'
const read = (file: string) => fs.readFileSync(file, 'utf8')
const approved = read('docs/guided-tours/pages/fabric-stock.md').split('\n').filter(line => /^\| `\w+\.(title|body|detail|benefit)`/.test(line)).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))

for (const kind of ['fabric-stock'] as const) describe(kind, () => {
    const client = read('app/(dashboard)/owner/stock/QualityStockClient.tsx')
    for (const step of fabricStockTourSteps.filter(id => !id.endsWith('-handoff'))) it(`${step}: its target is an element of the real page`, () => {
        const [, attribute, value] = stockTourSelector(step).match(/^\[(data-[\w-]+)="([^"]+)"\]$/)!
        expect(client, `${step} needs ${attribute}="${value}" on the real page`).toMatch(new RegExp(`${attribute}=\\{[^}]*['"]${value}['"]|${attribute}="${value}"|${attribute}=\\{entry\\?\\.kind`))
    })
    it('has complete localized explanations and remains Base-owner only', () => {
        const steps = fabricStockTourSteps
        expect(new Set(steps).size).toBe(steps.length)
        for (const language of ['en', 'gu', 'hi'] as const) {
            const fields = fabricStockTourSteps.map(step => fabricStockStepCopy(language, step, fabricStockTourControlLabels(key => key)).body)
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
            if (typeof fields === 'string') continue // Preserved legacy sample disclosure.
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
            expect(locales[language].qualityStock).not.toHaveProperty('audit')
        }
        expect(getTourDefinition('fabric-stock').contentVersion).toBe('v2')
    })
    it('preserves live mounting and uses the shared runtime for the stock tour', () => {
        const wrapper = read('components/stock/StockGuidedTour.tsx')
        const shell = read('components/tours/ReplicaGuidedTour.tsx')
        expect(wrapper).toContain('<ReplicaGuidedTour tourId={kind}')
        expect(wrapper).toContain('steps={fabricStockTourSpecs}')
        expect(wrapper).toContain('handoffStepId="fs-handoff"')
        expect(wrapper).not.toMatch(/yarn/i)
        expect(wrapper).toContain('<div className="stock-workspace-shell">{children}</div>')
        expect(shell).toContain('hidden={step !== null && step !== handoffStepId}')
        expect(shell).toContain('extra={renderExtra?.(step)}')
        expect(fs.existsSync('components/tours/StockTutorial.tsx')).toBe(false)
        expect(read('lib/i18n/stock-tutorial.ts')).not.toContain('fabricStockTutorialHelp')
        // The sample is the real page, never a hand-built lookalike.
        const sample = read('components/stock/StockSampleWorkspace.tsx')
        expect(sample).toContain("import QualityStockClient from '@/app/(dashboard)/owner/stock/QualityStockClient'")
        expect(sample).not.toMatch(/yarn/i)
        expect(wrapper).toContain("dynamic(() => import('./StockSampleWorkspace'), { ssr: false })")
        expect(fs.existsSync('components/stock/StockTourPreview.tsx')).toBe(false)
    })
})
