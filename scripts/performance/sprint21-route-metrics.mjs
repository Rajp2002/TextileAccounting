#!/usr/bin/env node

import fs from 'node:fs'

const inputPath = process.argv[2]
if (!inputPath) {
    console.error('Usage: node scripts/performance/sprint21-route-metrics.mjs <samples.json> [summary.json]')
    process.exit(1)
}

const document = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const samples = Array.isArray(document) ? document : document.samples ?? document.rawSamples
if (!Array.isArray(samples)) throw new Error('Expected a JSON array or an object with a samples array.')

const numeric = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null
const percentile = (values, p) => {
    const sorted = values.filter(value => numeric(value) !== null).sort((a, b) => a - b)
    if (!sorted.length) return null
    const index = (sorted.length - 1) * p
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    if (lower === upper) return Math.round(sorted[lower] * 10) / 10
    const value = sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
    return Math.round(value * 10) / 10
}
const summary = (values) => {
    const valid = values.filter(value => numeric(value) !== null)
    return {
        sampleCount: valid.length,
        p50: percentile(valid, 0.5),
        p75: percentile(valid, 0.75),
        p95: percentile(valid, 0.95),
        min: valid.length ? Math.min(...valid) : null,
        max: valid.length ? Math.max(...valid) : null,
    }
}

const groups = new Map()
for (const sample of samples) {
    if (!sample || typeof sample.route !== 'string') continue
    const group = groups.get(sample.route) ?? []
    group.push(sample)
    groups.set(sample.route, group)
}

const routes = Object.fromEntries([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([route, routeSamples]) => [
    route,
    {
        sampleCount: routeSamples.length,
        shellVisibleMs: summary(routeSamples.map(sample => sample.shellVisibleMs)),
        primaryUsableMs: summary(routeSamples.map(sample => sample.primaryUsableMs)),
        secondaryReadyMs: summary(routeSamples.map(sample => sample.secondaryReadyMs)),
        metadata: {
            deploymentIds: [...new Set(routeSamples.map(sample => sample.deploymentId).filter(Boolean))],
            gitShas: [...new Set(routeSamples.map(sample => sample.gitSha).filter(Boolean))],
            functionRegions: [...new Set(routeSamples.map(sample => sample.functionRegion).filter(Boolean))],
            supabaseProjects: [...new Set(routeSamples.map(sample => sample.supabaseProjectRef).filter(Boolean))],
            supabaseRegions: [...new Set(routeSamples.map(sample => sample.supabaseRegion).filter(Boolean))],
            viewports: [...new Set(routeSamples.map(sample => sample.viewport).filter(Boolean))],
            coldSampleCount: routeSamples.filter(sample => sample.cold === true).length,
        },
    },
]))

const output = {
    generatedAt: new Date().toISOString(),
    source: inputPath,
    routes,
}
const serialized = JSON.stringify(output, null, 2) + '\n'
if (process.argv[3]) fs.writeFileSync(process.argv[3], serialized)
else process.stdout.write(serialized)
