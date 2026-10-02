import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { detectArrivals } from '../lib/arrivals'
import { LiveValue } from '../components/ui/live-value'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const globals = read('app/globals.css')

describe('new-row arrivals', () => {
    it('reports only ids it has never seen, in list order', () => {
        expect(detectArrivals(new Set(['a', 'b']), ['a', 'c', 'b', 'd'])).toEqual(['c', 'd'])
    })

    it('treats a filtered-out row coming back as already seen', () => {
        const seen = new Set(['a', 'b', 'c'])
        expect(detectArrivals(seen, ['a'])).toEqual([])
        expect(detectArrivals(seen, ['a', 'b', 'c'])).toEqual([])
    })

    it('reports a duplicate id once', () => {
        expect(detectArrivals(new Set<string>(), ['x', 'x'])).toEqual(['x'])
    })

    it('tints the card inside a freshly added list item, then lets go', () => {
        expect(globals).toMatch(/\.ui-row-arrive > \*\s*\{\s*animation: ui-row-arrive/)
        expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ui-row-arrive > \*/)
        const hook = read('hooks/use-arrivals.ts')
        expect(hook).toContain('detectArrivals')
        expect(hook).toContain('setTimeout')
    })

    it('highlights workers and machines added after the page opened', () => {
        const workers = read('app/(dashboard)/owner/production/registers/WorkersRegister.tsx')
        expect(workers).toContain('useArrivals(workers.map(worker => worker.id))')
        expect(workers.match(/arrivedIds=\{arrivedIds\}/g)?.length).toBe(2)
        expect(read('components/workers/WorkforceGroup.tsx')).toContain("arrivedIds?.has(worker.id) ? 'ui-row-arrive' : undefined")

        const machines = read('app/(dashboard)/owner/production/registers/MachinesRegister.tsx')
        expect(machines).toContain('useArrivals(machines.map(machine => machine.id))')
        expect(machines).toContain('<MachineGrid machines={visible} arrivedIds={arrivedIds}')
        expect(read('components/machines/MachineGrid.tsx')).toContain("arrivedIds?.has(machine.id) && 'ui-row-arrive'")
    })
})

describe('live cost figures', () => {
    it('renders the formatted value with tabular digits', () => {
        const html = renderToStaticMarkup(createElement(LiveValue, { value: '₹42.50' }))
        expect(html).toContain('data-slot="live-value"')
        expect(html).toContain('₹42.50')
        expect(html).toContain('tabular-nums')
    })

    it('settles quietly, throttled while typing and off with reduced motion', () => {
        const source = read('components/ui/live-value.tsx')
        expect(source).toContain('prefers-reduced-motion: reduce')
        expect(source).toMatch(/duration: 200/)
        expect(source).toContain('SETTLE_INTERVAL_MS')
    })

    it('settles the headline figures in the estimator HUD and the live-cost sheet', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
        expect(estimator).toContain("import { LiveValue } from '@/components/ui/live-value'")
        expect(estimator.match(/<LiveValue value=/g)?.length).toBeGreaterThanOrEqual(10)
    })
})

describe('save confirmation', () => {
    const cards = [
        'components/settings/plan-aware/factory-details-card.tsx',
        'components/settings/plan-aware/personal-information-card.tsx',
        'components/settings/plan-aware/costing-defaults-card.tsx',
    ]

    it.each(cards)('%s shows a short Saved state on its button after a successful save', path => {
        const source = read(path)
        expect(source).toContain('useSavedFlash()')
        expect(source).toContain('flashSaved()')
        expect(source).toContain("t('base_plan.status.saved')")
        expect(source).toContain('ui-success-pop')
    })

    it('reuses the translated Saved label in every language', () => {
        expect(read('lib/i18n/locales/en.ts')).toContain('saved: "Saved"')
        expect(read('lib/i18n/locales/hi.ts')).toMatch(/status: \{[\s\S]{0,80}saved: "/)
        expect(read('lib/i18n/locales/gu.ts')).toContain('saved: "સેવ થઈ ગયું"')
    })
})

describe('alerts and swapped views', () => {
    it('fades inline alerts in as they appear, not toasts', () => {
        expect(globals).toMatch(/@starting-style\s*\{\s*\[role="alert"\]:not\(\[data-sonner-toast\]\)\s*\{\s*opacity: 0;/)
        expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\[role="alert"\]:not\(\[data-sonner-toast\]\)/)
    })

    it.each([
        ['app/(dashboard)/owner/dispatches/ChallansClient.tsx', `<div key={history ? 'history' : 'active'} className="ui-content-swap`],
        ['app/(dashboard)/owner/production/BasePayrollRecords.tsx', `{recordsView === 'workers' && <div className="ui-content-swap`],
        ['app/(dashboard)/owner/production/BasePayrollRecords.tsx', `{recordsView === 'machines' && <div className="ui-content-swap`],
        ['app/(dashboard)/owner/production/BaseMachineBoard.tsx', '<div key={filterStatus} className="ui-content-swap'],
    ])('%s settles the panel its segmented control swaps', (path, marker) => {
        expect(read(path)).toContain(marker)
    })
})
