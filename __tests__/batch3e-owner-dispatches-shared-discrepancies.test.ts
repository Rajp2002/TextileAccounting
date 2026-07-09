/**
 * Batch 3E — /owner/dispatches shared discrepancy read
 *
 * Active/archive classification and the overview must use one authorized,
 * missing-table-safe discrepancy snapshot on the initial server render.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Batch 3E — owner dispatches shared initial discrepancy read', () => {
    const page = read('app/(dashboard)/owner/dispatches/page.tsx')
    const loader = read('app/(dashboard)/owner/dispatches/loaders.ts')
    const actions = read('app/(dashboard)/owner/orders/actions.ts')

    it('keeps owner authorization and the four-read initial payload on the server', () => {
        expect(page).toContain("requireRole(['owner'])")
        expect(page).toContain("createPerfTimer('/owner/dispatches')")
        expect(page).toContain('loadOwnerDispatchesInitialData()')
        expect(page).toContain("'businessData'")
        expect(page).toContain('4')
        expect(page).toContain('shares one open stock_discrepancies read')
    })

    it('starts one discrepancy query and shares its promise with both dependent read models', () => {
        expect(loader).toContain("import 'server-only'")
        expect(loader).toContain('const openDiscrepancies = getOpenStockDiscrepancies()')
        expect(loader).toContain('Promise.all([')
        expect(loader).toContain('getAllDispatches({ preloadedOpenDiscrepancies: openDiscrepancies })')
        expect(loader).toContain('getDispatchOverviewStats({ preloadedOpenDiscrepancies: openDiscrepancies })')
        expect(loader).toContain('getPendingStockSales()')
    })

    it('retains the guarded missing-table fallback and feeds the shared rows into archive classification and totals', () => {
        expect(actions).toContain('loadOpenStockDiscrepanciesForOrg')
        expect(actions).toContain('isMissingStockDiscrepanciesTable')
        expect(actions).toContain("error?.code === '42P01'")
        expect(actions).toContain("error?.code === 'PGRST205'")
        expect(actions).toContain('options.preloadedOpenDiscrepancies')
        expect(actions).toContain('openDiscrepancyDispatchIds = new Set(')
        expect(actions).toContain('open_discrepancy_meters: discrepancies.reduce')
    })
})
