#!/usr/bin/env node
// Cold cost of loading @sentry/nextjs from node_modules, as an unbundled
// Sentry is loaded once per Vercel function. `next start` evaluates
// next.config (withSentryConfig) first, so in cold-ab.mjs runs the externalized
// build finds Sentry already cached; add this number to its first requests.
//   node scripts/performance/signed-in-latency/sentry-require-cost.mjs [samples]
import { spawnSync } from 'node:child_process'
const samples = Number(process.argv[2] ?? 7)
const probe = "const t=performance.now();require('@sentry/nextjs');process.stdout.write(String(performance.now()-t))"
const times = Array.from({ length: samples }, () => {
    const result = spawnSync(process.execPath, ['-e', probe], { env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' })
    if (result.status !== 0) throw new Error(result.stderr)
    return Number(result.stdout)
}).sort((a, b) => a - b)
console.log(JSON.stringify({ samples: times.map(time => Math.round(time * 10) / 10), medianMs: Math.round(times[Math.floor(times.length / 2)] * 10) / 10 }))
