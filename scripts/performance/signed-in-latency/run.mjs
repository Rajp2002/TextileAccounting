#!/usr/bin/env node
// Times signed-in Weavly pages against a fake Supabase/Upstash backend.
//
// Build first with the isolated environment (no secrets, no hosted URLs):
//   node scripts/performance/isolated-command.mjs bash -c 'node scripts/reset-build-type-cache.mjs && ./node_modules/.bin/next build --webpack'
// Then (through heavyq on Raj's laptop):
//   node scripts/performance/signed-in-latency/run.mjs <output.json> [--iterations 5] [--delay 30]
//
// Each backend call waits --delay ms (default 30, a modelled Vercel bom1 to
// Supabase Mumbai round trip including query time); Redis waits a third of
// that. Reported per route: median server time to first byte and to the full
// document, backend calls, and "sequential waits" (the longest chain of calls
// where each started only after the previous one finished).
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { createFakeBackend } from './fake-backend.mjs'
import { ACCOUNTS } from './fixtures.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = resolve(here, '../../..')
const args = process.argv.slice(2)
const outputPath = args.find(arg => !arg.startsWith('--') && !/^\d+$/.test(arg))
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`)
    return index >= 0 ? Number(args[index + 1]) : fallback
}
const iterations = option('iterations', 5)
const supabaseDelayMs = option('delay', 30)
const backendPort = option('backend-port', 54399)
const appPort = option('port', 3012)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null

const ROUTES = [
    { account: null, path: '/' },
    { account: null, path: '/login' },
    { account: 'lite', path: '/login', note: 'installed-app launch: signed-in /login redirect hop' },
    { account: 'lite', path: '/owner/estimator' },
    { account: 'lite', path: '/owner/quotes' },
    { account: 'lite', path: '/owner/rates' },
    { account: 'lite', path: '/owner/settings' },
    { account: 'lite', path: '/owner/billing' },
    { account: 'base', path: '/owner/estimator' },
    { account: 'base', path: '/owner/production' },
    { account: 'base', path: '/owner/production/daily-sheet' },
    { account: 'base', path: '/owner/stock' },
    { account: 'base', path: '/owner/dispatches' },
    { account: 'base', path: '/owner/payroll' },
    { account: 'base', path: '/owner/machines' },
    { account: 'base', path: '/owner/workers' },
    { account: 'base', path: '/owner/assignments' },
    { account: 'free', path: '/login', note: 'installed-app launch: signed-in /login redirect hop' },
    { account: 'free', path: '/free' },
    { account: 'free', path: '/free/costings' },
    { account: 'free', path: '/free/account' },
    { account: 'free', path: '/free/billing' },
]

function isolatedEnv() {
    const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SHELL'].filter(key => process.env[key]).map(key => [key, process.env[key]]))
    return {
        ...env,
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-performance-placeholder',
        NEXT_PUBLIC_SUPABASE_PROJECT_ID: 'localperformance',
        SUPABASE_SERVICE_ROLE_KEY: 'local-performance-placeholder',
        NEXT_PUBLIC_SITE_URL: `http://localhost:${appPort}`,
        SENTRY_DSN: '', NEXT_PUBLIC_SENTRY_DSN: '',
        UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${backendPort}/redis`,
        UPSTASH_REDIS_REST_TOKEN: 'local-performance-placeholder',
        WEAVLY_FREE_SIGNING_KEY_ID: 'launch',
        WEAVLY_FREE_SIGNING_KEYS: JSON.stringify({ launch: 'local-performance-harness-key-0123456789abcdef' }),
        WEAVLY_FAKE_BACKEND_ORIGIN: `http://127.0.0.1:${backendPort}`,
        NODE_OPTIONS: `--require "${join(here, 'redirect-fetch.cjs')}"`,
    }
}

function sequentialWaits(calls) {
    // Longest chain of calls where each began after the previous ended.
    const sorted = [...calls].sort((a, b) => a.startedAt - b.startedAt)
    const depth = sorted.map(() => 1)
    for (let i = 0; i < sorted.length; i += 1) {
        for (let j = 0; j < i; j += 1) {
            if (sorted[i].startedAt >= sorted[j].endedAt - 1 && depth[j] + 1 > depth[i]) depth[i] = depth[j] + 1
        }
    }
    return depth.length ? Math.max(...depth) : 0
}

const median = values => {
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const round = value => Math.round(value * 10) / 10

function firstLoadJs(html) {
    const sources = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]))]
        .filter(src => src.startsWith('/_next/static/') && !src.includes('polyfills'))
    let rawBytes = 0
    let gzipBytes = 0
    const chunks = []
    for (const src of sources) {
        const file = join(repo, '.next', decodeURIComponent(src.replace(/^\/_next\//, '').split('?')[0]))
        if (!existsSync(file)) continue
        const content = readFileSync(file)
        const chunkGzip = gzipSync(content, { level: 9 }).length
        rawBytes += content.length
        gzipBytes += chunkGzip
        chunks.push({ src: src.replace(/^\/_next\/static\/chunks\//, ''), gzipBytes: chunkGzip })
    }
    const css = [...new Set([...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map(match => match[1]))]
    let cssGzipBytes = 0
    for (const href of css) {
        const file = join(repo, '.next', href.replace(/^\/_next\//, '').split('?')[0])
        if (existsSync(file)) cssGzipBytes += gzipSync(readFileSync(file), { level: 9 }).length
    }
    return { scripts: sources.length, rawBytes, gzipBytes, cssFiles: css.length, cssGzipBytes, chunks }
}

async function timedRequest(url, cookie) {
    const startedAt = performance.now()
    const response = await fetch(url, { redirect: 'manual', headers: cookie ? { cookie } : {} })
    const ttfb = performance.now() - startedAt
    const body = await response.text()
    const total = performance.now() - startedAt
    return { status: response.status, location: response.headers.get('location'), ttfb, total, body }
}

async function waitForServer(base, child) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
        if (child.exitCode !== null) throw new Error(`next start exited with ${child.exitCode}`)
        try {
            const response = await fetch(`${base}/login`, { redirect: 'manual' })
            if (response.status < 500) return
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 500))
    }
    throw new Error('next start did not become ready')
}

async function main() {
    if (!outputPath) throw new Error('Pass an output JSON path')
    const backend = createFakeBackend({ supabaseDelayMs, redisDelayMs: Math.round(supabaseDelayMs / 3) })
    await backend.listen(backendPort)
    const issuer = 'http://127.0.0.1:9/auth/v1'
    const cookies = Object.fromEntries(Object.entries(ACCOUNTS).map(([name, account]) => {
        const session = backend.sessionFor(account, issuer)
        const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`
        if (value.length > 3180) throw new Error('Session cookie would be chunked; shrink the fixture')
        // Proxy recognises the project id compiled into the build; the
        // Supabase client reads the key derived from the URL host (127.0.0.1).
        return [name, `sb-127-auth-token=${value}; sb-localperformance-auth-token=present`]
    }))

    const child = spawn(join(repo, 'node_modules/.bin/next'), ['start', '-p', String(appPort)], { cwd: repo, env: isolatedEnv(), stdio: ['ignore', 'pipe', 'pipe'] })
    const serverLog = []
    child.stdout.on('data', chunk => serverLog.push(chunk.toString()))
    child.stderr.on('data', chunk => serverLog.push(chunk.toString()))
    const base = `http://localhost:${appPort}`
    const results = []
    try {
        await waitForServer(base, child).catch(error => { console.error(serverLog.join('')); throw error })
        const routes = only ? ROUTES.filter(route => only.some(token => `${route.account ?? 'public'}:${route.path}`.includes(token))) : ROUTES
        // Two warm-up passes so module loading and JIT are out of the numbers.
        for (let pass = 0; pass < 2; pass += 1) {
            for (const route of routes) await timedRequest(`${base}${route.path}`, route.account ? cookies[route.account] : undefined)
        }
        backend.drainLog()
        for (const route of routes) {
            const samples = []
            let lastBody = ''
            for (let index = 0; index < iterations; index += 1) {
                backend.drainLog()
                const sample = await timedRequest(`${base}${route.path}`, route.account ? cookies[route.account] : undefined)
                // Let response-finish logging settle before reading calls.
                await new Promise(resolve => setTimeout(resolve, 20))
                const calls = backend.drainLog()
                samples.push({ ...sample, calls })
                lastBody = sample.body
            }
            const callCounts = samples.map(sample => sample.calls.length)
            const waits = samples.map(sample => sequentialWaits(sample.calls))
            const last = samples.at(-1)
            const result = {
                account: route.account ?? 'public',
                path: route.path,
                note: route.note,
                status: last.status,
                location: last.location,
                ttfbMs: round(median(samples.map(sample => sample.ttfb))),
                totalMs: round(median(samples.map(sample => sample.total))),
                backendCalls: median(callCounts),
                sequentialWaits: median(waits),
                callTimeline: last.calls.map(call => ({
                    kind: call.kind, method: call.method, target: call.target,
                    startMs: round(call.startedAt - last.calls[0].startedAt), endMs: round(call.endedAt - last.calls[0].startedAt),
                })),
                html: last.status === 200 ? { bytes: Buffer.byteLength(lastBody), gzipBytes: gzipSync(lastBody).length, ...firstLoadJs(lastBody) } : null,
                errorDigest: /NEXT_HTTP_ERROR|Application error|digest/.test(lastBody) && last.status >= 500 ? 'server error' : null,
            }
            results.push(result)
            console.log(`${result.account.padEnd(6)} ${route.path.padEnd(32)} ${String(result.status).padEnd(4)} ttfb ${String(result.ttfbMs).padStart(7)} ms  total ${String(result.totalMs).padStart(7)} ms  calls ${String(result.backendCalls).padStart(3)}  waits ${String(result.sequentialWaits).padStart(2)}${result.html ? `  js ${(result.html.gzipBytes / 1024).toFixed(1)} KB gz` : ''}`)
        }
    } finally {
        child.kill('SIGTERM')
        await backend.close()
    }
    const errors = serverLog.join('').split('\n').filter(line => /error|Error/.test(line)).slice(0, 40)
    writeFileSync(outputPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        buildId: readFileSync(join(repo, '.next/BUILD_ID'), 'utf8').trim(),
        method: `next start (production build, isolated env) against a fake Supabase/Upstash backend; each Supabase call waits ${supabaseDelayMs} ms, each Redis call ${Math.round(supabaseDelayMs / 3)} ms; ${iterations} measured requests per route after two warm-up passes; medians reported. JS sizes are the gzip-9 total of the <script src> chunks in the returned HTML (polyfills excluded).`,
        supabaseDelayMs, iterations, results, serverErrors: errors,
    }, null, 2))
    console.log(`wrote ${outputPath}`)
    if (errors.length) console.log(`server log has ${errors.length} error lines (first: ${errors[0]?.slice(0, 200)})`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
