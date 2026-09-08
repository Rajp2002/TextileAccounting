// Local CPU benchmark only: no credentials, network, database, or writes.
// Run: node scripts/performance/payroll-readiness-benchmark.mjs
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { cpus } from 'node:os'
import assert from 'node:assert/strict'
import ts from 'typescript'

async function loadPureModule(path) {
    const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    })
    return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}
const { buildBasePayrollReadiness: before } = await loadPureModule('../../__tests__/fixtures/payroll-readiness-original.ts')
const { buildBasePayrollReadiness: after } = await loadPureModule('../../lib/base-payroll-readiness.ts')
const { payrollReadinessFixture } = await loadPureModule('./payroll-readiness-fixture.ts')
function stats(samples) {
    const sorted = [...samples].sort((a, b) => a - b)
    return { min: sorted[0], median: (sorted[14] + sorted[15]) / 2, max: sorted.at(-1) }
}
const results = []
for (const [workers, days] of [[1, 31], [20, 31], [200, 31], [200, 180]]) {
    const input = payrollReadinessFixture(workers, days)
    assert.deepStrictEqual(after(input), before(input))
    for (let i = 0; i < 10; i++) { before(input); after(input) }
    const samples = { before: [], after: [] }
    for (let i = 0; i < 30; i++) {
        for (const [name, fn] of i % 2 ? [['after', after], ['before', before]] : [['before', before], ['after', after]]) {
            const start = performance.now()
            fn(input)
            samples[name].push(performance.now() - start)
        }
    }
    const baseline = stats(samples.before)
    const optimized = stats(samples.after)
    results.push({ workers, days, entries: input.entries.length, allocations: input.allocations.length,
        beforeMs: baseline, afterMs: optimized, medianSavedMs: baseline.median - optimized.median,
        medianReductionPercent: 100 * (baseline.median - optimized.median) / baseline.median, samples })
}
console.log(JSON.stringify({ node: process.version, cpu: cpus()[0].model,
    method: 'Pure transpiled production function; synthetic input; 10 warmups, 30 alternating paired samples; milliseconds; includes index allocation; no React/DB/network; no cross-call cache', results }, null, 2))
