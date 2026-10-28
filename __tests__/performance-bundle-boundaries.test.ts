import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
    return readFileSync(path, 'utf8')
}

/**
 * Every module and package an entry file reaches through static imports (the
 * code webpack must put in its first-load bundle). Dynamic import() and
 * type-only imports are skipped, as are 'use server' modules, which the client
 * reaches only as action references.
 */
function staticImportGraph(entry: string) {
    const root = process.cwd()
    const resolveLocal = (from: string, specifier: string) => {
        const base = specifier.startsWith('@/') ? join(root, specifier.slice(2)) : join(dirname(from), specifier)
        if (existsSync(base) && statSync(base).isFile()) return base
        return ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx'].map(ext => base + ext).find(existsSync)
    }
    const files = new Set<string>()
    const packages = new Set<string>()
    const queue = [join(root, entry)]
    while (queue.length) {
        const file = queue.pop()!
        if (files.has(file)) continue
        files.add(file)
        const text = readFileSync(file, 'utf8')
        if (file !== join(root, entry) && /^\s*['"]use server['"]/.test(text)) continue
        for (const [, specifier] of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
            if (specifier.startsWith('.') || specifier.startsWith('@/')) {
                const resolved = resolveLocal(file, specifier)
                if (resolved) queue.push(resolved)
            } else {
                packages.add(specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0])
            }
        }
    }
    return { files: [...files].map(file => relative(root, file)), packages }
}

describe('performance-sensitive bundle boundaries', () => {
    it('keeps non-English dictionaries out of the initial provider bundle', () => {
        const context = source('lib/i18n/context.tsx')

        expect(context).not.toContain('from "./locales/hi"')
        expect(context).not.toContain('from "./locales/gu"')
        expect(context).not.toContain('from "./legacy"')
        expect(context).not.toContain('from "./legacy-generated"')
        expect(context).toContain('import("./locales/hi")')
        expect(context).toContain('import("./locales/gu")')
        expect(context).toContain('import("./legacy")')
        expect(context).toContain('import("./legacy-generated")')
        expect(context).toContain('const activeLang = isMounted && resources[language] ? language : "en"')
    })

    it('loads the Hindi/Gujarati Base-plan phrases and runtime with the language, not on first load', () => {
        const context = source('lib/i18n/context.tsx')

        expect(context).not.toContain('from "./base-plan-phrases"')
        expect(context).not.toContain('from "./runtime"')
        expect(context).toContain('import("./base-plan-phrases")')
        expect(context).toContain('import("./runtime")')
        expect(context).toContain('import { isBasePlanSurfacePath } from "./base-plan-surface"')
    })

    it('keeps Node crypto, zod, and the Supabase browser SDK out of the estimator bundle', () => {
        const estimator = source('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
        const freeMeter = source('hooks/use-free-meter.tsx')
        const inputChanges = source('lib/costing-input-changes.ts')
        const freeCanonical = source('lib/free-estimator-canonical.ts')

        // costing-save-trust.ts imports Node crypto, which webpack polyfills (~100 KB gzip).
        expect(estimator).toContain("import { summarizeCostingInputChanges } from '@/lib/costing-input-changes'")
        expect(estimator).not.toContain("from '@/lib/costing-save-trust'")
        expect(inputChanges).not.toMatch(/from ['"](node:)?crypto['"]/)
        // free-estimator-input.ts carries the server-side zod schema.
        expect(freeMeter).toContain("import {canonicalFreeInputs} from '@/lib/free-estimator-canonical'")
        expect(freeMeter).not.toContain("from '@/lib/free-estimator-input'")
        expect(freeCanonical).not.toContain("from 'zod'")
        // Only Free needs the browser Supabase client, so it loads on demand.
        expect(freeMeter).not.toContain("import {createClient} from '@/lib/supabase/client'")
        expect(freeMeter).toContain("import('@/lib/supabase/client')")
        // ...and a failed chunk load retries instead of silently dropping the
        // cross-tab sign-out redirect.
        expect(freeMeter).toContain("window.addEventListener('focus',subscribe);window.addEventListener('online',subscribe)")
        expect(freeMeter).toContain('if(cancelled||loading||unsubscribe)return')
    })

    it('keeps zod, the document renderer and its embedded logo out of the estimator and Free first loads', () => {
        for (const entry of ['app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'app/free/FreeClient.tsx', 'app/free/costings/SavedFreeCostings.tsx', 'app/(dashboard)/owner/quotes/QuotesClient.tsx']) {
            const graph = staticImportGraph(entry)
            expect(graph.packages.has('zod'), `${entry} reaches zod`).toBe(false)
            expect(graph.files, entry).not.toContain('lib/estimator-export.ts')
            expect(graph.files, entry).not.toContain('lib/estimator-export-logo.ts')
            expect(graph.files, entry).not.toContain('lib/i18n/document-labels.ts')
        }
        const estimator = source('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
        // The Free draft helpers carry the Free input schema; Free mode loads them on mount.
        expect(estimator).not.toContain("from '@/lib/free-estimator-draft'")
        expect(estimator).toContain("import('@/lib/free-estimator-draft')")
        const model = source('lib/costing-export-model.ts')
        expect(model).not.toContain('estimator-export-logo')
        expect(model).not.toContain('document-labels')
    })

    it('loads Sentry Session Replay after the page is idle instead of in every first-load bundle', () => {
        const client = source('instrumentation-client.ts')

        expect(client).not.toContain('Sentry.replayIntegration(')
        expect(client).toContain("import('@sentry/replay')")
        expect(client).toContain('Sentry.addIntegration(replayIntegration(')
        expect(client).toContain('replaysOnErrorSampleRate === 0) return')
    })

    it('keeps Base payroll PDF loading inside the guarded export failure boundary', () => {
        const payroll = source('app/(dashboard)/owner/production/BasePayrollRecords.tsx')
        expect(payroll).not.toContain("import { generateBasePayrollPdf } from")
        expect(payroll).toContain("if (!selectedPeriod || exportingPdf) return")
        expect(payroll).toContain("try {\n            const { generateBasePayrollPdf } = await import('@/lib/generate-base-payroll-pdf')")
        expect(payroll).toContain("workers: selectedPeriod.workers.filter(worker => worker.status !== 'reversed')")
        expect(payroll).toContain("toast.error('The payroll PDF could not be generated.')")
        expect(payroll).toContain("finally {\n            setExportingPdf(false)")
    })
})
