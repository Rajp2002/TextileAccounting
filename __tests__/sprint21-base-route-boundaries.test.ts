import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (file: string) => readFileSync(file, 'utf8')

describe('Sprint 21 Base route boundaries', () => {
    it('does not mount the persistent query provider in the root or Base primary shell', () => {
        expect(read('components/providers.tsx')).not.toContain('@tanstack/react-query')
        expect(read('components/providers.tsx')).not.toContain('PersistQueryClientProvider')
        expect(read('app/(dashboard)/owner/layout.tsx')).not.toContain('QueryProvider')
        for (const route of ['estimator', 'rates', 'quotes']) {
            expect(read(`app/(dashboard)/owner/${route}/layout.tsx`)).not.toContain('QueryProvider')
        }
        expect(read('app/(dashboard)/owner/settings/layout.tsx')).toContain('<QueryProvider>')
    })

    it('keeps interaction-only estimator and costing-detail code out of the first graph', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
        const quoteActions = read('app/(dashboard)/owner/estimator/actions.ts')
        const quotePage = read('app/(dashboard)/owner/quotes/page.tsx')

        expect(estimator).toContain("dynamic(() => import('./FactoryCostWizard')")
        expect(estimator).not.toContain("import FactoryCostWizard from './FactoryCostWizard'")
        expect(quotePage).toContain('getEstimatorTemplates({ includeArchived: true, summary: true })')
        expect(quoteActions).toContain('export async function getEstimatorQuoteDetail(id: string)')

        const listLoader = quoteActions.slice(
            quoteActions.indexOf('export async function getEstimatorQuotes'),
            quoteActions.indexOf('/** Full immutable costing/detail read'),
        )
        expect(listLoader).not.toContain('warp_rows')
        expect(listLoader).not.toContain('production_logs')
    })

    it('keeps Rate Book GET read-only and exposes a separate reconciliation intent', () => {
        const actions = read('app/(dashboard)/owner/rates/actions.ts')
        const getRates = actions.slice(
            actions.indexOf('export async function getCostRates'),
            actions.indexOf('/**\n * Secondary usage/conflict read'),
        )

        expect(getRates).not.toContain('discover_yarn_rate_atomic')
        expect(getRates).not.toContain('insert(')
        expect(actions).toContain('export async function reconcileLegacyYarnRates()')
        expect(actions).toContain('export async function getCostRateUsage()')
    })

    it('keeps route milestone and bundle evidence contracts stable', () => {
        const milestones = read('components/performance/route-milestones.tsx')
        const bundleReport = read('scripts/performance/sprint21-bundle-report.mjs')

        expect(milestones).toContain('data-route-primary-usable')
        expect(milestones).toContain("mark('route_primary_usable')")
        expect(bundleReport).toContain('page_client-reference-manifest.js')
        expect(bundleReport).toContain('gzipSync')
    })
})
