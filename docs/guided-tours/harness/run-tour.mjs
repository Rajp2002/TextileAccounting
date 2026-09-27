// Usage: node run-tour.mjs <scenario>[?key=value&…] <lang> <width>x<height> [outdir] [launcherSelector]
// A variant such as 'quotes?tier=lite' (quote it in the shell) passes tier=lite as its own URL parameter.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(process.env.PLAYWRIGHT_ROOT ?? '/opt/node22/lib/node_modules/')
const { chromium } = require('playwright')
const [scenario = 'production', lang = 'en', size = '1440x900', outRoot = process.env.TOUR_OUT_DIR ?? 'out', launcher = '[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]'] = process.argv.slice(2)
const [width, height] = size.split('x').map(Number)
const [scenarioName, scenarioQuery = ''] = scenario.split('?')
// Opt-in for the owner-approved five-case Estimator baseline refresh.
const settledSampling = process.env.SETTLED_SAMPLING === '1'
const out = `${outRoot}/${scenario.replace(/[^A-Za-z0-9-]+/g, '_')}-${lang}-${size}`
mkdirSync(out, { recursive: true })
const browser = await chromium.launch(process.env.CHROMIUM_PATH === '' ? {} : { executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const mobile = width < 768
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile, reducedMotion: process.env.REDUCED_MOTION === '1' ? 'reduce' : 'no-preference' })
if (scenarioName === 'foundation') await context.addInitScript(() => {
  window.__foundationScrollCalls = []
  for (const owner of [window, HTMLElement.prototype]) for (const name of ['scrollTo', 'scrollBy']) {
    const original = owner[name]
    owner[name] = function (...args) {
      window.__foundationScrollCalls.push({ owner: this === window ? 'window' : 'element', method: name, behavior: typeof args[0] === 'object' ? args[0].behavior : undefined })
      return original.apply(this, args)
    }
  }
})
const page = await context.newPage()
const logs = []
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`) })
page.on('pageerror', e => logs.push('pageerror: ' + e.message))
await page.goto(`http://localhost:5199/?s=${encodeURIComponent(scenarioName)}${scenarioQuery ? `&${scenarioQuery}` : ''}&lang=${lang}&fresh=1`)
await page.waitForFunction(() => window.__harnessReady || window.__harnessError, null, { timeout: 60000 })
await page.waitForTimeout(1200)
await page.screenshot({ path: `${out}/00-page.png` })
const button = page.locator(launcher).filter({ visible: true }).first()
const record = { scenario, lang, size, steps: [], logs, sampling: settledSampling ? 'settled-geometry' : 'legacy-900ms' }
if (!(await button.count())) { record.error = 'launcher not found'; writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2)); await browser.close(); process.exit(0) }
await button.scrollIntoViewIfNeeded()
record.before = await page.evaluate(() => ({ x: scrollX, y: scrollY, inner: document.querySelector('[data-foundation-scroller]')?.scrollTop ?? null }))
await button.click()
if (scenarioName === 'foundation') {
  await page.waitForSelector('[data-testid="guided-tour-panel"]')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
}
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(900)
  if (scenarioName === 'foundation') await page.waitForFunction(() => {
    const panel = document.querySelector('.guided-tour-panel')
    return !panel || panel.getAttribute('data-tour-status') !== 'preparing'
  }, null, { timeout: 2000 })
  // Legacy Estimator schedules late rect updates and 500ms CSS transitions.
  // A fixed delay can sample midway through them. Observe normal-motion geometry
  // without changing styles, firing resize events or hiding existing overlaps.
  let settlement
  if (settledSampling) {
    try {
      settlement = await page.evaluate(async () => {
        await document.fonts.ready
        return new Promise((resolve, reject) => {
          const start = performance.now()
          let previous = '', stableSince = start, frame
          const timeout = setTimeout(() => {
            cancelAnimationFrame(frame)
            reject(new Error('Tour geometry did not settle within 8000ms'))
          }, 8000)
          const sample = () => {
            const panel = document.querySelector('.guided-tour-panel')
            if (!panel) { clearTimeout(timeout); resolve(null); return }
            const geometry = element => {
              const rect = element.getBoundingClientRect()
              return [rect.x, rect.y, rect.width, rect.height].map(n => Math.round(n * 100) / 100)
            }
            const elements = [panel, ...document.querySelectorAll('.guided-tour-highlight')]
            const scroll = [...document.querySelectorAll('*')]
              .filter(e => e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth)
              .map(e => [e.scrollLeft, e.scrollTop])
            const current = JSON.stringify([scrollX, scrollY, panel.textContent, elements.map(geometry), scroll])
            const moving = document.getAnimations().some(animation =>
              animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity)
            const now = performance.now()
            if (current !== previous || moving) { previous = current; stableSince = now }
            if (now - start >= 1500 && now - stableSince >= 500) {
              clearTimeout(timeout)
              resolve({ elapsedMs: Math.round(now - start), stableMs: Math.round(now - stableSince) })
            } else frame = requestAnimationFrame(sample)
          }
          frame = requestAnimationFrame(sample)
        })
      })
    } catch (error) {
      record.error = String(error)
      writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
      await browser.close()
      throw error
    }
  }
  const info = await page.evaluate(() => {
    const panel = document.querySelector('.guided-tour-panel')
    if (!panel) return null
    const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) } }
    const hl = document.querySelector('.guided-tour-highlight')
    const pr = r(panel), hr = r(hl)
    const overlap = pr && hr ? Math.max(0, Math.min(pr.x + pr.w, hr.x + hr.w) - Math.max(pr.x, hr.x)) * Math.max(0, Math.min(pr.y + pr.h, hr.y + hr.h) - Math.max(pr.y, hr.y)) : 0
    const bar = panel.querySelector('[role="progressbar"]')
    const desc = panel.querySelector('[data-tour-description-scroll]')
    const active = document.activeElement
    return {
      title: panel.querySelector('h2')?.textContent, body: panel.querySelector('h2 + p')?.textContent?.slice(0, 400),
      step: panel.getAttribute('data-tour-step'), status: panel.getAttribute('data-tour-status'), eyebrow: panel.querySelector('[data-tour-eyebrow]')?.textContent,
      progress: bar ? `${bar.getAttribute('aria-valuenow')}/${bar.getAttribute('aria-valuemax')}` : null,
      panel: pr, highlight: hr, overlapArea: overlap,
      panelOffscreen: pr ? (pr.y < 0 || pr.y + pr.h > innerHeight || pr.x < 0 || pr.x + pr.w > innerWidth) : null,
      descriptionScrollable: desc ? desc.scrollHeight > desc.clientHeight + 1 : null,
      activeElement: active ? `${active.tagName.toLowerCase()}${active.getAttribute('data-tour-control') ? '[' + active.getAttribute('data-tour-control') + ']' : ''}${active.getAttribute('role') ? '(role=' + active.getAttribute('role') + ')' : ''}` : null,
      scrollY: Math.round(scrollY), serverCalls: (window.__serverCalls || []).length,
      liveHidden: !!document.querySelector('[data-harness-live]')?.closest('[hidden]'),
      focusInPanel: panel.contains(active),
      innerScroll: document.querySelector('[data-foundation-scroller]')?.scrollTop ?? null,
      rail: (() => { const e = Array.from(document.querySelectorAll('aside')).find(a => /left-rail/.test(a.className) && getComputedStyle(a).position === 'fixed' && a.getBoundingClientRect().width > 0); return r(e) })(),
      vh: innerHeight, vw: innerWidth,
      // Rail overlap cannot be measured by hit-testing (the page is inert during a tour); judge it from screenshots.
    }
  })
  if (!info) break
  if (scenarioName === 'foundation' && info.step === 'centre') {
    const back = page.locator('[data-tour-control="back"]')
    await back.focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector('.guided-tour-panel')?.getAttribute('data-tour-step') === 'top-left')
    record.backFocus = await page.evaluate(() => document.activeElement?.getAttribute('data-tour-control'))
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => {
      const panel = document.querySelector('.guided-tour-panel')
      return panel?.getAttribute('data-tour-step') === 'centre' && panel.getAttribute('data-tour-status') === 'ready'
    })
  }
  if (scenarioName === 'foundation') await page.waitForFunction(() =>
    document.querySelector('.guided-tour-portal')?.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running'))
  if (settledSampling) info.settlement = settlement
  record.steps.push(info)
  await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, '0')}.png` })
  const next = page.locator('.guided-tour-panel [data-tour-control="next"]').first()
  if (!(await next.count()) || await next.isDisabled()) { record.stoppedAt = i + 1; break }
  if (scenarioName === 'foundation' && info.step === 'dialog') {
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.guided-tour-panel'))
    break
  }
  await next.click()
}
record.after = await page.evaluate(() => ({ scroll: { x: scrollX, y: scrollY, inner: document.querySelector('[data-foundation-scroller]')?.scrollTop ?? null }, active: document.activeElement?.outerHTML?.slice(0, 160), serverCalls: window.__serverCalls || [], navigations: window.__navigations || [], scrollCalls: window.__foundationScrollCalls || [], prefs: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('weavly:tour'))) }))
await page.screenshot({ path: `${out}/99-after.png` })
writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
if (scenarioName === 'foundation') {
  const issues = []
  if (record.backFocus !== 'next') issues.push('Back removal did not focus Next')
  if (process.env.REDUCED_MOTION === '1' && record.after.scrollCalls.some(call => call.behavior === 'smooth')) issues.push('reduced motion used smooth scrolling')
  if (record.steps.length !== 6) issues.push('expected all six steps')
  for (const step of record.steps) {
    if (step.status !== 'ready') issues.push(`${step.step}: ${step.status}`)
    if (step.overlapArea > 0) issues.push(`${step.step}: panel/outline overlap ${step.overlapArea}`)
    if (!step.focusInPanel) issues.push(`${step.step}: focus outside panel`)
    const h = step.highlight
    if (!h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(`${step.step}: outline not fully on screen`)
  }
  const inner = record.steps.find(step => step.step === 'scroller')
  const beforeInner = record.steps.find(step => step.step === 'bottom-edge')
  if (!inner || inner.innerScroll <= record.before.inner || inner.scrollY !== beforeInner?.scrollY) issues.push('container step did not scroll only its container')
  if (JSON.stringify(record.before) !== JSON.stringify(record.after.scroll)) issues.push('scroll not restored')
  if (!record.after.active?.includes('data-tour-control="take-tour"')) issues.push('focus not restored to launcher')
  record.issues = issues
  writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}
console.log(JSON.stringify({ scenario, lang, size, steps: record.steps.length, logs: logs.slice(0, 8) }))
await browser.close()
