import { describe, expect, it, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import ts from 'typescript'
import { rateBookTourSpecs, RATE_BOOK_TOUR_STEPS } from '../lib/rate-book-tour'
import { isSampleRecordId } from '../lib/tours/sample-ids'
import { tourCommonCopy } from '../lib/i18n/tour-common'
import { filterCostRates } from '../lib/cost-rates'
import { getTourPresentation } from '../lib/tours/tour-preferences'
import { tourRegistry } from '../lib/tours/tour-registry'
import { MOBILE_WORKSPACE_QUERY } from '../lib/mobile-workflow-navigation'

vi.mock('@/app/actions/tour-preferences', () => ({ recordTourEventAction: vi.fn() }))

const read = (path: string) => readFileSync(path, 'utf8')
const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')
const wrapper = read('components/rates/RateBookTutorial.tsx')
const runtime = read('components/rates/RateBookTourRuntime.tsx')
const page = read('app/(dashboard)/owner/rates/page.tsx')

// Execute the actual handler/filter expressions without mounting the business page.
const source = ts.createSourceFile('RatesClient.tsx', rates, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function initializer(name: string) {
    let value = ''
    const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) value = node.initializer!.getText(source)
        ts.forEachChild(node, visit)
    }
    visit(source)
    if (!value) throw new Error(`Missing ${name}`)
    return value
}
function evaluate(name: string, scope: Record<string, unknown>) {
    const code = ts.transpileModule(`const value = ${initializer(name)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    return new Function(...Object.keys(scope), `${code}; return value`)(...Object.values(scope))
}

describe('Rate Book shared-runtime integration', () => {
    it('never points two steps at the same element, so each step highlights its own section', () => {
        for (const sample of [false, true]) for (const populated of [false, true]) {
            const anchors = rateBookTourSpecs(sample, populated).map(step => step.anchor)
            expect(new Set(anchors).size, `duplicate anchor (sample=${sample}, populated=${populated}): ${anchors.join(' ')}`).toBe(anchors.length)
        }
    })

    it('keeps six ordered steps, row targets, sample variants and real handoffs', () => {
        expect(RATE_BOOK_TOUR_STEPS).toEqual(['rb-purpose', 'rb-find', 'rb-update', 'rb-review', 'rb-usage', 'rb-handoff'])
        for (const sample of [false, true]) for (const populated of [false, true]) {
            const specs = rateBookTourSpecs(sample, populated)
            expect(specs.map(step => step.id)).toEqual(RATE_BOOK_TOUR_STEPS)
            expect(specs.map(step => step.anchor)).toEqual(['overview', 'yarnSearch', 'quickEditAction', 'reviewStatusBadge', 'linkedQualitiesPopover', populated ? 'rateAndTrend' : 'addRateAction'].map(field => `[data-ratebook-field="${field}"]`))
            expect(specs.slice(2, 5).map(step => step.kind)).toEqual(Array(3).fill(sample ? 'sample' : 'live'))
            expect(specs.at(-1)?.kind).toBe('handoff')
            for (const step of specs) expect(rates).toContain(step.anchor.slice(1, -1))
        }
        expect(rates.match(/data-ratebook-field="addRateAction"/g)).toHaveLength(1)
        expect(rates).toContain('data-ratebook-field="yarnSearch" tabIndex={-1}')
        // The populated handoff lands focus on the first card's price; one card serves every width.
        expect(rates.match(/data-ratebook-field="rateAndTrend" tabIndex=\{-1\}/g)).toHaveLength(1)
        expect(rates).toContain('sampleRow={isSampleRecordId(visibleRates[0]?.id)}')
        expect(rates).toContain('hasRealRates={activeYarnRates.some(rate => !isSampleRecordId(rate.id))}')
    })

    it('mounts one invitation, lazy-loads all step code, and keeps shared focus/persistence', () => {
        expect(wrapper.match(/<TourInvitation\b/g)).toHaveLength(1)
        expect(rates.match(/<RateBookTutorial\b/g)).toHaveLength(1)
        expect(rates).not.toContain('RateBookTutorialLauncher')
        expect(wrapper).toContain("dynamic(() => import('./RateBookTourRuntime'), { ssr: false })")
        expect(wrapper).toContain('{step && <RateBookTourRuntime')
        expect(wrapper).not.toContain("from '@/lib/i18n/rate-book-tutorial'")
        expect(rates).not.toContain("from '@/lib/i18n/rate-book-tutorial'")
        expect(runtime).toContain('<GuidedTour tourId="rate-book"')
        expect(runtime).toContain('returnFocus={returnFocus} userId={userId}')
        expect(wrapper).toContain('userMetadata={userMetadata}')
        expect(page).toContain('userMetadata={user.user_metadata}')
        expect(page).toContain('userId={user.id}')
        expect(page).toContain('orgId={profile.org_id}')
        expect(getTourPresentation('rate-book', { ratebook_tutorial_dismissed: true })).toBe('replay')
        expect(tourRegistry['rate-book'].contentVersion).toBe('v2')
        expect(existsSync('app/(dashboard)/owner/rates/tutorial-actions.ts')).toBe(false)
        for (const text of [wrapper, runtime, rates]) expect(text).not.toMatch(/dismissRatebookTutorial|accountDismissed|requestTrigger|isTutorialActive|isSheetStep|isPopoverStep/)
        expect(wrapper).not.toMatch(/setTimeout|setInterval|localStorage|createPortal/)
    })

    it('keeps the sample deletion nudge tied to Done, never Exit', () => {
        expect(wrapper).toContain('onDone={onTourFinish}')
        expect(runtime).toContain('onStepChange={onStepChange} onDone={onDone}')
        expect(wrapper).not.toContain('onTourFinish?.()')
        expect(rates).toContain('if (!demoYarnDeleted && rates.some(r => r.id === DEMO_YARN_RATE.id))')
        expect(rates).toContain('setShowDeleteNudge(true)')
        expect(rates).toContain("tx('Delete sample yarn')")
        expect(rates).toContain('return [DEMO_YARN_RATE]')
        expect(rates).toContain('tourCommonCopy[language].sampleBanner')
    })

    it('renders the Rate Book guide in the page header, inside the tutorial root, with no rail', () => {
        const css = read('app/globals.css')
        expect(css).not.toContain('rates-left-rail-desktop')
        expect(rates).not.toContain('rates-left-rail-desktop')
        const root = rates.indexOf('data-ratebook-tutorial-root')
        expect(rates.indexOf('<RateBookTutorial')).toBeGreaterThan(root)
        expect(rates.indexOf('<RateBookTutorial')).toBeGreaterThan(rates.indexOf('<PageHeader'))
    })
})

describe('Rate Book render-only filter shadowing', () => {
    const active = [{ id: 'real-active', name: 'Cotton', category: 'yarn_warp', is_active: true, is_reviewed: true, last_reviewed_at: '2099-01-01', review_interval_days: 90 }]
    const archived = [{ ...active[0], id: 'real-archived', is_active: false }]
    it.each([null, 'rb-purpose', 'rb-update', 'rb-review', 'rb-usage', 'rb-handoff'] as const)('derives rows without writing filter state at %s', tourStep => {
        const filterState = Object.freeze({ searchQuery: 'no-matching-yarn', categoryFilter: 'yarn_weft', statusFilter: 'needs_review', showArchived: true })
        const scope = { ...filterState, tourStep, activeYarnRates: active, archivedYarnRates: archived }
        const targetYarnRates = evaluate('targetYarnRates', scope)
        const result = evaluate('filteredRates', { ...scope, targetYarnRates, filterCostRates, useMemo: (fn: () => unknown) => fn() })
        expect(result).toEqual(tourStep ? active : [])
        expect(targetYarnRates).toEqual(tourStep ? active : archived)
        expect(filterState).toEqual({ searchQuery: 'no-matching-yarn', categoryFilter: 'yarn_weft', statusFilter: 'needs_review', showArchived: true })
        expect(initializer('filteredRates')).not.toMatch(/set\w+\(/)
    })
    it('keeps the page keyboard actions inert during a tour without resetting state', () => {
        expect(rates).toContain('if (tourStep !== null || event.ctrlKey')
        expect(rates).toContain('value={searchQuery}')
        expect(wrapper).not.toMatch(/setSearch|setCategory|setStatus|setDraft|setRates|router/)
    })
})

describe('Sample rate guards run before any business action or UI mutation', () => {
    it.each(['handleSave', 'openHistory', 'handleArchive'])('%s blocks demo and tour ids and retains the real action path', async name => {
        for (const id of ['demo-sample-yarn-rate', 'tour-rate', 'real-rate']) {
            const rate = { id, is_active: true, updated_at: '2026-09-01' }
            const business = vi.fn(() => new Promise(() => {}))
            const mutate = vi.fn()
            const pending = vi.fn()
            const beginLiteMutation = vi.fn(() => true)
            const toast = { info: vi.fn() }
            const scope = { draft: rate, archiveRate: rate, isSampleRecordId, toast, tourCommonCopy, language: 'gu',
                setPendingAction: pending, setArchiveError: mutate, beginLiteMutation, setHistoryRate: mutate, setHistoryMode: mutate, setHistoryRows: mutate,
                setHistoryError: mutate, setHistoryLoading: mutate, historyRequest: { current: 0 },
                startTransition: (fn: () => void) => fn(), saveCostRate: business, getCostRateHistory: business, archiveCostRate: business,
            }
            const handler = evaluate(name, scope)
            const result = handler(rate)
            if (isSampleRecordId(id)) {
                await result
                expect(toast.info).toHaveBeenCalledExactlyOnceWith(tourCommonCopy.gu.sampleBanner)
                expect(business).not.toHaveBeenCalled()
                expect(mutate).not.toHaveBeenCalled()
                expect(pending).not.toHaveBeenCalled()
                expect(beginLiteMutation).not.toHaveBeenCalled()
            } else {
                expect(toast.info).not.toHaveBeenCalled()
                expect(business).toHaveBeenCalledTimes(1)
                if (name === 'openHistory') {
                    expect(mutate).toHaveBeenCalled()
                    expect(beginLiteMutation).not.toHaveBeenCalled()
                } else {
                    expect(beginLiteMutation).toHaveBeenCalledTimes(1)
                    expect(pending).toHaveBeenCalledTimes(1)
                    expect(beginLiteMutation.mock.invocationCallOrder[0]).toBeLessThan(pending.mock.invocationCallOrder[0])
                    expect(pending.mock.invocationCallOrder[0]).toBeLessThan(business.mock.invocationCallOrder[0])
                }
            }
        }
    })
})


describe('Lite mobile single flight preserves sample guards and retry identity', () => {
    it.each([[true, true], [true, false], [false, true], [false, false]])('locks only Lite=%s mobile=%s before pending state', (isLite, mobile) => {
        const liteMutationInFlight = { current: false }
        const matchMedia = vi.fn(() => ({ matches: mobile }))
        const begin = evaluate('beginLiteMutation', { isLite, window: { matchMedia }, MOBILE_WORKSPACE_QUERY, liteMutationInFlight })
        expect(begin()).toBe(true)
        expect(begin()).toBe(!(isLite && mobile))
        expect(liteMutationInFlight.current).toBe(isLite && mobile)
        if (isLite) expect(matchMedia).toHaveBeenCalledWith(MOBILE_WORKSPACE_QUERY)
        else expect(matchMedia).not.toHaveBeenCalled()
    })

    it.each(['handleSave', 'handleArchive'])('%s releases a failed single flight and retries the unchanged proposal', async name => {
        const target = Object.freeze({ id: 'real-rate', is_active: true, updated_at: '2026-09-01', expectedUpdatedAt: '2026-09-01' })
        const liteMutationInFlight = { current: false }
        const beginLiteMutation = evaluate('beginLiteMutation', { isLite: true, window: { matchMedia: () => ({ matches: true }) }, MOBILE_WORKSPACE_QUERY, liteMutationInFlight })
        const business = vi.fn(async () => ({ error: 'Synthetic rejected proposal' }))
        const pending = vi.fn()
        const transitions: Promise<void>[] = []
        const handler = evaluate(name, {
            draft: target, archiveRate: target, isSampleRecordId, beginLiteMutation, liteMutationInFlight,
            toast: { info: vi.fn(), error: vi.fn() }, tourCommonCopy, language: 'en', tx: (text: string) => text,
            userFacingError: (error: string) => error, setPendingAction: pending, setArchiveError: vi.fn(), setSaveError: vi.fn(),
            startTransition: (fn: () => Promise<void>) => transitions.push(fn()), saveCostRate: business, archiveCostRate: business,
        })
        handler()
        handler()
        expect(business).toHaveBeenCalledTimes(1)
        await Promise.all(transitions)
        expect(liteMutationInFlight.current).toBe(false)
        expect(pending).toHaveBeenLastCalledWith(null)
        handler()
        await Promise.all(transitions)
        expect(business).toHaveBeenCalledTimes(2)
        expect(business.mock.calls[0]).toEqual(business.mock.calls[1])
        if (name === 'handleSave') expect(business).toHaveBeenCalledWith(target)
        else expect(business).toHaveBeenCalledWith(target.id, target.updated_at)
        expect(liteMutationInFlight.current).toBe(false)
    })
})
