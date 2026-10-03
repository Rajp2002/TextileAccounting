// How smooth is the overlay while the next page loads and hydrates behind it?
//
//   TARGET=/ THROTTLE=4 RUNS=4 node docs/performance/auth-transition-harness/frame-gaps.mjs
//
// Hands the real sign-in overlay to TARGET with a full 1600 ms round, then records the gap between
// animation frames (requestAnimationFrame) and the main-thread long tasks for as long as the
// overlay is up. CPU throttling makes a laptop behave like a slower phone. It compares the
// overlay's current look with VARIANT_CSS applied on top (default: the previous see-through, blurred
// look), run alternately on the same page.
//
// What it showed (2026-10-03, landing page, 4x): both looks drew the same ~5 frames with the same gaps
// and ~3.3 s of long tasks. The animation stalls because the main thread is busy, not because of
// transparency or blur. Replace VARIANT_CSS to test other ideas.
import { BASE_URL, launch, captureSignInOverlay } from './common.mjs'

const TARGET = process.env.TARGET || '/'
const THROTTLE = Number(process.env.THROTTLE || 4)
const RUNS = Number(process.env.RUNS || 4)
const VARIANT_CSS = process.env.VARIANT_CSS
    || '.auth-transition[data-resumed][data-mode="sign-in"]{background:color-mix(in srgb,var(--wv-bg-canvas) 90%,transparent)!important;-webkit-backdrop-filter:blur(6px)!important;backdrop-filter:blur(6px)!important;will-change:auto!important}'

function probe(variantCss) {
    window.__frames = []
    window.__long = []
    if (variantCss) {
        new MutationObserver((_, observer) => {
            if (!document.head) return
            const style = document.createElement('style')
            style.textContent = variantCss
            document.head.appendChild(style)
            observer.disconnect()
        }).observe(document, { childList: true, subtree: true })
    }
    try { new PerformanceObserver((list) => list.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] }) } catch { /* not supported */ }
    let last = null
    let started = false
    const tick = (t) => {
        const up = !!document.querySelector('body > weavly-handoff > .auth-transition:not([data-state="closed"])')
        if (up) { started = true; if (last !== null) window.__frames.push(Math.round(t - last)); last = t }
        else if (started) { window.__done = true; return }
        if (t < 9000) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
}

async function once(browser, useVariant) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await context.addInitScript(probe, useVariant ? VARIANT_CSS : null)
    const page = await context.newPage()
    await page.goto(BASE_URL + TARGET, { waitUntil: 'load' }) // compile and warm the target
    const { html } = await captureSignInOverlay(page, { waitMs: 250 })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
    await page.evaluate(([markup, to]) => {
        sessionStorage.setItem('weavly:auth-handoff', JSON.stringify({ html: markup, startedAt: Date.now() }))
        location.replace(to)
    }, [html, TARGET])
    await page.waitForFunction(() => window.__done === true, null, { timeout: 40000 })
    const frames = await page.evaluate(() => window.__frames)
    const long = await page.evaluate(() => window.__long)
    await context.close()
    const gaps = frames.slice(1)
    const over = (ms) => gaps.filter((g) => g > ms).length
    return { frames: frames.length, maxGap: Math.max(...gaps), over33: over(33), over50: over(50), over100: over(100), longTasks: long.length, longMs: long.reduce((a, b) => a + b, 0) }
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

;(async () => {
    const browser = await launch()
    const results = { current: [], variant: [] }
    for (let i = 0; i < RUNS; i++) {
        results.current.push(await once(browser, false))
        results.variant.push(await once(browser, true))
    }
    await browser.close()
    console.log(`target ${TARGET}, CPU throttle ${THROTTLE}x, ${RUNS} runs each (frames = animation frames while the overlay was up)`)
    for (const name of ['current', 'variant']) {
        const m = (key) => median(results[name].map((r) => r[key]))
        console.log(`${name.padEnd(8)} median: frames ${m('frames')}, longest gap ${m('maxGap')} ms, gaps>33ms ${m('over33')}, >50ms ${m('over50')}, >100ms ${m('over100')}, long tasks ${m('longTasks')} (${m('longMs')} ms)`)
    }
})().catch((e) => { console.error(e); process.exit(1) })
