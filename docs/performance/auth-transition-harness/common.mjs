// Shared setup for the auth-transition browser checks.
// Context and usage: docs/performance/auth-transition-stutter-handoff.md
//
// These drive headless Chromium against a local `next dev --webpack -p 3011`.
// They never sign in: the sign-in request is held in the browser and never sent,
// so no credentials or Supabase project are involved.
import { createRequire } from 'node:module'

// Playwright is not a project dependency; this is the copy bundled with the Codex runtime on the
// owner's Mac (see the tour-harness note in the project memory). Override with the env vars.
const PLAYWRIGHT_ROOT = process.env.PLAYWRIGHT_ROOT
    || '/Users/rajpatel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/'
const CHROMIUM_PATH = process.env.CHROMIUM_PATH
    || `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1234/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'

const { chromium } = createRequire(PLAYWRIGHT_ROOT)('playwright')

export const launch = () => chromium.launch({ executablePath: CHROMIUM_PATH, headless: true })

/**
 * Opens the real sign-in overlay on /login and returns its markup (what the app stores as the
 * handoff) with the epoch time of the click. The sign-in request is held, so nothing is sent.
 */
export async function captureSignInOverlay(page, { waitMs = 300 } = {}) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'load' })
    await page.waitForSelector('#email', { state: 'attached' })
    await page.route('**/login', (route) => (route.request().method() === 'POST' ? undefined : route.continue()))
    await page.fill('#email', 'qa@example.test', { force: true })
    await page.fill('#password', 'placeholder-only', { force: true })
    const clickEpoch = await page.evaluate(() => Date.now())
    await page.click('#login-btn')
    await page.waitForSelector('body > .auth-transition', { state: 'attached' })
    await page.waitForTimeout(waitMs)
    const html = await page.evaluate(() => document.querySelector('body > .auth-transition').outerHTML)
    return { html, clickEpoch }
}

/** Stores the handoff exactly as `captureAuthHandoff` does, then does the full-page navigation. */
export async function handOff(page, { html, startedAt, to }) {
    await page.evaluate(([markup, started, target]) => {
        sessionStorage.setItem('weavly:auth-handoff', JSON.stringify({ html: markup, startedAt: started }))
        location.replace(target)
    }, [html, startedAt, to])
}
