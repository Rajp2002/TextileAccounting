#!/usr/bin/env node
// Times sign-in and log out against the fake Supabase/Upstash backend.
//
// Build first with the isolated environment (see run.mjs), then:
//   node scripts/performance/signed-in-latency/auth.mjs <output.json> [--iterations 9] [--browser-runs 5] [--delay 30] [--rtt 0]
//
// Two views of each flow:
// - browser: the real login form and log out button in headless Chromium
//   (service worker blocked). From the submit: when the next document starts
//   (the auth request is done), when it has loaded, and when the hand-over
//   overlay lifts (what the owner waits for). --rtt adds that many ms to every
//   browser request, a phone's round trip to Vercel.
// - request: the auth request the browser sent, replayed from Node: median
//   time, response size, backend calls and sequential waits. Each backend call
//   waits --delay ms (a modelled Vercel bom1 to Supabase Mumbai round trip),
//   Redis a third of that.
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
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
const iterations = option('iterations', 9)
const browserRuns = option('browser-runs', 5)
const supabaseDelayMs = option('delay', 30)
const rttMs = option('rtt', 0)
const backendPort = option('backend-port', 54399)
const appPort = option('port', 3012)
const base = `http://localhost:${appPort}`
// Proxy recognises the project id compiled into the build; the Supabase client
// reads the cookie named after the URL host (127.0.0.1). In production they are
// the same name, so the browser carries the marker throughout.
const PROJECT_MARKER = { name: 'sb-localperformance-auth-token', value: 'present' }

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
        NEXT_PUBLIC_SITE_URL: base,
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
    const sorted = values.filter(value => typeof value === 'number').sort((a, b) => a - b)
    if (!sorted.length) return null
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const round = value => value === null ? null : Math.round(value * 10) / 10
const pause = ms => new Promise(done => setTimeout(done, ms))

// Runs in every document of a browser context: marks the submit, the next
// document's load, and when the hand-over overlay is taken away.
function pageMarks() {
    const key = 'weavly-perf-auth'
    const now = () => performance.timeOrigin + performance.now()
    const read = () => { try { return JSON.parse(sessionStorage.getItem(key) || '{}') } catch { return {} } }
    const write = patch => { try { sessionStorage.setItem(key, JSON.stringify({ ...read(), ...patch })) } catch {} }
    document.addEventListener('submit', () => { if (!read().submittedAt) write({ submittedAt: now(), from: location.pathname }) }, true)
    if (!read().submittedAt) return
    write({ documentStartedAt: performance.timeOrigin, at: location.pathname })
    addEventListener('load', () => write({ loadedAt: now() }), { once: true })
    let seen = false
    const watch = new MutationObserver(() => {
        const present = Boolean(document.querySelector('weavly-handoff'))
        if (present) seen = true
        else if (seen) { write({ overlayGoneAt: now() }); watch.disconnect() }
    })
    watch.observe(document, { childList: true, subtree: true })
    write({ handoff: null })
    addEventListener('DOMContentLoaded', () => write({ handoff: seen || Boolean(document.querySelector('weavly-handoff')) }), { once: true })
}

async function newContext(browser, cookies) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } })
    await context.addCookies(cookies.map(cookie => ({ ...cookie, domain: 'localhost', path: '/' })))
    await context.addInitScript(pageMarks)
    const page = await context.newPage()
    if (rttMs) {
        const cdp = await context.newCDPSession(page)
        await cdp.send('Network.enable')
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: rttMs, downloadThroughput: -1, uploadThroughput: -1 })
    }
    return { context, page }
}

// The auth request (telemetry posts aside); kept to replay.
const AUTH_PATHS = ['/login', '/auth/signin', '/auth/signout']
function captureAuthRequest(page) {
    let captured = null
    page.on('request', request => {
        if (captured || request.method() !== 'POST' || !AUTH_PATHS.includes(new URL(request.url()).pathname)) return
        captured = request
    })
    return async () => {
        if (!captured) return null
        const headers = await captured.allHeaders()
        const response = await captured.response()
        return { url: captured.url(), headers, body: captured.postDataBuffer(), status: response?.status() ?? null }
    }
}

async function browserFlow(browser, { cookies, start, act, destination }) {
    const { context, page } = await newContext(browser, cookies)
    try {
        await page.goto(`${base}${start}`, { waitUntil: 'networkidle' })
        const authRequest = captureAuthRequest(page)
        await act(page)
        await page.waitForURL(url => url.pathname === destination, { timeout: 15_000 })
        await page.waitForLoadState('load')
        await page.waitForFunction(() => !document.querySelector('weavly-handoff'), null, { timeout: 5_000 })
        await pause(50)
        const marks = await page.evaluate(() => JSON.parse(sessionStorage.getItem('weavly-perf-auth') || '{}'))
        const since = value => typeof value === 'number' ? value - marks.submittedAt : null
        return {
            request: await authRequest(),
            at: marks.at,
            handoff: marks.handoff,
            nextDocumentMs: since(marks.documentStartedAt),
            loadedMs: since(marks.loadedAt),
            // Without a hand-over the next page shows as soon as it paints.
            overlayGoneMs: since(marks.overlayGoneAt ?? marks.loadedAt),
        }
    } finally {
        await context.close()
    }
}

async function signInFlow(browser, account) {
    return browserFlow(browser, {
        cookies: [PROJECT_MARKER],
        start: '/login',
        destination: account.destination,
        act: async page => {
            await page.click('#email')
            await page.fill('#email', account.email)
            await page.click('#password')
            await page.fill('#password', 'harness-password')
            await page.click('#login-btn')
        },
    })
}

async function logoutFlow(browser, sessionCookie) {
    return browserFlow(browser, {
        cookies: [PROJECT_MARKER, sessionCookie],
        start: '/owner/estimator',
        destination: '/login',
        act: page => page.locator('form[action="/auth/signout"] button[type="submit"]').first().click(),
    })
}

async function replay(backend, captured, iterations, { cookie } = {}) {
    const headers = Object.fromEntries(Object.entries(captured.headers)
        .filter(([name]) => !['host', 'connection', 'content-length', 'cookie'].includes(name) && !name.startsWith(':')))
    const samples = []
    for (let index = 0; index < iterations + 2; index += 1) {
        await pause(20)
        backend.drainLog()
        const startedAt = performance.now()
        const response = await fetch(captured.url, { method: 'POST', redirect: 'manual', headers: { ...headers, cookie: cookie ?? captured.headers.cookie ?? '' }, body: captured.body })
        const body = Buffer.from(await response.arrayBuffer())
        const total = performance.now() - startedAt
        await pause(20)
        const calls = backend.drainLog()
        // Two warm-up requests first.
        if (index >= 2) samples.push({ status: response.status, total, bytes: body.length, calls })
    }
    const last = samples.at(-1)
    return {
        status: last.status,
        totalMs: round(median(samples.map(sample => sample.total))),
        responseBytes: median(samples.map(sample => sample.bytes)),
        backendCalls: median(samples.map(sample => sample.calls.length)),
        sequentialWaits: median(samples.map(sample => sequentialWaits(sample.calls))),
        callTimeline: last.calls.map(call => ({
            kind: call.kind, method: call.method, target: call.target,
            startMs: round(call.startedAt - last.calls[0].startedAt), endMs: round(call.endedAt - last.calls[0].startedAt),
        })),
    }
}

function summarise(runs) {
    return {
        runs: runs.length,
        handoff: runs.filter(run => run.handoff).length,
        nextDocumentMs: round(median(runs.map(run => run.nextDocumentMs))),
        loadedMs: round(median(runs.map(run => run.loadedMs))),
        overlayGoneMs: round(median(runs.map(run => run.overlayGoneMs))),
    }
}

async function main() {
    if (!outputPath) throw new Error('Pass an output JSON path')
    const backend = createFakeBackend({ supabaseDelayMs, redisDelayMs: Math.round(supabaseDelayMs / 3) })
    await backend.listen(backendPort)
    const issuer = 'http://127.0.0.1:9/auth/v1'
    const sessionCookie = name => ({ name: 'sb-127-auth-token', value: `base64-${Buffer.from(JSON.stringify(backend.sessionFor(ACCOUNTS[name], issuer))).toString('base64url')}` })
    const child = spawn(join(repo, 'node_modules/.bin/next'), ['start', '-p', String(appPort)], { cwd: repo, env: isolatedEnv(), stdio: ['ignore', 'pipe', 'pipe'] })
    const serverLog = []
    child.stdout.on('data', chunk => serverLog.push(chunk.toString()))
    child.stderr.on('data', chunk => serverLog.push(chunk.toString()))
    const browser = await chromium.launch()
    const results = []
    try {
        for (let attempt = 0; ; attempt += 1) {
            if (child.exitCode !== null) throw new Error(`next start exited: ${serverLog.join('')}`)
            try { if ((await fetch(`${base}/login`, { redirect: 'manual' })).status < 500) break } catch {}
            if (attempt > 120) throw new Error('next start did not become ready')
            await pause(500)
        }
        const flows = [
            { name: 'sign-in', account: 'lite', run: () => signInFlow(browser, { email: 'lite@perf-harness.test', destination: '/owner/estimator' }) },
            { name: 'sign-in', account: 'free', run: () => signInFlow(browser, { email: 'free@perf-harness.test', destination: '/free' }) },
            { name: 'log out', account: 'lite', run: () => logoutFlow(browser, sessionCookie('lite')) },
        ]
        for (const flow of flows) {
            // One warm-up run compiles nothing in production but fills caches.
            await flow.run()
            const runs = []
            for (let index = 0; index < browserRuns; index += 1) runs.push(await flow.run())
            const captured = runs.at(-1).request
            if (!captured) throw new Error(`${flow.name} sent no POST`)
            const cookie = flow.name === 'log out'
                ? `${PROJECT_MARKER.name}=${PROJECT_MARKER.value}; ${sessionCookie(flow.account).name}=${sessionCookie(flow.account).value}`
                : undefined
            const request = await replay(backend, captured, iterations, { cookie })
            const result = {
                flow: flow.name, account: flow.account,
                authRequest: { method: 'POST', path: new URL(captured.url).pathname, serverAction: Boolean(captured.headers['next-action']) },
                browser: summarise(runs), browserRuns: runs.map(run => ({ ...run, request: undefined })), request,
            }
            results.push(result)
            console.log(`${flow.name.padEnd(8)} ${flow.account.padEnd(5)} ${result.authRequest.path.padEnd(14)}${result.authRequest.serverAction ? ' (action)' : '         '}  request ${String(request.totalMs).padStart(6)} ms ${String(request.responseBytes).padStart(6)} B calls ${request.backendCalls} waits ${request.sequentialWaits}  |  browser: next doc ${String(result.browser.nextDocumentMs).padStart(6)} ms  loaded ${String(result.browser.loadedMs).padStart(6)} ms  overlay gone ${String(result.browser.overlayGoneMs).padStart(6)} ms (hand-over ${result.browser.handoff}/${result.browser.runs})`)
        }
    } finally {
        await browser.close()
        child.kill('SIGTERM')
        await backend.close()
    }
    const errors = serverLog.join('').split('\n').filter(line => /error|Error/.test(line)).slice(0, 40)
    writeFileSync(outputPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        buildId: readFileSync(join(repo, '.next/BUILD_ID'), 'utf8').trim(),
        method: `next start (production build, isolated env) against a fake Supabase/Upstash backend; each Supabase call waits ${supabaseDelayMs} ms, each Redis call ${Math.round(supabaseDelayMs / 3)} ms. Browser: headless Chromium, service worker blocked, ${rttMs} ms added per request, ${browserRuns} runs after one warm-up, times from the form submit. Request: the browser's auth request replayed ${iterations} times after two warm-ups. Medians reported.`,
        supabaseDelayMs, rttMs, iterations, browserRuns, results, serverErrors: errors,
    }, null, 2))
    console.log(`wrote ${outputPath}`)
    if (errors.length) console.log(`server log has ${errors.length} error lines (first: ${errors[0]?.slice(0, 200)})`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
