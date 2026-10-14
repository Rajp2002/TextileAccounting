import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { productionTourSpecs } from '@/lib/production-tour'
import { dailySheetTourSpecs } from '@/lib/daily-sheet-tour'
import { payrollHelpSpecs, payrollTourSpecs } from '@/lib/payroll-tour'
import { dispatchTourSpecs } from '@/lib/dispatch-tour'
import { fabricStockTourSpecs } from '@/lib/stock-tour'
import { rateBookTourSpecs } from '@/lib/rate-book-tour'

/**
 * RULE: a guided tour teaches the REAL page. The point of a tour is to let the user understand the page they will
 * use, so showing a different UI (a hand-built wireframe with disabled inputs and unstyled text) defeats it.
 *
 * When an account has nothing to show yet, the tour renders the same page component with sample data, and the real
 * components open their own dialogs and sheets from the tour context (lib/tours/sample-context.tsx). This file fails
 * if a tour goes back to a lookalike, and if a step points at an element that no longer exists on the real page.
 */

const read = (file: string) => readFileSync(file, 'utf8')
function walk(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) walk(full, found)
        else if (full.endsWith('.tsx')) found.push(full)
    }
    return found
}

const SAMPLE_TOURS = [
    { name: 'Production', wrapper: 'components/production/ProductionGuidedTour.tsx', workspace: 'components/production/ProductionSampleWorkspace.tsx', client: "@/app/(dashboard)/owner/production/BaseProductionClient" },
    { name: 'Daily Sheet', wrapper: 'components/production/DailySheetGuidedTour.tsx', workspace: 'components/production/DailySheetSampleWorkspace.tsx', client: "@/app/(dashboard)/owner/production/BaseProductionClient" },
    { name: 'Payroll', wrapper: 'components/payroll/PayrollGuidedTour.tsx', workspace: 'components/payroll/PayrollSampleWorkspace.tsx', client: "@/app/(dashboard)/owner/production/BaseProductionClient" },
    { name: 'Dispatch', wrapper: 'components/dispatches/DispatchGuidedTour.tsx', workspace: 'components/dispatches/DispatchSampleWorkspace.tsx', client: "@/app/(dashboard)/owner/dispatches/ChallansClient" },
    { name: 'Stock', wrapper: 'components/stock/StockGuidedTour.tsx', workspace: 'components/stock/StockSampleWorkspace.tsx', client: "@/app/(dashboard)/owner/stock/QualityStockClient" },
] as const

describe('Guided tours teach the real page, never a lookalike', () => {
    it.each(SAMPLE_TOURS.map(tour => [tour.name, tour] as const))('%s renders the real page component with sample data', (_name, tour) => {
        expect(read(tour.wrapper)).toContain(`import('./${path.basename(tour.workspace, '.tsx')}')`)
        const workspace = read(tour.workspace)
        expect(workspace).toContain(`from '${tour.client}'`)
        expect(workspace).toMatch(/from '@\/lib\/tours\/sample-data\//)
        // The workspace only chooses data; it is not a page of its own.
        expect(workspace.split('\n').length).toBeLessThan(40)
        expect(workspace).not.toMatch(/disabled readOnly|<Input|<Button|<Dialog/)
    })

    it('has no hand-built tour preview components left', () => {
        const previews = [...walk('components'), ...walk('app')].filter(file => /TourPreview\.tsx$/.test(file))
        expect(previews).toEqual([])
    })

    it('tells a real page it is a sample through one context, and every sample page shows the sample banner', () => {
        const shell = read('components/tours/ReplicaGuidedTour.tsx')
        expect(shell).toContain('<TourSampleProvider tourId={tourId} step={step}>{renderReplica(step)}</TourSampleProvider>')
        expect(read('app/(dashboard)/owner/production/BaseProductionClient.tsx')).toContain('<TourSampleBanner />')
    })

    describe('every step points at an element that exists on the real page', () => {
        const sources = [...walk('app'), ...walk('components')].filter(file => !file.includes('/tours/')).map(file => read(file))
        // Attributes set from a variable rather than a literal: the literal values the tour selects are proven here instead.
        const DYNAMIC: { attribute: string; values: string[]; source: string }[] = [
            { attribute: 'data-daily-tour', values: ['reading', 'pending'], source: "tourTarget={index === 0 ? 'reading' : context.machineId === firstPendingMachineId ? 'pending' : undefined}" },
            { attribute: 'data-dispatch-tour', values: ['confirm', 'receipt', 'payment'], source: 'data-dispatch-tour={operation ?? undefined}' },
            { attribute: 'data-stock-tour', values: ['opening', 'receipt', 'correction'], source: "data-stock-tour={entry?.kind === 'recipe' ? 'link' : entry?.kind}" },
            { attribute: 'data-tour-anchor', values: ['dispatch.new'], source: '<NewDispatchButton tourAnchor="dispatch.new"' },
        ]
        const exists = (attribute: string, value: string) => {
            if (DYNAMIC.some(entry => entry.attribute === attribute && entry.values.includes(value) && sources.some(source => source.includes(entry.source)))) return true
            const literal = new RegExp(`${attribute}="${value.replace(/\./g, '\\.')}"|${attribute}=\\{[^}]*['"]${value.replace(/\./g, '\\.')}['"]`)
            return sources.some(source => literal.test(source))
        }
        const tours: Record<string, readonly { id: string; anchor: string }[]> = {
            Production: productionTourSpecs, 'Daily Sheet (with data)': dailySheetTourSpecs(false), 'Daily Sheet (empty)': dailySheetTourSpecs(true),
            'Payroll core': payrollTourSpecs, 'Payroll help': payrollHelpSpecs, Dispatch: dispatchTourSpecs,
            'Fabric Stock': fabricStockTourSpecs,
            'Rate Book (with rates)': rateBookTourSpecs(false, true), 'Rate Book (empty)': rateBookTourSpecs(true, false),
        }
        for (const [name, specs] of Object.entries(tours)) {
            it(`${name}`, () => {
                for (const spec of specs) {
                    const match = spec.anchor.match(/^\[(data-[\w-]+)="([^"]+)"\]$/)
                    expect(match, `${spec.id}: unexpected anchor ${spec.anchor}`).not.toBeNull()
                    const [, attribute, value] = match!
                    expect(exists(attribute, value), `${spec.id}: nothing on the real page carries ${attribute}="${value}"`).toBe(true)
                }
            })
        }
    })
})
