#!/usr/bin/env node
// Checks that the browser still reports errors to Sentry: opens /login in
// Playwright Chromium against `next start` (built with the harness DSN, see
// sentry-check.mjs), throws an error on the page, then forces the global error
// boundary with a failed plan read, and counts the browser envelopes the
// SDK posts, through the /monitoring tunnel or straight to the DSN's envelope
// endpoint (the SDK only tunnels sentry.io DSNs). Both are answered here and
// never leave the machine. Exits non-zero if no error event is sent.
//   node scripts/performance/signed-in-latency/sentry-browser-check.mjs
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createFakeBackend } from './fake-backend.mjs'
import { ACCOUNTS } from './fixtures.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = resolve(here, '../../..')
const appPort = 3012
const backendPort = 54399
const backend = createFakeBackend({ supabaseDelayMs: 5, redisDelayMs: 2 })
await backend.listen(backendPort)
const env = {
    ...Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SHELL'].filter(key => process.env[key]).map(key => [key, process.env[key]])),
    NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-performance-placeholder',
    NEXT_PUBLIC_SUPABASE_PROJECT_ID: 'localperformance', SUPABASE_SERVICE_ROLE_KEY: 'local-performance-placeholder',
    NEXT_PUBLIC_SITE_URL: `http://localhost:${appPort}`,
    SENTRY_AUTH_TOKEN: '', SENTRY_ORG: '', SENTRY_PROJECT: '',
    NEXT_PUBLIC_SENTRY_DSN: `http://public@127.0.0.1:${backendPort}/1`,
    UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${backendPort}/redis`, UPSTASH_REDIS_REST_TOKEN: 'local-performance-placeholder',
    WEAVLY_FAKE_BACKEND_ORIGIN: `http://127.0.0.1:${backendPort}`,
    NODE_OPTIONS: `--require "${join(here, 'redirect-fetch.cjs')}"`,
}
const child = spawn(join(repo, 'node_modules/.bin/next'), ['start', '-p', String(appPort)], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] })
const log = []
child.stdout.on('data', chunk => log.push(chunk.toString()))
child.stderr.on('data', chunk => log.push(chunk.toString()))
let browser
try {
    browser = await chromium.launch({ headless: true })
    for (let attempt = 0; !/Ready in/.test(log.join('')); attempt += 1) {
        if (attempt > 240 || child.exitCode !== null) throw new Error(`next start did not start: ${log.join('')}`)
        await new Promise(resolve => setTimeout(resolve, 250))
    }
    // The app's CSP allows only Sentry's hosts, and a non-sentry.io DSN is not
    // tunnelled, so the harness DSN's endpoint would be blocked before it can be
    // intercepted. Production DSNs go through /monitoring and are unaffected.
    const context = await browser.newContext({ bypassCSP: true, serviceWorkers: 'block' })
    const page = await context.newPage()
    const items = []
    const urls = new Set()
    await page.route(/\/monitoring(\?|$)|\/envelope\/?(\?|$)/, async route => {
        urls.add(new URL(route.request().url()).pathname)
        const body = route.request().postData() ?? ''
        for (const line of body.split('\n')) {
            try { const header = JSON.parse(line); if (header.type) items.push(header.type) } catch {}
        }
        await route.fulfill({ status: 200, body: '{}' })
    })
    await page.goto(`http://localhost:${appPort}/login`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)
    await page.evaluate(() => setTimeout(() => { throw new Error('harness browser error check') }, 0))
    await page.waitForTimeout(4000)
    const count = type => items.filter(item => item === type).length
    const unhandledEvents = count('event')
    const session = backend.sessionFor(ACCOUNTS.lite, 'http://127.0.0.1:9/auth/v1')
    await context.addCookies([
        { name: 'sb-127-auth-token', value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`, url: `http://localhost:${appPort}` },
        { name: 'sb-localperformance-auth-token', value: 'present', url: `http://localhost:${appPort}` },
    ])
    backend.failRest = url => url.searchParams.get('select')?.startsWith('base_plan_visible')
    await page.goto(`http://localhost:${appPort}/owner/rates`, { waitUntil: 'load' })
    await page.getByText('Application error:', { exact: false }).waitFor()
    await page.waitForTimeout(4000)
    const boundaryEvents = count('event') - unhandledEvents
    console.log(`browser reporting paths: ${unhandledEvents} unhandled error events, ${boundaryEvents} global-boundary error events`)
    console.log(`browser envelopes (${[...urls].join(', ') || 'none sent'}): ${count('event')} error events, ${count('transaction')} transactions (${items.join(', ') || 'none'})`)
    if (!unhandledEvents || !boundaryEvents) process.exitCode = 1
} finally {
    await browser?.close()
    child.kill('SIGTERM')
    await backend.close()
}
