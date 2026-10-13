import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { comparisonCostingSteps, costingTourSurface, makeSavedCostingTourExamples, savedCostingTourEnding, savedCostingTourSteps, savedCostingTourSpecs, savedCostingTourValues } from '../lib/saved-costings-tour'
import { savedCostingControlLabels, savedCostingStepCopy, savedCostingsTutorialCopy } from '../lib/i18n/saved-costings-tutorial'
import { compareSavedCostingSnapshots, orderSavedCostingsForComparison } from '../lib/saved-costings'
import { formatTourText } from '../lib/tours/tour-text'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'

const read = (file: string) => readFileSync(file, 'utf8')
const tutorial = read('components/estimator/SavedCostingsTutorial.tsx')
const runtime = read('components/estimator/SavedCostingsTourRuntime.tsx')
const page = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
const freePage = read('app/free/costings/SavedFreeCostings.tsx')
const locales = { en, gu, hi }
const values = savedCostingTourValues()
const tokenTable = read('docs/guided-tours/pages/saved-costings.md').split('### F.2')[1].split('\n').filter(line => line.startsWith('| `')).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
const controls = savedCostingControlLabels(key => {
  const id = key.split('.').at(-1)!
  return (en.tourControls.savedCostings as Record<string, string>)[id] ?? (en.common as Record<string, string>)[id]
}, text => text)
const baseOptions = { free: false, ending: 'existing' as const, controls, values }

describe('Saved Costings reference tour', () => {
  it('uses exactly four Free, six Lite, seven Base and four optional Compare steps', () => {
    expect(savedCostingTourSteps(true, true)).toEqual(['snapshots', 'freeSelect', 'internal', 'finish'])
    expect(savedCostingTourSteps(false)).toEqual(['find', 'versions', 'economics', 'reuse', 'internal', 'finish'])
    expect(savedCostingTourSteps(false, true)).toEqual(['find', 'versions', 'economics', 'reuse', 'internal', 'production', 'finish'])
    expect(comparisonCostingSteps).toEqual(['compareSelect', 'comparison', 'comparisonDetails', 'compareHandoff'])
    expect(savedCostingsTutorialCopy.en['free.snapshots.body']).toContain('does not use your monthly allowance')
    expect(savedCostingsTutorialCopy.en['free.snapshots.detail']).toContain('one version per costing')
    expect(savedCostingTourSpecs(true, true, true)).toHaveLength(4)
  })
  it('keeps the approved anchors and sample contexts with a real final handoff', () => {
    const specs = savedCostingTourSpecs(false, true, false, 'existing')
    expect(specs.map(step => step.anchor)).toEqual(['[data-costing-tour="sample"]', '[data-costing-tour="versions"]', '[data-costing-tour="economics"]', '[data-costing-tour="reuse"]', '[data-costing-tour="export-modes"]', '[data-costing-tour="production"]', '[data-tour-anchor="costings.first-card"]'])
    expect(specs.slice(1, -1).every(step => step.context === '[data-costing-tour-dialog="true"]')).toBe(true)
    expect(specs.slice(0, -1).every(step => step.kind === 'sample')).toBe(true)
    expect(specs.at(-1)).toMatchObject({ kind: 'handoff', context: undefined })
    expect(page).toContain('space-y-3 xl:pr-[192px]')
    expect(page).toContain('{!tourStep && <DialogFooter>')
    expect(read('components/estimator/CostingExportDialog.tsx')).toContain('{!tutorialPreview && <Button type="button" variant="ghost"')
    expect(savedCostingTourSpecs(true).map(step => step.anchor)).toEqual(['[data-costing-tour="free-sample"]', '[data-tour-anchor="free-costings.sample-export"]', '[data-costing-tour="export-modes"]', '[data-tour-anchor="free-costings.new"]'])
    expect(savedCostingTourSpecs(false, false, true).at(-1)).toMatchObject({ id: 'compareHandoff', kind: 'handoff', anchor: '[data-tour-anchor="costings.compare"]' })
  })
  it('derives reversible sample surfaces from the step alone', () => {
    expect(['versions', 'economics', 'internal', 'production', 'finish', null].map(step => costingTourSurface(step as Parameters<typeof costingTourSurface>[0]))).toEqual(['library', 'library', 'export', 'library', 'page', 'page'])
    expect(comparisonCostingSteps.map(costingTourSurface)).toEqual(['library', 'comparison', 'comparison', 'page'])
    expect(page).toContain('const tourSampleActive = tourStep !== null && !isSavedCostingHandoff(tourStep)')
    expect(page).toContain("tourSampleActive ? '1 sample quality'")
    expect(page).toContain('selectedRecordIdByGroup={{}} onSelectRecord={() => {}}')
    expect(page).toContain('selectedRecordIdByGroup={selectedRecordIdByGroup} onSelectRecord={selectRecord}')
    expect(page).toContain('onOpen={() => {}} onStartFrom={() => {}} onSaveAsNewQuality={() => {}} onExport={() => {}}')
  })
  it('uses two isolated comparable versions and pins copy to their actual calculations', () => {
    const rows = makeSavedCostingTourExamples()
    expect(new Set(rows.map(row => row.costing_group_id)).size).toBe(1)
    expect(rows.every(row => row.id.startsWith('tour-preview-'))).toBe(true)
    const ordered = orderSavedCostingsForComparison(rows)
    expect(ordered.map(row => row.version_number)).toEqual([1, 2])
    const result = compareSavedCostingSnapshots(ordered[0], ordered[1])
    expect(result.comparable).toBe(true)
    expect(result.price.sellingPricePerM.delta).toBeGreaterThan(0)
    for (const [key, value] of Object.entries({ cost: rows[0].result.productionCostPerM, price: rows[0].result.suggestedSellingPricePerM, profit: rows[0].result.profitPerM, costChange: rows[0].result.productionCostPerM - rows[1].result.productionCostPerM })) {
      expect(values[key as keyof typeof values]).toBe(value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    }
    const economics = savedCostingStepCopy('en', 'economics', baseOptions).body
    for (const key of ['cost', 'price', 'profit'] as const) expect(economics).toContain(`₹${values[key]}`)
    expect(savedCostingStepCopy('en', 'comparison', baseOptions).body).toContain(`₹${values.costChange}`)
  })
  it.each(['en', 'gu', 'hi'] as const)('transcribes approved copy exactly and resolves all tokens in %s', language => {
    const copy = savedCostingsTutorialCopy[language]
    expect(Object.keys(copy).sort()).toEqual(Object.keys(savedCostingsTutorialCopy.en).sort())
    const approved = read('docs/guided-tours/pages/saved-costings.md').split('### F.1')[1].split('### F.2')[0].split('\n').filter(line => line.startsWith('| `')).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
    const index = ['en', 'gu', 'hi'].indexOf(language) + 1
    const nativeControls = Object.fromEntries(tokenTable.map(row => [row[0].replaceAll('`', ''), language === 'en' ? controls[row[0].replaceAll('`', '') as keyof typeof controls] : row[language === 'gu' ? 3 : 4]]))
    for (const [key, text] of Object.entries(copy)) {
      expect(text).toBe(approved.find(row => row[0] === `\`${key}\``)?.[index])
      const resolved = formatTourText(text.replace(/\{c:[^}]+\}/g, token => `“${token}”`), nativeControls, values)
      expect(resolved).not.toMatch(/\{[^}]+\}/)
      if (language !== 'en') expect(text).toMatch(language === 'gu' ? /[\u0A80-\u0AFF]/ : /[\u0900-\u097F]/)
      if (language === 'en' && key.endsWith('.title')) expect(resolved.length).toBeLessThanOrEqual(48)
      if (language === 'en' && key.endsWith('.body')) expect(resolved.length).toBeLessThanOrEqual(190)
    }
    const local = locales[language]
    expect(local.tourControls.savedCostings.archived).toBe(nativeControls.archived)
    expect(Object.keys(local.tourControls.savedCostings)).toEqual(Object.keys(en.tourControls.savedCostings))
  })
  it('uses the same resolver as each live control, including the two approved scoped keys', () => {
    expect(page).not.toContain("tourControls.savedCostings.use")
    expect(page).toContain("t('tourControls.savedCostings.archived')")
    for (const key of ['viewBreakdown', 'internalEstimate', 'customerQuotation', 'activateForProduction', 'export'] as const) {
      const label = en.tourControls.savedCostings[key]
      expect(page + read('components/estimator/CostingExportDialog.tsx') + freePage).toContain(`tx('${label}')`)
    }
    expect(page).toContain("t('common.new_costing')")
    expect(page).toContain("t('common.compare_costings')")
    expect(controls.newCosting).toBe(en.common.new_costing)
  })
  it('chooses existing, empty and unavailable endings and matching live anchors', () => {
    expect([savedCostingTourEnding(4), savedCostingTourEnding(0), savedCostingTourEnding(0, true), savedCostingTourEnding(4, true)]).toEqual(['existing', 'empty', 'unavailable', 'unavailable'])
    for (const free of [true, false]) for (const ending of ['existing', 'empty', 'unavailable'] as const) {
      const copy = savedCostingStepCopy('en', 'finish', { ...baseOptions, free, ending })
      expect(copy.unavailable).toBe(copy.body)
      expect(copy.body).not.toContain('Finish restores')
      expect(savedCostingTourSpecs(free, false, false, ending).at(-1)?.anchor).toContain(ending === 'existing' ? 'first-card' : '.new')
    }
    expect(savedCostingStepCopy('en', 'finish', { ...baseOptions, ending: 'unavailable' }).title).toBe("Your list didn't load")
  })
  it('guards persistent demo draft actions while retaining demo existence and Export', () => {
    const demo = page.split(') : isDemoCostingActive && quotes.length === 0 ? (')[1].split('\n            ) : (')[0]
    for (const handler of ['onOpen', 'onStartFrom', 'onSaveAsNewQuality']) {
      expect(demo).toContain(`${handler}={quote => { if (isSampleRecordId(quote.id)) toast.info(tx('This is a sample costing for exploration.')) }}`)
    }
    expect(demo).not.toContain('handleRestore(')
    expect(demo).toContain('void openQuoteExport(quote)')
    expect(page).toContain('showCostingDeleteNudge && !tourStep && !demoCostingDeleted && quotes.length === 0 && initialTemplates.length === 0')
  })
  it('shadows Free filters and passes account identity while suppressing the Guide when embedded', () => {
    expect(freePage).toContain('if (tourSampleActive) return true')
    expect(freePage).toContain('!tourSampleActive && filteredRows.map')
    expect(freePage).toContain('{!embedded && <SavedCostingsTutorial free')
    expect(freePage).toContain('free userId={userId} orgId={orgId} userMetadata={userMetadata}')
    expect(read('app/free/costings/page.tsx')).toContain('userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }}')
    expect(read('app/free/costings/page.tsx')).toContain('await freeContext({ allowInactive: true })')
    const quotesPage = read('app/(dashboard)/owner/quotes/page.tsx')
    expect(quotesPage).toContain("previousFreeGrant && (planAccess.effectiveTier === 'lite'")
    expect(quotesPage).toContain('<LitePriorFreeHistory><SavedFreeCostings embedded idPrefix="lite-prior-" /></LitePriorFreeHistory>')
    expect(quotesPage).toContain(': <SavedFreeCostings embedded />')
    // A Lite trial carries a dormant Free grant; only saved Free costings earn the history block.
    expect(quotesPage).toContain('const previousFreeGrant = freeGrant && await hasSavedFreeCostings(profile.org_id, freeGrant.subjectId)')
    // Embedded history never shows the Free demo; the Lite page has its own tour sample.
    expect(freePage).toContain('const showDemoCard = (!embedded && !demoDeleted && rows.length === 0) || tourSampleActive')
  })
  it('loads runtime and copy only after launch and never completes the core via Compare', () => {
    expect(tutorial).toContain("dynamic(() => import('./SavedCostingsTourRuntime'), { ssr: false })")
    expect(tutorial).toContain('{step && <SavedCostingsTourRuntime')
    expect(tutorial).not.toContain("from '@/lib/i18n/saved-costings-tutorial'")
    expect(tutorial).not.toMatch(/createPortal|addEventListener|requestAnimationFrame|setTimeout/)
    // Compare versions is a Guide action on paid plans only.
    expect(tutorial).toContain('...(free ? [] : [compare])')
    expect(tutorial).toContain('copy.fields.organize')
    expect(tutorial).toContain('copy.fields.share')
    expect(runtime).toContain('recordCompletion={!comparison}')
    expect(runtime).toContain('onDone={comparison ? undefined : onComplete}')
    expect(runtime).toContain('<GuidedTour')
    expect(runtime).toContain('userId={userId}')
    expect(page).toContain('isDemoCostingActive ? makeSavedCostingTourExamples() : []')
    expect(page).toContain("tourSurface === 'export' ? makeSavedCostingTourExport() : null")
  })
})
