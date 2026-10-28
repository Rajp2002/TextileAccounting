#!/usr/bin/env node
// Compares cold first requests of two builds under the same conditions: the
// laptop's CPU limit drifts during a run, so builds alternate round by round
// (A then B, one cold sample per route each) and medians are taken per route.
//
//   node scripts/performance/signed-in-latency/cold-ab.mjs <before-dir> <output.json> --rounds 3 [run.mjs options]
//
// <before-dir> holds build A (a renamed .next); .next holds build B. Both are
// back in place afterwards, also when a round fails.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, renameSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = resolve(here, '../../..')
const [beforeDirArg, outputPath, ...rest] = process.argv.slice(2)
const roundsIndex = rest.indexOf('--rounds')
const rounds = roundsIndex >= 0 ? Number(rest.splice(roundsIndex, 2)[1]) : 3
const beforeDir = resolve(repo, beforeDirArg ?? '')
const current = join(repo, '.next')
const parked = join(repo, '.next-cold-ab-parked')
if (!beforeDirArg || !outputPath || !existsSync(beforeDir) || !existsSync(current) || existsSync(parked)) {
    throw new Error('Usage: cold-ab.mjs <before-dir> <output.json> [--rounds N] [run.mjs options]; .next must exist')
}

const work = mkdtempSync(join(tmpdir(), 'weavly-cold-ab-'))
const runs = { before: [], after: [] }
const speedLimit = () => /CPU_Speed_Limit\s*=\s*(\d+)/.exec(spawnSync('pmset', ['-g', 'therm'], { encoding: 'utf8' }).stdout ?? '')?.[1]
function measure(label, round) {
    const output = join(work, `${label}-${round}.json`)
    const limit = speedLimit()
    const result = spawnSync(process.execPath, [join(here, 'run.mjs'), output, '--cold', '1', ...rest], { cwd: repo, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`${label} round ${round} failed`)
    runs[label].push({ round, cpuSpeedLimit: limit === undefined ? null : Number(limit), ...JSON.parse(readFileSync(output, 'utf8')) })
}
try {
    for (let round = 1; round <= rounds; round += 1) {
        console.log(`round ${round}: before`)
        renameSync(current, parked); renameSync(beforeDir, current)
        try { measure('before', round) } finally { renameSync(current, beforeDir); renameSync(parked, current) }
        console.log(`round ${round}: after`)
        measure('after', round)
    }
} finally {
    rmSync(work, { recursive: true, force: true })
}

const median = values => {
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return Math.round((sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10
}
const keys = runs.after[0].results.map(result => `${result.account} ${result.path}`)
const summary = keys.map(key => {
    const pick = (label, field) => median(runs[label].map(run => run.results.find(result => `${result.account} ${result.path}` === key)[field]))
    return {
        route: key,
        before: { withoutConfigMs: pick('before', 'withoutConfigMs'), filesLoaded: pick('before', 'filesLoaded'), loadedSelfMs: pick('before', 'loadedSelfMs') - pick('before', 'configSelfMs'), bootMs: pick('before', 'bootMs') },
        after: { withoutConfigMs: pick('after', 'withoutConfigMs'), filesLoaded: pick('after', 'filesLoaded'), loadedSelfMs: pick('after', 'loadedSelfMs') - pick('after', 'configSelfMs'), bootMs: pick('after', 'bootMs') },
    }
})
writeFileSync(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    method: `${rounds} rounds alternating build A (before) and build B (after), one cold sample per route per round (see run.mjs --cold); medians across rounds. withoutConfigMs is the first request minus next.config evaluation; loadedSelfMs is own evaluation time of files loaded during the request, next.config excluded.`,
    cpuSpeedLimits: { before: runs.before.map(run => run.cpuSpeedLimit), after: runs.after.map(run => run.cpuSpeedLimit) },
    summary,
    runs,
}, null, 2))
console.log('| Route | First request ms (without next.config) | Files evaluated | Own evaluation ms |')
console.log('| --- | --- | --- | --- |')
for (const row of summary) {
    const change = (a, b) => `${a} → ${b} (${b - a >= 0 ? '+' : ''}${Math.round((b - a) / a * 100)}%)`
    console.log(`| ${row.route} | ${change(row.before.withoutConfigMs, row.after.withoutConfigMs)} | ${row.before.filesLoaded} → ${row.after.filesLoaded} | ${change(Math.round(row.before.loadedSelfMs), Math.round(row.after.loadedSelfMs))} |`)
}
console.log(`CPU speed limit per round: before ${runs.before.map(run => run.cpuSpeedLimit).join(', ')}; after ${runs.after.map(run => run.cpuSpeedLimit).join(', ')}`)
console.log(`wrote ${outputPath}`)
