// CPU measurements only. No database, browser, timers, cache or service calls.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { cpus } from 'node:os'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createTypeScriptLoader } from './load-typescript.mjs'

const revision = 'a92b371930060bfa227e1da4dc3f115efcd3fa58'
const estimatorFile = resolve('lib/estimator.ts')
const original = execFileSync('git', ['show', `${revision}:lib/estimator.ts`], { encoding: 'utf8' })
const oldLoad = createTypeScriptLoader(file => file === estimatorFile ? original : readFileSync(file, 'utf8'))
const load = createTypeScriptLoader()
const beforeEngine = oldLoad(estimatorFile)
const engine = load(estimatorFile)
const validation = load(resolve('lib/estimator-validation.ts'))
const { estimatorFixture, estimatorReferenceCases } = load(resolve('scripts/performance/estimator-fixture.ts'))
const beforeScenario = (state, totals) => beforeEngine.runScenarios(state, totals).find(item => item.id === 'break-even')
const afterScenario = engine.getBreakEvenScenario ?? ((state, totals) => engine.runScenarios(state, totals).find(item => item.id === 'break-even'))

function pipeline(engine, scenario, state) {
    const validated = validation.validateEstimatorSnapshot(state)
    const totals = engine.calcFullTotals(state)
    const result = engine.buildCostingResult(state, totals)
    const readiness = validation.getEstimatorReadiness({ validation: validated, result, totals, warningsAcknowledged: true })
    return { totals, result, validation: validated, readiness, scenario: scenario(state, totals) ?? null }
}
const reference = Object.fromEntries(Object.entries(estimatorReferenceCases()).map(([name, input]) => {
    const expected = pipeline(beforeEngine, beforeScenario, input)
    assert.deepStrictEqual(pipeline(engine, afterScenario, input), expected, name)
    for (const customTarget of [undefined, 0, 0.01, 123.456]) {
        assert.deepStrictEqual(engine.runScenarios(input, expected.totals, customTarget), beforeEngine.runScenarios(input, expected.totals, customTarget), `${name}: all scenarios`)
    }
    return [name, { sha256: createHash('sha256').update(JSON.stringify(expected)).digest('hex'), scenario: expected.scenario }]
}))
if (process.argv.includes('--reference')) {
    console.log(JSON.stringify({ revision, reference }, null, 2))
} else {
    const stats = values => {
        const sorted = [...values].sort((a, b) => a - b)
        return { min: sorted[0], median: (sorted[14] + sorted[15]) / 2, max: sorted.at(-1) }
    }
    const results = []
    for (const rows of [1, 5, 20]) {
        const states = Array.from({ length: 20 }, (_, i) => {
            const state = estimatorFixture(rows)
            state.warpRows[0].yarnRate += i / 100
            return state
        })
        for (const scope of ['scenario-only', 'validation-totals-result-readiness-scenario']) {
            const totals = states.map(state => beforeEngine.calcFullTotals(state))
            const before = () => states.forEach((state, i) => scope === 'scenario-only' ? beforeScenario(state, totals[i]) : pipeline(beforeEngine, beforeScenario, state))
            const after = () => states.forEach((state, i) => scope === 'scenario-only' ? afterScenario(state, totals[i]) : pipeline(engine, afterScenario, state))
            for (let i = 0; i < 10; i++) { before(); after() }
            const samples = { before: [], after: [] }
            for (let i = 0; i < 30; i++) {
                for (const [name, fn] of i % 2 ? [['after', after], ['before', before]] : [['before', before], ['after', after]]) {
                    const start = performance.now()
                    fn()
                    samples[name].push((performance.now() - start) / states.length)
                }
            }
            results.push({ rowsPerYarn: rows, scope, beforeMs: stats(samples.before), afterMs: stats(samples.after), samples })
        }
    }
    console.log(JSON.stringify({ revision, node: process.version, cpu: cpus()[0].model,
        method: 'Actual TS/Decimal; synthetic 1/5/20 rows per yarn; 10 warmup batches then 30 alternating pairs of 20 changed inputs; ms per input; no React rendering or network',
        optimized: Boolean(engine.getBreakEvenScenario), results }, null, 2))
}
