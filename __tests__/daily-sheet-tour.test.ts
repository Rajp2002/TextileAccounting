import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dailySheetTourSteps, dailySheetTourSpecs, dailySheetTourSelector, dailySheetTourExample } from '../lib/daily-sheet-tour'
import { dailySheetTutorialCopy, dailySheetStepCopy, dailySheetTourControlLabels } from '../lib/i18n/daily-sheet-tutorial'
import { tourRegistry, isTourEligible } from '../lib/tours/tour-registry'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'

const dictionaries = { en, gu, hi }
const languages = ['en', 'gu', 'hi'] as const
const page = readFileSync('docs/guided-tours/pages/daily-sheet.md', 'utf8')
const sheet = readFileSync('app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx', 'utf8')

describe('Daily Sheet tour contract', () => {
    it('teaches the nine fixed steps, two dialogs and both live handoffs', () => {
        expect(dailySheetTourSteps).toEqual(['ds-sheet', 'ds-shift', 'ds-reading', 'ds-pending', 'ds-earnings', 'ds-draft', 'ds-save', 'ds-correct', 'ds-handoff'])
        for (const empty of [false, true]) {
            const specs = dailySheetTourSpecs(empty)
            expect(specs.map(spec => spec.id)).toEqual(dailySheetTourSteps)
            expect(specs.map(spec => spec.anchor)).toEqual(['sheet', 'shift', 'reading', 'pending', 'review', 'draft', 'save', 'correct'].map(name => `[data-daily-tour="${name}"]`).concat(`[data-tour-anchor="daily.${empty ? 'empty-action' : 'first-reading'}"]`))
            expect(specs.filter(spec => spec.context).map(spec => spec.id)).toEqual(['ds-earnings', 'ds-correct'])
            expect(specs.filter(spec => spec.detail).map(spec => spec.id)).toEqual(['ds-sheet', 'ds-shift', 'ds-reading', 'ds-pending', 'ds-earnings', 'ds-save', 'ds-correct'])
            expect(specs.map(spec => spec.kind)).toEqual([...Array(8).fill('sample'), 'handoff'])
        }
        expect(dailySheetTourSelector('ds-handoff', true)).toContain('daily.empty-action')
        expect(dailySheetTourExample.metres * dailySheetTourExample.rate).toBe(dailySheetTourExample.earnings)
    })
    it.each(languages)('%s exactly preserves all approved copy, U-06, tokens and label addenda', language => {
        const dictionary = dictionaries[language].dailySheet
        const controls = dailySheetTourControlLabels(key => dictionary[key.slice('dailySheet.'.length) as keyof typeof dictionary])
        for (const row of page.split('\n')) {
            const cells = row.split('|').map(cell => cell.trim())
            const key = cells[1]?.match(/^`((?:\w+\.)+(?:title|body|detail|benefit))`$/)?.[1]
            if (key) {
                const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dailySheetTutorialCopy[language])
                expect(value).toBe(cells[2 + languages.indexOf(language)])
            }
            const label = cells[1]?.match(/^`dailySheet\.(\w+)`$/)?.[1]
            if (label) expect(dictionary[label as keyof typeof dictionary]).toBe(cells[2 + languages.indexOf(language)])
            const token = cells[1]?.match(/^`(printSheet|notRunning|workerReview|saveShift|editSavedLog)`$/)?.[1]
            if (token && language !== 'en') expect(controls[token as keyof typeof controls]).toBe(cells[language === 'gu' ? 3 : 4])
        }
        for (const step of dailySheetTourSteps) for (const empty of [false, true]) {
            const rendered = dailySheetStepCopy(language, step, controls, empty)
            expect(rendered.title).toBeTruthy()
            expect(rendered.body).toBeTruthy()
            expect(JSON.stringify(rendered)).not.toMatch(/\{c:|Save machine production|Print collection sheet|Worker payroll roll-up/)
            if (language === 'en') {
                // The fixed draft title has ten words; preserve the exact approved row.
                expect(rendered.title.split(/\s+/).length).toBeLessThanOrEqual(step === 'ds-draft' ? 10 : 9)
                expect(rendered.body.split(/\s+/).length).toBeLessThanOrEqual(55)
                if (rendered.detail) expect(rendered.detail.split(/\s+/).length).toBeLessThanOrEqual(35)
            } else {
                expect(rendered.body).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                expect(Object.values(rendered).join(' ').replace(/Weavly|Enter/g, '')).not.toMatch(/[A-Za-z]{2,}/)
            }
        }
        expect(dailySheetStepCopy(language, 'ds-save', controls).body).toContain(controls.saveShift)
        expect(dailySheetStepCopy(language, 'ds-pending', controls).body).toContain(controls.notRunning)
        expect(dailySheetStepCopy(language, 'ds-sheet', controls).detail).toContain(controls.printSheet)
        expect(dailySheetStepCopy(language, 'ds-earnings', controls).body).toContain(controls.workerReview)
        expect(dailySheetStepCopy(language, 'ds-correct', controls).body).toContain(controls.editSavedLog)
        expect(dailySheetStepCopy(language, 'ds-handoff', controls, true)).toEqual(dailySheetTutorialCopy[language].handoff.empty)
        expect(dailySheetTutorialCopy[language].guide.benefit).toBe(tourInvitationCopy[language].benefits['daily-sheet'])
    })
    it('keys the specified live controls without changing their operations or pending suffix', () => {
        for (const key of Object.keys(en.dailySheet)) expect(sheet).toContain(`t('dailySheet.${key}')`)
        expect(sheet).toContain("`${t('dailySheet.showPending')} (${registerSummary.pending + registerSummary.invalid})`")
        expect(sheet).toContain('onClick={printCollectionSheet}')
        expect(sheet).toContain('onKeyDown={handleMachineMetersKeyDown}')
        expect(sheet).toContain('disabled={row.status === \'absent\' || disabled || !context.jobId}')
        expect(sheet).toContain("data-tour-anchor={draftStatus === 'error' || draftStatus === 'conflict' ? undefined : 'daily.empty-action'} onClick={onAddWorker}")
        expect(sheet).toContain("firstReadingMachineId = draftStatus === 'error' ? undefined")
        expect(sheet).toContain("context.machineId === firstReadingMachineId ? 'daily.first-reading' : undefined")
        expect(sheet).toContain("getRow(context.workerId!).status !== 'absent' && context.jobId")
        expect(sheet).toContain("currentBatch ? t('dailySheet.saveCorrection') : t('dailySheet.saveShift')")
        // PI-04 (fixed): a date or shift change stays on the Daily Sheet's own path; see base-daily-sheet-navigation.test.ts.
        expect(sheet).toContain("window.history.replaceState(null, '', baseDailySheetHref({ ...navigation, date, shift: nextShift, entry: undefined }))")
        expect(sheet).toContain('max={initialData.today}')
    })
    it('uses the existing mounted-child runtime and a single responsive guide slot', () => {
        const wrapper = readFileSync('components/production/DailySheetGuidedTour.tsx', 'utf8')
        const runtime = readFileSync('components/tours/ReplicaGuidedTour.tsx', 'utf8')
        expect(wrapper).toContain('<ReplicaGuidedTour tourId="daily-sheet"')
        expect(wrapper).toContain('handoffStepId="ds-handoff"')
        expect(wrapper).toContain("dynamic(() => import('./DailySheetTourPreview'), { ssr: false })")
        expect(wrapper).toContain("import('@/lib/i18n/daily-sheet-tutorial')")
        expect(wrapper).toContain('[&>div:first-child]:min-[1280px]:order-last')
        expect(wrapper).toContain('production-daily-sheet-rail')
        expect(wrapper).not.toContain('<TourInvitation')
        expect(runtime.match(/<TourInvitation\b/g)).toHaveLength(1)
        expect(runtime).toContain('<div hidden={step !== null && step !== handoffStepId}>{children}</div>')
        expect(sheet).toContain('dialogOpen={isReviewOpen || isUnlockDialogOpen || isHistoryDialogOpen || isPayrollExpanded}')
        for (const file of ['DailySheetGuidedTour', 'DailySheetTourPreview']) expect(readFileSync(`components/production/${file}.tsx`, 'utf8')).not.toMatch(/saveBaseDailyProductionBatch|weavly:base-production:|localStorage/)
    })
    it('is opt-in Base-owner content v2', () => {
        expect(tourRegistry['daily-sheet'].contentVersion).toBe('v2')
        expect(isTourEligible('daily-sheet', 'base', 'owner')).toBe(true)
        for (const tier of ['free', 'lite']) expect(isTourEligible('daily-sheet', tier, 'owner')).toBe(false)
        expect(isTourEligible('daily-sheet', 'base', 'supervisor')).toBe(false)
    })
})
