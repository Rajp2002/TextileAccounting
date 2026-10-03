// Does the next page resume the sign-in overlay correctly?
//
//   node docs/performance/auth-transition-harness/handoff-check.mjs
//
// For each leave time it opens the real sign-in overlay on /login, hands it to TARGET with a
// full-page navigation, and samples every animation frame of the new page. It reports whether the
// overlay is on the new page's FIRST frame, which animation frame it resumed on, when it closes
// (the round is 1600 ms after the click), and whether React hydrated the page while the overlay
// was still up, with any console or hydration errors.
//
// Env: TARGET (default /signup), LEAVES (default 300,600,900), FRESH_ROUND=1 (give the new page a
// full round instead of what is left, which forces hydration to overlap the overlay).
//
// Pitfall: `next dev` hydrates slowly, so with the normal timing React often hydrates AFTER the
// overlay has gone and a run reports "no errors" even if the overlay breaks hydration. Use
// FRESH_ROUND=1 and check the "hydrated while overlay up" line.
import { BASE_URL, launch, captureSignInOverlay, handOff } from './common.mjs'

const TARGET = process.env.TARGET || '/signup'
const LEAVES = (process.env.LEAVES || '300,600,900').split(',').map(Number)
const FRESH_ROUND = process.env.FRESH_ROUND === '1'

// Runs in every document from the start (Playwright serializes it: it cannot use closure variables).
function sampler() {
    window.__samples = []
    const sample = () => {
        const overlay = document.querySelector('body > weavly-handoff > .auth-transition')
        let anim = null
        if (overlay) {
            const loop = overlay.getAnimations({ subtree: true }).find((a) => a.effect.getComputedTiming().iterations === Infinity)
            anim = loop ? Math.round(loop.currentTime) : null
        }
        const field = document.querySelector('input')
        window.__samples.push({
            t: Math.round(performance.timeOrigin + performance.now()),
            present: !!overlay,
            state: overlay ? overlay.getAttribute('data-state') : null,
            resumed: overlay ? overlay.hasAttribute('data-resumed') : null,
            opacity: overlay ? Number(getComputedStyle(overlay).opacity).toFixed(2) : null,
            anim,
            hydrated: !!field && Object.keys(field).some((k) => k.startsWith('__reactFiber')),
        })
        if (performance.now() < 4500) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
}

async function run(browser, leaveAfterMs) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await context.addInitScript(sampler)
    const page = await context.newPage()
    const problems = []
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.replace(/\s+/g, ' ').slice(0, 300)}`))
    page.on('console', (m) => {
        // A 403 on a plain /signup load is pre-existing and unrelated.
        if (['error', 'warning'].includes(m.type()) && !/403/.test(m.text())) problems.push(`${m.type()}: ${m.text().replace(/\s+/g, ' ').slice(0, 300)}`)
    })
    await page.goto(BASE_URL + TARGET, { waitUntil: 'load' }) // compile and warm the target
    const { html, clickEpoch } = await captureSignInOverlay(page, { waitMs: leaveAfterMs })
    const startedAt = FRESH_ROUND ? Date.now() : clickEpoch
    await handOff(page, { html, startedAt, to: TARGET })
    await page.waitForURL(`**${TARGET}`, { waitUntil: 'commit' })
    await page.waitForTimeout(3200)
    const samples = await page.evaluate(() => window.__samples)
    const stored = await page.evaluate(() => sessionStorage.getItem('weavly:auth-handoff'))
    await context.close()

    const first = samples[0]
    const closing = samples.find((s) => s.state === 'closed')
    const shown = samples.find((s) => s.present)
    const gone = shown ? samples.slice(samples.indexOf(shown)).find((s) => !s.present) : null
    const hydrated = samples.find((s) => s.hydrated)
    console.log(`\n== left at ~${leaveAfterMs} ms${FRESH_ROUND ? ' (new page gets a full round)' : ''}`)
    console.log('  overlay on the first frame   :', !!first?.present, first?.present ? `(resumed ${first.resumed}, opacity ${first.opacity}, animation at ${first.anim} ms, ${first.t - clickEpoch} ms after click)` : '')
    console.log('  starts closing               :', closing ? `${closing.t - startedAt} ms after the round began (round = 1600)` : 'never')
    console.log('  removed                      :', gone ? `${gone.t - startedAt} ms` : 'never')
    console.log('  storage cleaned up           :', stored === null)
    console.log('  React hydrated underneath    :', hydrated ? `${hydrated.t - clickEpoch} ms after click; overlay still up: ${hydrated.present && hydrated.state !== 'closed'}` : 'not seen')
    console.log('  errors                       :', problems.length ? problems : 'none')
}

;(async () => {
    const browser = await launch()
    for (const leave of LEAVES) await run(browser, leave)
    await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
