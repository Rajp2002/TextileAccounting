#!/usr/bin/env node
// Loads signed-in pages as a phone would run them: Playwright Chromium with a
// phone viewport, touch, and the CPU slowed 4x (CDP), against `next start` and
// the fake backend (run.mjs's build and fixtures). Each sample is a fresh
// browser context with an empty cache, so every page downloads and compiles
// its JavaScript. Reports, per route (medians):
//   - FCP and LCP;
//   - the app's own "primary usable" route milestone (components/performance/
//     route-milestones.tsx), set once React has hydrated the page's main view;
//   - long tasks (main-thread tasks over 50 ms) until the page is quiet: count,
//     longest, and total blocking time (the part of each over 50 ms);
//   - JavaScript bytes fetched and the share that ran during load (V8 coverage).
//
// --modules: also split each script over 100 KB into its webpack modules and
// report per module bytes, bytes that ran, and a few identifying strings
// (production client builds here have no source maps).
//
// --compare-legacy-queue: alternate every sample between a browser that still
// has a non-empty legacy offline-queue database (TextileDB, lib/db.ts), which
// makes the startup cleanup load Dexie, and a fresh one; report both.
//
// --profile: also record a V8 CPU profile of the load and report main-thread
// time by script (self time) and the busiest functions.
//
//   node scripts/performance/signed-in-latency/phone.mjs <output.json> [--samples 5] [--cpu 4] [--only lite:/owner/estimator,free:/free] [--modules] [--profile]
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { parse } from 'acorn'
import { createFakeBackend } from './fake-backend.mjs'
import { ACCOUNTS } from './fixtures.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = resolve(here, '../../..')
const args = process.argv.slice(2)
const outputPath = args.find(arg => !arg.startsWith('--') && !/^\d+$/.test(arg) && !arg.includes(':/'))
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`)
    return index >= 0 ? args[index + 1] : fallback
}
const samples = Number(option('samples', 5))
const cpuSlowdown = Number(option('cpu', 4))
const backendPort = 54399
const appPort = 3012
const ROUTES = [
    { account: 'lite', path: '/owner/estimator', note: 'the post-sign-in landing page' },
    { account: 'free', path: '/free', note: 'the same estimator in Free mode' },
    { account: 'lite', path: '/owner/quotes' },
    { account: 'free', path: '/free/costings' },
]
const withModules = args.includes('--modules')
const withProfile = args.includes('--profile')
const compareLegacyQueue = args.includes('--compare-legacy-queue')
const only = option('only', null)?.split(',')
const routes = only ? ROUTES.filter(route => only.includes(`${route.account}:${route.path}`)) : ROUTES

const median = values => {
    const sorted = values.filter(value => value !== null && value !== undefined).sort((a, b) => a - b)
    if (!sorted.length) return null
    const middle = Math.floor(sorted.length / 2)
    return Math.round((sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10
}

// Collected in the page from the first script onwards.
const observerScript = () => {
    window.__phone = { longTasks: [], lcp: null }
    new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__phone.longTasks.push({ start: entry.startTime, duration: entry.duration })
    }).observe({ type: 'longtask', buffered: true })
    new PerformanceObserver(list => {
        const entries = list.getEntries()
        window.__phone.lcp = entries[entries.length - 1].startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
}

// A non-empty legacy queue database as older app versions left it (Dexie
// schema version 2 is IndexedDB version 20), holding another account's row,
// so the cleanup loads Dexie and keeps the database.
const seedLegacyQueue = () => {
    const request = indexedDB.open('TextileDB', 20)
    request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true })
        for (const index of ['scope', 'table', 'type', 'timestamp', 'synced']) store.createIndex(index, index)
        store.add({ scope: 'another-account', table: 'quotes', type: 'INSERT', data: {}, timestamp: 0, synced: 0 })
    }
    request.onsuccess = () => request.result.close()
}

async function measure(browser, base, cookieValue, route, { legacyQueue = false } = {}) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36',
        locale: 'en-IN', timezoneId: 'Asia/Kolkata',
    })
    await context.addCookies(cookieValue.split('; ').map(pair => {
        const [name, ...rest] = pair.split('=')
        return { name, value: rest.join('='), url: base }
    }))
    await context.addInitScript(observerScript)
    const page = await context.newPage()
    if (legacyQueue) {
        // Seed on the origin first, in its own page, so the measured load starts with the database present.
        const seed = await context.newPage()
        await seed.goto(`${base}/file.svg`)
        await seed.evaluate(seedLegacyQueue)
        await seed.waitForFunction(async () => (await indexedDB.databases()).some(database => database.name === 'TextileDB'))
        await seed.close()
    }
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdown })
    await page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: false })
    if (withProfile) {
        await cdp.send('Profiler.enable')
        await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
        await cdp.send('Profiler.start')
    }
    const response = await page.goto(`${base}${route.path}`, { waitUntil: 'load', timeout: 120_000 })
    // Quiet: no long task for 3 s (or 30 s at most).
    for (let waited = 0; waited < 30_000; waited += 500) {
        await page.waitForTimeout(500)
        const lastEnd = await page.evaluate(() => Math.max(0, ...window.__phone.longTasks.map(task => task.start + task.duration)))
        if (await page.evaluate(() => performance.now()) - lastEnd > 3000) break
    }
    const result = await page.evaluate(() => {
        const paint = Object.fromEntries(performance.getEntriesByType('paint').map(entry => [entry.name, entry.startTime]))
        const navigation = performance.getEntriesByType('navigation')[0]
        const marks = performance.getEntriesByType('mark').map(entry => ({ name: entry.name, at: entry.startTime }))
        const fcp = paint['first-contentful-paint'] ?? 0
        const tasks = window.__phone.longTasks
        return {
            fcp: paint['first-contentful-paint'] ?? null, lcp: window.__phone.lcp,
            domContentLoaded: navigation?.domContentLoadedEventEnd ?? null, load: navigation?.loadEventEnd ?? null,
            primaryUsable: marks.find(mark => /primary/i.test(mark.name))?.at ?? null,
            marks,
            longTaskCount: tasks.length,
            longestTask: tasks.length ? Math.max(...tasks.map(task => task.duration)) : 0,
            totalBlockingTime: tasks.filter(task => task.start >= fcp).reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0),
            mainThreadInLongTasks: tasks.reduce((sum, task) => sum + task.duration, 0),
            heapUsedMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
        }
    })
    const profile = withProfile ? summarizeProfile((await cdp.send('Profiler.stop')).profile) : undefined
    const coverage = await page.coverage.stopJSCoverage()
    let jsBytes = 0
    let usedBytes = 0
    const scripts = []
    for (const entry of coverage) {
        if (!entry.url.includes('/_next/static/')) continue
        const length = entry.source?.length ?? 0
        // Block-level coverage: count a byte as used if the innermost range covering it ran.
        // Ranges nest; outer ones first (start ascending, wider first) so inner ones win.
        const used = new Uint8Array(length)
        const ranges = entry.functions.flatMap(fn => fn.ranges).sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset)
        for (const range of ranges) used.fill(range.count > 0 ? 1 : 0, range.startOffset, Math.min(range.endOffset, length))
        const usedCount = used.reduce((sum, value) => sum + value, 0)
        jsBytes += length
        usedBytes += usedCount
        scripts.push({ url: entry.url.replace(/^.*\/_next\/static\/chunks\//, ''), bytes: length, usedBytes: usedCount, ...(withModules && length > 100_000 ? { modules: webpackModules(entry.source, used) } : {}) })
    }
    await context.close()
    return { status: response?.status() ?? null, ...result, jsBytes, usedBytes, scripts: scripts.sort((a, b) => b.bytes - a.bytes).slice(0, 15), profile }
}

// The module factories of a webpack chunk: (self.webpackChunk…).push([[ids], { id: factory, … }]).
function webpackModules(source, used) {
    let program
    try { program = parse(source, { ecmaVersion: 'latest', sourceType: 'script' }) } catch { return [] }
    const factories = []
    const visit = node => {
        if (!node || typeof node !== 'object') return
        if (node.type === 'ObjectExpression' && node.properties.length > 3 && node.properties.every(property => property.type === 'Property' && /Function/.test(property.value?.type ?? ''))) {
            for (const property of node.properties) factories.push({ id: property.key.value ?? property.key.name, start: property.value.start, end: property.value.end })
            return
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit)
            else if (value && typeof value.type === 'string') visit(value)
        }
    }
    visit(program)
    const ranIn = (start, end) => { let ran = 0; for (let index = start; index < end; index += 1) ran += used[index]; return ran }
    // Identifying strings: data-* attributes and longer literals.
    const hintsIn = text => [...new Set([...text.matchAll(/"(data-[a-z-]+|[A-Za-z][A-Za-z0-9 ,.'’-]{18,60})"/g)].map(match => match[1]))].slice(0, 4)
    return factories.map(factory => {
        const text = source.slice(factory.start, factory.end)
        const node = findFactory(program, factory.start)
        // A scope-hoisted module inlines many source modules; list its top-level declarations.
        const parts = text.length > 50_000 && node?.body?.type === 'BlockStatement'
            ? node.body.body.flatMap(statement => statement.type === 'VariableDeclaration' ? statement.declarations : [statement])
                .filter(part => part.end - part.start > 2_000)
                .map(part => ({ bytes: part.end - part.start, ranBytes: ranIn(part.start, part.end), hints: hintsIn(source.slice(part.start, part.end)) }))
                .sort((a, b) => b.bytes - a.bytes).slice(0, 40)
            : undefined
        return { id: factory.id, bytes: text.length, ranBytes: ranIn(factory.start, factory.end), hints: hintsIn(text), parts }
    }).sort((a, b) => b.bytes - a.bytes).slice(0, 40)
}

// Self time per script and per function from a CPU profile (time is in the
// throttled page's terms: samples are taken on the slowed main thread).
function summarizeProfile(profile) {
    const byId = new Map(profile.nodes.map(node => [node.id, node]))
    const self = new Map()
    for (let index = 0; index < profile.samples.length; index += 1) {
        const delta = (profile.timeDeltas[index + 1] ?? 0) / 1000
        self.set(profile.samples[index], (self.get(profile.samples[index]) ?? 0) + delta)
    }
    const byScript = new Map()
    const byFunction = new Map()
    for (const [id, ms] of self) {
        const frame = byId.get(id).callFrame
        const script = frame.url ? frame.url.replace(/^.*\/_next\/static\/chunks\//, '').replace(/^https?:\/\/[^/]+/, '') : `(${frame.functionName || 'native'})`
        byScript.set(script, (byScript.get(script) ?? 0) + ms)
        const fn = `${frame.functionName || '(anonymous)'} ${script}:${frame.lineNumber}:${frame.columnNumber}`
        byFunction.set(fn, (byFunction.get(fn) ?? 0) + ms)
    }
    const top = (map, count) => [...map].sort((a, b) => b[1] - a[1]).slice(0, count).map(([name, ms]) => ({ name, ms: Math.round(ms) }))
    return { totalMs: Math.round([...self.values()].reduce((sum, ms) => sum + ms, 0)), byScript: top(byScript, 15), byFunction: top(byFunction, 25) }
}

function findFactory(program, start) {
    let found = null
    const visit = node => {
        if (found || !node || typeof node !== 'object') return
        if (node.start === start && /Function/.test(node.type)) { found = node; return }
        if (node.start > start || node.end < start) return
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit)
            else if (value && typeof value.type === 'string') visit(value)
        }
    }
    visit(program)
    return found
}

async function main() {
    if (!outputPath) throw new Error('Pass an output JSON path')
    const backend = createFakeBackend({ supabaseDelayMs: 30, redisDelayMs: 10 })
    await backend.listen(backendPort)
    const issuer = 'http://127.0.0.1:9/auth/v1'
    const cookies = Object.fromEntries(Object.entries(ACCOUNTS).map(([name, account]) => {
        const value = `base64-${Buffer.from(JSON.stringify(backend.sessionFor(account, issuer))).toString('base64url')}`
        return [name, `sb-127-auth-token=${value}; sb-localperformance-auth-token=present`]
    }))
    const env = {
        ...Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SHELL'].filter(key => process.env[key]).map(key => [key, process.env[key]])),
        NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-performance-placeholder',
        NEXT_PUBLIC_SUPABASE_PROJECT_ID: 'localperformance', SUPABASE_SERVICE_ROLE_KEY: 'local-performance-placeholder',
        NEXT_PUBLIC_SITE_URL: `http://localhost:${appPort}`, SENTRY_DSN: '', NEXT_PUBLIC_SENTRY_DSN: '',
        UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${backendPort}/redis`, UPSTASH_REDIS_REST_TOKEN: 'local-performance-placeholder',
        WEAVLY_FREE_SIGNING_KEY_ID: 'launch', WEAVLY_FREE_SIGNING_KEYS: JSON.stringify({ launch: 'local-performance-harness-key-0123456789abcdef' }),
        WEAVLY_FAKE_BACKEND_ORIGIN: `http://127.0.0.1:${backendPort}`,
        NODE_OPTIONS: `--require "${join(here, 'redirect-fetch.cjs')}"`,
    }
    const child = spawn(join(repo, 'node_modules/.bin/next'), ['start', '-p', String(appPort)], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] })
    const log = []
    child.stdout.on('data', chunk => log.push(chunk.toString()))
    child.stderr.on('data', chunk => log.push(chunk.toString()))
    const browser = await chromium.launch({ headless: true })
    const results = []
    try {
        for (let attempt = 0; !/Ready in/.test(log.join('')); attempt += 1) {
            if (attempt > 240 || child.exitCode !== null) throw new Error(`next start did not start: ${log.join('')}`)
            await new Promise(resolve => setTimeout(resolve, 250))
        }
        const base = `http://localhost:${appPort}`
        // Warm the server (route code, React caches) so samples time the phone, not the server.
        for (const route of routes) for (let pass = 0; pass < 2; pass += 1) await (await fetch(`${base}${route.path}`, { headers: { cookie: cookies[route.account] } })).text()
        for (const route of routes) {
            const runs = []
            const legacyRuns = []
            for (let index = 0; index < samples; index += 1) {
                if (compareLegacyQueue) legacyRuns.push(await measure(browser, base, cookies[route.account], route, { legacyQueue: true }))
                runs.push(await measure(browser, base, cookies[route.account], route))
            }
            const pick = field => median(runs.map(run => run[field]))
            const legacyQueue = compareLegacyQueue ? Object.fromEntries(['primaryUsable', 'totalBlockingTime', 'longestTask', 'lcp', 'jsBytes', 'mainThreadInLongTasks'].map(field => [field, median(legacyRuns.map(run => run[field]))])) : undefined
            if (legacyQueue) console.log(`      with legacy queue: usable ${legacyQueue.primaryUsable} TBT ${legacyQueue.totalBlockingTime} JS ${Math.round(legacyQueue.jsBytes / 1024)} KB`)
            const result = {
                account: route.account, path: route.path, note: route.note, status: runs.at(-1).status,
                fcpMs: pick('fcp'), lcpMs: pick('lcp'), primaryUsableMs: pick('primaryUsable'), loadMs: pick('load'),
                longTaskCount: pick('longTaskCount'), longestTaskMs: pick('longestTask'), totalBlockingTimeMs: pick('totalBlockingTime'),
                mainThreadInLongTasksMs: pick('mainThreadInLongTasks'), heapUsedMB: pick('heapUsedMB'),
                jsKB: Math.round(pick('jsBytes') / 1024), usedJsKB: Math.round(pick('usedBytes') / 1024),
                legacyQueue,
                marks: runs.at(-1).marks, scripts: runs.at(-1).scripts, profile: runs.at(-1).profile, samples: runs.map(run => Object.fromEntries(Object.entries(run).filter(([key]) => !['scripts', 'marks', 'profile'].includes(key)))),
            }
            results.push(result)
            console.log(`${route.account.padEnd(5)} ${route.path.padEnd(18)} ${result.status} FCP ${result.fcpMs} LCP ${result.lcpMs} usable ${result.primaryUsableMs} TBT ${result.totalBlockingTimeMs} longest ${result.longestTaskMs} tasks ${result.longTaskCount} JS ${result.jsKB} KB (${result.usedJsKB} KB ran)`)
        }
    } finally {
        await browser.close()
        child.kill('SIGTERM')
        await backend.close()
    }
    writeFileSync(outputPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        buildId: readFileSync(join(repo, '.next/BUILD_ID'), 'utf8').trim(),
        method: `Playwright Chromium (headless), 390x844 at 3x, touch, CPU slowed ${cpuSlowdown}x via CDP, no network throttling, fresh context (empty cache) per sample, ${samples} samples per route, medians. next start against the fake backend (30 ms per Supabase call), server warmed first. Long tasks are counted until no long task for 3 s; total blocking time counts tasks after FCP. JS bytes are uncompressed /_next/static scripts; "ran" is V8 block coverage during load.`,
        cpuSlowdown, samples, results,
    }, null, 2))
    console.log(`wrote ${outputPath}`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
