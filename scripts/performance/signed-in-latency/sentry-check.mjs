#!/usr/bin/env node
// Checks that the server build still reports to Sentry: starts `next start`
// against the fake backend, causes one server error (the plan read of a Lite
// page fails) plus ordinary traffic, and counts the error events and
// transactions that arrive. Exits non-zero if no error event arrives.
// NEXT_PUBLIC_SENTRY_DSN is compiled in, so build with the harness DSN:
//   WEAVLY_HARNESS_SENTRY_DSN=http://public@127.0.0.1:54399/1 node scripts/performance/isolated-command.mjs bash -c 'node scripts/reset-build-type-cache.mjs && ./node_modules/.bin/next build --webpack'
//   node scripts/performance/signed-in-latency/sentry-check.mjs
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFakeBackend } from './fake-backend.mjs'
import { ACCOUNTS } from './fixtures.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = resolve(here, '../../..')
const backendPort = 54399
const appPort = 3012

const backend = createFakeBackend({ supabaseDelayMs: 5, redisDelayMs: 2 })
const envelopes = []
backend.onOther = (req, body) => { if (/\/envelope\/?$/.test(req.url.split('?')[0])) envelopes.push(body) }
await backend.listen(backendPort)
const issuer = 'http://127.0.0.1:9/auth/v1'
const cookieFor = account => {
    const value = `base64-${Buffer.from(JSON.stringify(backend.sessionFor(account, issuer))).toString('base64url')}`
    return `sb-127-auth-token=${value}; sb-localperformance-auth-token=present`
}

const env = {
    ...Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SHELL'].filter(key => process.env[key]).map(key => [key, process.env[key]])),
    NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-performance-placeholder',
    NEXT_PUBLIC_SUPABASE_PROJECT_ID: 'localperformance', SUPABASE_SERVICE_ROLE_KEY: 'local-performance-placeholder',
    NEXT_PUBLIC_SITE_URL: `http://localhost:${appPort}`,
    SENTRY_DSN: '', NEXT_PUBLIC_SENTRY_DSN: `http://public@127.0.0.1:${backendPort}/1`,
    UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${backendPort}/redis`, UPSTASH_REDIS_REST_TOKEN: 'local-performance-placeholder',
    WEAVLY_FAKE_BACKEND_ORIGIN: `http://127.0.0.1:${backendPort}`,
    NODE_OPTIONS: `--require "${join(here, 'redirect-fetch.cjs')}"`,
}
const child = spawn(join(repo, 'node_modules/.bin/next'), ['start', '-p', String(appPort)], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] })
const log = []
child.stdout.on('data', chunk => log.push(chunk.toString()))
child.stderr.on('data', chunk => log.push(chunk.toString()))
try {
    for (let attempt = 0; !/Ready in/.test(log.join('')); attempt += 1) {
        if (attempt > 120 || child.exitCode !== null) throw new Error(`next start did not start: ${log.join('')}`)
        await new Promise(resolve => setTimeout(resolve, 250))
    }
    const base = `http://localhost:${appPort}`
    // getOrgPlanAccess throws when its read fails, so the page errors.
    backend.failRest = url => url.searchParams.get('select')?.startsWith('base_plan_visible')
    const failing = await fetch(`${base}/owner/rates`, { headers: { cookie: cookieFor(ACCOUNTS.lite) } })
    await failing.text()
    backend.failRest = null
    // Ordinary traffic; server transactions are sampled at 10% in production.
    for (let index = 0; index < 40; index += 1) await (await fetch(`${base}/owner/rates`, { headers: { cookie: cookieFor(ACCOUNTS.lite) } })).text()
    await new Promise(resolve => setTimeout(resolve, 4000))
    const items = envelopes.flatMap(body => body.split('\n').filter(line => line.startsWith('{"type"')).map(line => JSON.parse(line).type))
    const count = type => items.filter(item => item === type).length
    console.log(`/owner/rates (failing plan read) answered ${failing.status}; envelopes ${envelopes.length}: ${count('event')} error events, ${count('transaction')} transactions`)
    if (!count('event')) process.exitCode = 1
} finally {
    child.kill('SIGTERM')
    await backend.close()
}
