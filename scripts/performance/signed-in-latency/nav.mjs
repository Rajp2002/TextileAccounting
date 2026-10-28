#!/usr/bin/env node
// Clicking between Lite pages, and what the sidebar's prefetches cost the page
// an owner lands on after sign-in. Playwright Chromium against `next start`
// and the fake backend (run.mjs's build and fixtures), a fresh context per
// sample. Each sample opens /owner/estimator, records every RSC request (the
// sidebar's prefetches and the click's navigation request) with the backend
// calls the server made meanwhile, waits until the page is quiet, then clicks
// Saved Costings in the sidebar and times it to that page's own
// route_primary_usable mark (components/performance/route-milestones.tsx).
// Samples alternate between normal prefetching and prefetches blocked
// (requests carrying Next-Router-Prefetch are aborted), so both run under the
// same conditions.
//
//   node scripts/performance/signed-in-latency/nav.mjs <output.json> [--samples 5] [--cpu 4] [--viewport 1366x768]
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createFakeBackend } from './fake-backend.mjs'
import { ACCOUNTS } from './fixtures.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = resolve(here, '../../..')
const args = process.argv.slice(2)
const outputPath = args.find(arg => !arg.startsWith('--') && !/^[\dx]+$/.test(arg))
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`)
    return index >= 0 ? args[index + 1] : fallback
}
const samples = Number(option('samples', 5))
const cpuSlowdown = Number(option('cpu', 4))
const [width, height] = option('viewport', '1366x768').split('x').map(Number)
const backendPort = 54399
const appPort = 3012
const LANDING = '/owner/estimator'
const DESTINATION = { path: '/owner/quotes', navId: 'costings' }

const median = values => {
    const sorted = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b)
    if (!sorted.length) return null
    const middle = Math.floor(sorted.length / 2)
    return Math.round((sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10
}

const observerScript = () => {
    window.__nav = { longTasks: [] }
    new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__nav.longTasks.push({ start: entry.startTime, duration: entry.duration })
    }).observe({ type: 'longtask', buffered: true })
}

async function quiet(page, quietMs = 2500, maxMs = 30_000) {
    for (let waited = 0; waited < maxMs; waited += 250) {
        await page.waitForTimeout(250)
        const idle = await page.evaluate(() => performance.now() - Math.max(0, ...window.__nav.longTasks.map(task => task.start + task.duration)))
        if (idle > quietMs) return
    }
}

async function sample(browser, backend, base, cookie, { blockPrefetch }) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'en-IN', timezoneId: 'Asia/Kolkata' })
    await context.addCookies(cookie.split('; ').map(pair => {
        const [name, ...rest] = pair.split('=')
        return { name, value: rest.join('='), url: base }
    }))
    await context.addInitScript(observerScript)
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdown })
    const rsc = []
    const startedAt = Date.now()
    page.on('request', request => {
        const headers = request.headers()
        if (!headers.rsc && !request.url().includes('_rsc=')) return
        const entry = { url: request.url().replace(base, '').replace(/\?_rsc=.*$/, ''), prefetch: Boolean(headers['next-router-prefetch']), startMs: Date.now() - startedAt, endMs: null, bytes: null, aborted: false }
        rsc.push(entry)
        request.response().then(async response => {
            entry.endMs = Date.now() - startedAt
            try { entry.bytes = (await response?.body())?.length ?? null } catch {}
        }).catch(() => {})
    })
    if (blockPrefetch) {
        await page.route(() => true, route => {
            if (route.request().headers()['next-router-prefetch']) {
                const entry = rsc.find(item => item.url === route.request().url().replace(base, '').replace(/\?_rsc=.*$/, '') && item.prefetch && !item.aborted)
                if (entry) entry.aborted = true
                return route.abort()
            }
            return route.continue()
        })
    }
    backend.drainLog()
    await page.goto(`${base}${LANDING}`, { waitUntil: 'load', timeout: 120_000 })
    await quiet(page)
    const landing = await page.evaluate(() => {
        const tasks = window.__nav.longTasks
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
        return {
            usable: performance.getEntriesByName('route_primary_usable:/owner/estimator', 'mark')[0]?.startTime ?? null,
            totalBlockingTime: tasks.filter(task => task.start >= fcp).reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0),
            longestTask: tasks.length ? Math.max(...tasks.map(task => task.duration)) : 0,
        }
    })
    const landingCalls = backend.drainLog().filter(call => call.kind !== 'other')

    // Click Saved Costings and time it to that page's own "usable" mark.
    const link = page.locator(`a[data-nav-id="${DESTINATION.navId}"]:visible`).first()
    await link.waitFor({ timeout: 10_000 })
    // The first frame the URL shows the destination: the route has committed,
    // to its loading skeleton if one was prefetched, otherwise to the page.
    const clickAt = await page.evaluate(path => {
        window.__nav.urlAt = null
        const watch = () => {
            if (location.pathname === path) window.__nav.urlAt = performance.now()
            else requestAnimationFrame(watch)
        }
        requestAnimationFrame(watch)
        return performance.now()
    }, DESTINATION.path)
    await link.click()
    await page.waitForFunction(path => performance.getEntriesByName(`route_primary_usable:${path}`, 'mark').length > 0, DESTINATION.path, { timeout: 60_000 })
    const navigation = await page.evaluate(([path, clickedAt]) => {
        const mark = performance.getEntriesByName(`route_primary_usable:${path}`, 'mark')[0]
        return { clickToUsable: mark.startTime - clickedAt, clickToCommit: window.__nav.urlAt === null ? null : window.__nav.urlAt - clickedAt, url: location.pathname }
    }, [DESTINATION.path, clickAt])
    await page.waitForTimeout(300)
    const navigationCalls = backend.drainLog().filter(call => call.kind !== 'other')
    await context.close()
    const prefetches = rsc.filter(entry => entry.prefetch)
    return {
        blockPrefetch, landing, navigation,
        prefetchCount: prefetches.filter(entry => !entry.aborted).length,
        prefetchBytes: prefetches.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0),
        firstPrefetchStartMs: prefetches.length ? Math.min(...prefetches.map(entry => entry.startMs)) : null,
        landingBackendCalls: landingCalls.length,
        navigationBackendCalls: navigationCalls.length,
        rsc,
    }
}

async function main() {
    if (!outputPath) throw new Error('Pass an output JSON path')
    const backend = createFakeBackend({ supabaseDelayMs: 30, redisDelayMs: 10 })
    await backend.listen(backendPort)
    const issuer = 'http://127.0.0.1:9/auth/v1'
    const value = `base64-${Buffer.from(JSON.stringify(backend.sessionFor(ACCOUNTS.lite, issuer))).toString('base64url')}`
    const cookie = `sb-127-auth-token=${value}; sb-localperformance-auth-token=present`
    const env = {
        ...Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SHELL'].filter(key => process.env[key]).map(key => [key, process.env[key]])),
        NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-performance-placeholder',
        NEXT_PUBLIC_SUPABASE_PROJECT_ID: 'localperformance', SUPABASE_SERVICE_ROLE_KEY: 'local-performance-placeholder',
        NEXT_PUBLIC_SITE_URL: `http://localhost:${appPort}`, SENTRY_DSN: '', NEXT_PUBLIC_SENTRY_DSN: '',
        UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${backendPort}/redis`, UPSTASH_REDIS_REST_TOKEN: 'local-performance-placeholder',
        WEAVLY_FAKE_BACKEND_ORIGIN: `http://127.0.0.1:${backendPort}`,
        NODE_OPTIONS: `--require "${join(here, 'redirect-fetch.cjs')}"`,
    }
    const child = spawn(join(repo, 'node_modules/.bin/next'), ['start', '-p', String(appPort)], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] })
    const log = []
    child.stdout.on('data', chunk => log.push(chunk.toString()))
    child.stderr.on('data', chunk => log.push(chunk.toString()))
    const browser = await chromium.launch({ headless: true })
    const runs = []
    try {
        for (let attempt = 0; !/Ready in/.test(log.join('')); attempt += 1) {
            if (attempt > 240 || child.exitCode !== null) throw new Error(`next start did not start: ${log.join('')}`)
            await new Promise(resolve => setTimeout(resolve, 250))
        }
        const base = `http://localhost:${appPort}`
        for (const path of [LANDING, DESTINATION.path]) for (let pass = 0; pass < 2; pass += 1) await (await fetch(`${base}${path}`, { headers: { cookie } })).text()
        for (let index = 0; index < samples; index += 1) {
            for (const blockPrefetch of [false, true]) {
                const run = await sample(browser, backend, base, cookie, { blockPrefetch })
                runs.push(run)
                console.log(`${blockPrefetch ? 'blocked ' : 'prefetch'} landing usable ${Math.round(run.landing.usable)} TBT ${Math.round(run.landing.totalBlockingTime)} | prefetches ${run.prefetchCount} (${Math.round(run.prefetchBytes / 1024)} KB, first at ${run.firstPrefetchStartMs} ms) | landing backend calls ${run.landingBackendCalls} | click to commit ${Math.round(run.navigation.clickToCommit)} ms, to usable ${Math.round(run.navigation.clickToUsable)} ms, nav backend calls ${run.navigationBackendCalls}`)
            }
        }
    } finally {
        await browser.close()
        child.kill('SIGTERM')
        await backend.close()
    }
    const summarize = list => ({
        landingUsableMs: median(list.map(run => run.landing.usable)),
        landingTotalBlockingMs: median(list.map(run => run.landing.totalBlockingTime)),
        landingLongestTaskMs: median(list.map(run => run.landing.longestTask)),
        prefetchCount: median(list.map(run => run.prefetchCount)),
        prefetchKB: median(list.map(run => run.prefetchBytes / 1024)),
        firstPrefetchStartMs: median(list.map(run => run.firstPrefetchStartMs)),
        landingBackendCalls: median(list.map(run => run.landingBackendCalls)),
        clickToCommitMs: median(list.map(run => run.navigation.clickToCommit)),
        clickToUsableMs: median(list.map(run => run.navigation.clickToUsable)),
        navigationBackendCalls: median(list.map(run => run.navigationBackendCalls)),
    })
    const summary = { prefetch: summarize(runs.filter(run => !run.blockPrefetch)), blocked: summarize(runs.filter(run => run.blockPrefetch)) }
    console.log(JSON.stringify(summary, null, 2))
    writeFileSync(outputPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        buildId: readFileSync(join(repo, '.next/BUILD_ID'), 'utf8').trim(),
        method: `Playwright Chromium (headless), ${width}x${height}, CPU slowed ${cpuSlowdown}x, fresh context per sample, ${samples} samples per variant alternating normal prefetching and prefetches blocked. Lite owner lands on ${LANDING}, page left until no long task for 2.5 s, then Saved Costings is clicked in the sidebar and timed to the first frame showing its URL (commit) and to /owner/quotes's route_primary_usable mark. Prefetch requests are counted per segment request (Next 16 fetches route segments separately). next start against the fake backend (30 ms per Supabase call), server warmed first.`,
        cpuSlowdown, samples, summary, runs,
    }, null, 2))
    console.log(`wrote ${outputPath}`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
