// Read-only local CPU benchmark; no network or service credentials.
// node scripts/performance/job-summaries-benchmark.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileFunction } from 'node:vm'
import { cpus } from 'node:os'
import assert from 'node:assert/strict'
import ts from 'typescript'

const requirePackage = createRequire(import.meta.url)
const modules = new Map()
// Compile the actual pure TS modules, including their real Decimal dependency.
function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const compiledModule = { exports: {} }
    modules.set(file, compiledModule)
    const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    })
    compileFunction(outputText, ['require', 'module', 'exports'], { filename: file })(
        name => name.startsWith('.') ? load(resolve(dirname(file), `${name}.ts`)) : requirePackage(name),
        compiledModule, compiledModule.exports,
    )
    return compiledModule.exports
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const { calculateBaseJobSummary } = load(resolve(root, 'lib/base-production-core.ts'))
const { calculateBaseJobSummaries: after } = load(resolve(root, 'lib/base-job-summaries.ts'))
const { jobSummariesFixture } = load(resolve(root, 'scripts/performance/job-summaries-fixture.ts'))
const before = (jobs, entries, allocations) => new Map(jobs.map(job => [job.id, calculateBaseJobSummary(job, entries, allocations)]))
function stats(values) {
    const sorted = [...values].sort((a, b) => a - b)
    return { min: sorted[0], median: (sorted[14] + sorted[15]) / 2, max: sorted.at(-1) }
}
const results = []
for (const [jobs, rows] of [[1, 62], [20, 1240], [200, 12400], [200, 72000]]) {
    const input = jobSummariesFixture(jobs, rows)
    const args = [input.jobs, input.entries, input.allocations]
    assert.deepStrictEqual(after(...args), before(...args))
    for (let i = 0; i < 10; i++) { before(...args); after(...args) }
    const samples = { before: [], after: [] }
    for (let i = 0; i < 30; i++) {
        for (const [name, fn] of i % 2 ? [['after', after], ['before', before]] : [['before', before], ['after', after]]) {
            const start = performance.now()
            fn(...args)
            samples[name].push(performance.now() - start)
        }
    }
    const baseline = stats(samples.before), optimized = stats(samples.after)
    results.push({ jobs, entries: rows, allocations: input.allocations.length,
        beforeMs: baseline, afterMs: optimized, medianSavedMs: baseline.median - optimized.median,
        medianReductionPercent: 100 * (baseline.median - optimized.median) / baseline.median, samples })
}
console.log(JSON.stringify({ node: process.version, cpu: cpus()[0].model,
    method: 'Actual transpiled TS and Decimal.js; synthetic rows; 10 warmups then 30 alternating pairs; milliseconds; index creation included; CPU proxy only', results }, null, 2))
