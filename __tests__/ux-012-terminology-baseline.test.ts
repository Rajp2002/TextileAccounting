import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { UX012_DISTINCTIONS, UX012_PRIORITY_HELPERS, UX012_TERMS } from '../lib/terminology'

const source = (path: string) => readFileSync(path, 'utf8')

describe('UX-012 terminology baseline', () => {
    it('contains every product-owner-approved canonical term and high-risk distinction', () => {
        expect(Object.values(UX012_TERMS)).toEqual(expect.arrayContaining([
            'Loom',
            'Metres Produced This Shift',
            'Counter Reading',
            'Fabric Quality',
            'Market Run',
            'Party Order',
            'Party Ledger',
            'Amount Due',
            'Godown Stock',
            'Stock Inward',
            'Stock Lot',
            'Delivery Challan',
            'Cost Estimate',
            'Quotation',
            'Piece-rate Worker',
            'Salaried Worker',
            'Worker Hisaab',
            'Warp Yarn',
            'Weft Yarn',
            'Archive',
            'Taka',
            'm',
        ]))
        expect(UX012_DISTINCTIONS).toHaveLength(9)
        expect(UX012_DISTINCTIONS).toContain('Sale vs Dispatch vs Party Receipt Confirmation')
        expect(UX012_DISTINCTIONS).toContain('kg/100m vs m/kg')
    })

    it('retains helpers for every priority pilot-validation concept', () => {
        expect(Object.keys(UX012_PRIORITY_HELPERS).sort()).toEqual([
            'fabricQuality',
            'hajiri',
            'inam',
            'kapaat',
            'kharchi',
            'taka',
            'upaad',
            'warpWeft',
            'workerHisaab',
        ])
    })

    it('uses the approved navigation in English and Gujarati', () => {
        const en = source('lib/i18n/locales/en.ts')
        const gu = source('lib/i18n/locales/gu.ts')

        for (const term of ['Cost Estimate', 'Quotations', 'Party Orders', 'Party Ledger', 'Worker Hisaab', 'Godown Stock']) {
            expect(en).toContain(term)
        }
        for (const term of ['ખર્ચનો અંદાજ', 'કોટેશન', 'પાર્ટી ઑર્ડર', 'પાર્ટી લેજર', 'કારીગરનો હિસાબ', 'ગોડાઉન સ્ટોક']) {
            expect(gu).toContain(term)
        }

        expect(en).not.toContain('"mtrs"')
        expect(gu).not.toContain('"mtrs"')
        expect(gu).not.toContain('"machines": "મશીનો"')
        expect(gu).toContain('shiftProduction: "આ પાળીમાં ઉત્પાદિત મીટર"')
        expect(gu).toContain('saveHelper: "સાચવવા માટે આ પાળીમાં ઉત્પાદિત મીટર')
    })

    it('keeps shift production distinct from Counter Reading on the supervisor surface', () => {
        const locale = source('lib/i18n/locales/en.ts')
        const supervisor = source('app/(dashboard)/supervisor/dashboard/page.tsx')

        expect(locale).toContain('Metres Produced This Shift')
        expect(locale).toContain('not the loom Counter Reading')
        expect(supervisor).toContain('Metres Produced This Shift')
        expect(supervisor).toContain("t('floor.meter.shiftProduction')")
        expect(supervisor).not.toContain('Shift Meter Log')
    })

    it('keeps Sale, Dispatch, receipt confirmation, and their metre quantities explicit', () => {
        const dispatch = source('app/(dashboard)/owner/dispatches/DispatchesClient.tsx')
        const locale = source('lib/i18n/locales/en.ts')

        expect(locale).toContain('Metres Received by Party')
        expect(dispatch).toContain('Delivery Challan Number')
    })

    it('uses approved payroll terms in PDFs, CSV, and messaging', () => {
        const pdf = source('lib/generate-payslip.ts')
        const csv = source('app/(dashboard)/owner/payroll/PayrollClient.tsx')
        const message = source('lib/whatsapp.ts')

        for (const text of [pdf, csv, message]) {
            expect(text).toContain('Worker Hisaab')
            expect(text).toContain('Upaad')
        }
        expect(pdf).toContain('Piece-rate Worker')
        expect(pdf).toContain('Salaried Worker')
        expect(pdf).toContain("doc.text('Loom'")
        expect(pdf).toContain("doc.text('Metres'")
        expect(pdf).not.toContain('Meter Worker (Piece Rate)')
        expect(csv).not.toContain("'Total Meters'")
        expect(message).not.toContain('*PAYROLL SLIP')
    })

    it('adds human-readable terminology to the stable technical data export', () => {
        const dataExport = source('app/(dashboard)/owner/settings/data-export.ts')
        expect(dataExport).toContain('UX012_EXPORT_LABELS')
        expect(dataExport).toContain('high_risk_distinctions')
        expect(dataExport).toContain('Dataset keys remain stable technical identifiers')
    })

    it('forbids ambiguous and developer-facing labels on the primary pilot surfaces', () => {
        const surfaces = [
            'components/navigation/owner-sidebar.tsx',
            'components/factory-today/QuickActionsCard.tsx',
            'components/factory-today/CommercialsAttentionCard.tsx',
            'components/factory-today/TodayKpiStrip.tsx',
            'components/factory-today/PayrollHisaabCard.tsx',
            'app/(dashboard)/owner/advances/AdvancesClient.tsx',
            'app/(dashboard)/owner/stock/QualityStockClient.tsx',
            'lib/generate-payslip.ts',
            'lib/whatsapp.ts',
        ].map(source).join('\n')

        for (const forbidden of [
            'Shift Meter Log',
            'Meter Worker (Piece Rate)',
            'Fixed Staff',
            'Market Maal',
            'Godown Ledger',
            'Run the estimator',
            'Review Commercials',
            'PAYROLL SLIP',
            'Log shift meters',
            'Pending Advances',
            'Pending advances',
        ]) {
            expect(surfaces).not.toContain(forbidden)
        }
    })

    it('records the amendment without claiming factory-supervisor approval', () => {
        const amendment = source('docs/pilot-remediation/closure-packs/UX-012_REQUIREMENT_AMENDMENT.md')
        expect(amendment).toContain('Product-owner approval authorizes this amendment')
        expect(amendment).toContain('not and must not be described as factory-supervisor approval')
        expect(amendment).toContain('actual pilot factory user')
    })
})
