// Usage: node run-tour.mjs <scenario>[?key=value&…] <lang> <width>x<height> [outdir] [launcherSelector]
// A variant such as 'quotes?tier=lite' (quote it in the shell) passes tier=lite as its own URL parameter.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(process.env.PLAYWRIGHT_ROOT ?? '/opt/node22/lib/node_modules/')
const { chromium } = require('playwright')
const [scenario = 'production', lang = 'en', size = '1440x900', outRoot = 'out', launcher = '[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]'] = process.argv.slice(2)
const [width, height] = size.split('x').map(Number)
const [scenarioName, scenarioQuery = ''] = scenario.split('?')
const out = `${outRoot}/${scenario.replace(/[^A-Za-z0-9-]+/g, '_')}-${lang}-${size}`
mkdirSync(out, { recursive: true })
const browser = await chromium.launch(process.env.CHROMIUM_PATH === '' ? {} : { executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const mobile = width < 768
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile, reducedMotion: process.env.REDUCED_MOTION === '1' ? 'reduce' : 'no-preference' })
const page = await context.newPage()
const logs = []
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`) })
page.on('pageerror', e => logs.push('pageerror: ' + e.message))
await page.goto(`http://localhost:5199/?s=${encodeURIComponent(scenarioName)}${scenarioQuery ? `&${scenarioQuery}` : ''}&lang=${lang}&fresh=1`)
await page.waitForFunction(() => window.__harnessReady || window.__harnessError, null, { timeout: 60000 })
await page.waitForTimeout(1200)
await page.screenshot({ path: `${out}/00-page.png` })
const button = page.locator(launcher).first()
const record = { scenario, lang, size, steps: [], logs }
if (!(await button.count())) { record.error = 'launcher not found'; writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2)); await browser.close(); process.exit(0) }
await button.scrollIntoViewIfNeeded(); await button.click()
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(900)
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
      progress: bar ? `${bar.getAttribute('aria-valuenow')}/${bar.getAttribute('aria-valuemax')}` : null,
      panel: pr, highlight: hr, overlapArea: overlap,
      panelOffscreen: pr ? (pr.y < 0 || pr.y + pr.h > innerHeight || pr.x < 0 || pr.x + pr.w > innerWidth) : null,
      descriptionScrollable: desc ? desc.scrollHeight > desc.clientHeight + 1 : null,
      activeElement: active ? `${active.tagName.toLowerCase()}${active.getAttribute('data-tour-control') ? '[' + active.getAttribute('data-tour-control') + ']' : ''}${active.getAttribute('role') ? '(role=' + active.getAttribute('role') + ')' : ''}` : null,
      scrollY: Math.round(scrollY), serverCalls: (window.__serverCalls || []).length,
      liveHidden: !!document.querySelector('[data-harness-live]')?.closest('[hidden]'),
      rail: (() => { const e = Array.from(document.querySelectorAll('aside')).find(a => /left-rail/.test(a.className) && getComputedStyle(a).position === 'fixed' && a.getBoundingClientRect().width > 0); return r(e) })(),
      vh: innerHeight, vw: innerWidth,
      // Rail overlap cannot be measured by hit-testing (the page is inert during a tour); judge it from screenshots.
    }
  })
  if (!info) break
  record.steps.push(info)
  await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, '0')}.png` })
  const next = page.locator('.guided-tour-panel [data-tour-control="next"]').first()
  if (!(await next.count()) || await next.isDisabled()) { record.stoppedAt = i + 1; break }
  await next.click()
}
record.after = await page.evaluate(() => ({ active: document.activeElement?.outerHTML?.slice(0, 160), serverCalls: window.__serverCalls || [], navigations: window.__navigations || [], prefs: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('weavly:tour'))) }))
await page.screenshot({ path: `${out}/99-after.png` })
writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
console.log(JSON.stringify({ scenario, lang, size, steps: record.steps.length, logs: logs.slice(0, 8) }))
await browser.close()
