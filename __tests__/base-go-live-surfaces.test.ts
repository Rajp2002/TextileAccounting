import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'

const read = (path: string) => readFileSync(path, 'utf8')
const owner = 'app/(dashboard)/owner'
const KEYS = ['setupCardTitle', 'setupCardBody', 'changeDate', 'readinessQualities', 'readinessStaffed', 'readinessLegacyNone',
    'readinessLegacyStale', 'readinessLegacyFresh', 'scheduleTitle', 'scheduleBody', 'scheduleAction', 'sheetPreview',
    'payrollStarts', 'challansStart', 'openingDisabled', 'supervisorStarts', 'wizardStarts']

describe('Base setup phase surfaces', () => {
    it('has every go-live phrase in English, Hindi and Gujarati', () => {
        for (const locale of [en, hi, gu]) expect(Object.keys(locale.goLive).sort()).toEqual([...KEYS].sort())
        for (const key of KEYS) {
            const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
            const english = placeholders(en.goLive[key as keyof typeof en.goLive])
            expect(placeholders(hi.goLive[key as keyof typeof hi.goLive]), `hi ${key}`).toEqual(english)
            expect(placeholders(gu.goLive[key as keyof typeof gu.goLive]), `gu ${key}`).toEqual(english)
        }
    })
    it('shows the setup card on the production overview and closes payroll settlement', () => {
        const client = read(`${owner}/production/BaseProductionClient.tsx`)
        expect(client).toContain('<BaseGoLiveSetupCard')
        expect(client).toContain("t('goLive.payrollStarts'")
        expect(client).toContain('data-tour-anchor="payroll.settle" onClick={() => setWorkspaceOpen(true)} disabled={inSetup}')
        // Tours keep their sample pages during setup.
        expect(client).toContain('const inSetup = !tourSample && goLivePhase !== \'live\'')
    })
    it('previews go-live day on the daily sheet without recording', () => {
        const sheet = read(`${owner}/production/BaseDailyProductionSheet.tsx`)
        expect(sheet).toContain("const inSetup = !sample && goLivePhase !== 'live'")
        expect(sheet).toContain("t('goLive.sheetPreview'")
        expect(sheet).toMatch(/const areInputsDisabled = .*\|\| inSetup/)
    })
    it('keeps the opening-stock tour anchor while the tool is closed', () => {
        const stock = read(`${owner}/stock/QualityStockClient.tsx`)
        expect(stock).toContain('data-tour-anchor="fabric.opening" onClick={() => open(\'opening\')} disabled={openingClosed}')
        expect(stock).toContain("t('goLive.openingDisabled')")
    })
    it('closes new challans until go-live', () => {
        const challans = read(`${owner}/dispatches/ChallansClient.tsx`)
        expect(challans).toContain("t('goLive.challansStart'")
        expect(challans.match(/disabled=\{busy \|\| !!pending \|\| closedUntilGoLive\}/g)).toHaveLength(2)
    })
})
