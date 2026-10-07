// Usage: node run-tour.mjs <scenario>[?key=value&…] <lang> <width>x<height> [outdir] [launcherSelector]
// A variant such as 'quotes?tier=lite' (quote it in the shell) passes tier=lite as its own URL parameter.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(process.env.PLAYWRIGHT_ROOT ?? '/opt/node22/lib/node_modules/')
const { chromium } = require('playwright')
const [scenario = 'production', lang = 'en', size = '1440x900', outRoot = process.env.TOUR_OUT_DIR ?? 'out', launcher = '[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]'] = process.argv.slice(2)
const [width, height] = size.split('x').map(Number)
const [scenarioName, scenarioQuery = ''] = scenario.split('?')
const dispatch = scenarioName === 'dispatch'
const fabricStock = scenarioName === 'fabric-stock'
const yarnStock = scenarioName === 'yarn-stock'
const stock = fabricStock || yarnStock
const production = scenarioName === 'production'
const payroll = ['payroll', 'payroll-extra'].includes(scenarioName)
const payrollExtra = scenarioName === 'payroll-extra'
const dailySheet = scenarioName === 'daily-sheet'
const assignments = scenarioName === 'assignments'
const machines = scenarioName === 'machines'
const workers = ['workers', 'workers-salary'].includes(scenarioName)
const workersPath = scenarioName === 'workers-salary' ? 'salary' : 'piece'
const rateBook = ['rates', 'rates-populated'].includes(scenarioName)
const rateBookNoRows = (scenarioName === 'rates' && new URLSearchParams(scenarioQuery).get('demoDeleted') === '1') || (scenarioName === 'rates-populated' && new URLSearchParams(scenarioQuery).get('archivedOnly') === '1')
const rateBookPopulated = scenarioName === 'rates-populated' && !rateBookNoRows
const savedCostings = ['quotes', 'quotes-compare', 'free-costings'].includes(scenarioName)
const estimator = ['estimator', 'free-estimator'].includes(scenarioName)
// Opt-in for the owner-approved five-case Estimator baseline refresh.
const settledSampling = process.env.SETTLED_SAMPLING === '1'
const out = `${outRoot}/${scenario.replace(/[^A-Za-z0-9-]+/g, '_')}-${lang}-${size}`
mkdirSync(out, { recursive: true })
const browser = await chromium.launch(process.env.CHROMIUM_PATH === '' ? {} : { executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const mobile = width < 768
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile, reducedMotion: process.env.REDUCED_MOTION === '1' ? 'reduce' : 'no-preference' })
if (scenarioName === 'foundation' || dispatch || workers || machines || assignments || production || payroll || dailySheet || stock) await context.addInitScript(() => {
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
if (savedCostings) await page.route('**/api/free/costings*', route => route.fulfill({ json: { costings: [], nextPage: null } }))
const logs = []
const apiRequests = []
page.on('request', request => {
  if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push({ url: request.url(), method: request.method() })
})
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`) })
page.on('pageerror', e => logs.push('pageerror: ' + e.message))
await page.goto(`http://localhost:5199/?s=${encodeURIComponent(scenarioName)}${scenarioQuery ? `&${scenarioQuery}` : ''}&lang=${lang}&fresh=1`)
await page.waitForFunction(() => window.__harnessReady || window.__harnessError, null, { timeout: 60000 })
await page.waitForTimeout(1200)
if (dispatch) {
  await page.locator('[data-harness-dispatch-live] input').first().fill('Retained search')
  await page.evaluate(() => { window.__dispatchSearchNode = document.querySelector('[data-harness-dispatch-live] input') })
}
if (fabricStock) {
  await page.locator('#stock-search').fill('Retained')
  await page.evaluate(() => { window.__fabricSearchNode = document.querySelector('#stock-search') })
}
if (yarnStock) {
  await page.locator('#yarn-audit-date').fill('2026-09-14')
  await page.evaluate(() => { window.__yarnDateNode = document.querySelector('#yarn-audit-date') })
}
if (payroll) {
  await page.locator('#base-payroll-search').fill('Retained payroll')
  await page.evaluate(() => { window.__payrollSearchNode = document.querySelector('#base-payroll-search') })
}
if (production) {
  const board = page.locator('[data-harness-production-live] section').filter({ has: page.locator('input') }).last()
  await board.locator('input').first().fill('Retained search')
  await board.locator('button').nth(2).click()
  await page.evaluate(() => {
    window.__productionSearchNode = document.querySelector('[data-harness-production-live] section input')
  })
}
if (!rateBook && process.env.PRE_CLICK) await page.locator(process.env.PRE_CLICK).filter({ visible: true }).first().click()
if (dailySheet) {
  const reading = page.locator('[data-base-machine-meters]:enabled').first()
  if (await reading.count()) {
    await reading.fill(process.env.PRE_TYPE ?? '37.5')
    await page.waitForFunction(() => Object.entries(localStorage).some(([key, value]) => key.startsWith('weavly:base-production:') && value.includes(document.querySelector('[data-base-machine-meters]')?.value)))
  }
  await page.evaluate(() => { window.__dailyNode = document.querySelector('[data-tour-anchor="daily.first-reading"], [data-tour-anchor="daily.empty-action"]') })
}
if (assignments && process.env.PRE_TYPE !== undefined) await page.locator('[data-configuration-tour="search"]').filter({ visible: true }).first().fill(process.env.PRE_TYPE)
await page.screenshot({ path: `${out}/00-page.png` })
const button = page.locator(scenarioName === 'quotes-compare' ? '[data-tour-control="compare-tour"]' : payrollExtra ? '[data-tour-control="payroll-help"]' : launcher).filter({ visible: true }).first()
const record = { scenario, lang, size, steps: [], logs, apiRequests, preClick: process.env.PRE_CLICK ?? null, sampling: settledSampling ? 'settled-geometry' : 'legacy-900ms' }
if (!(await button.count())) { record.error = 'launcher not found'; writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2)); await browser.close(); process.exit(0) }
if (rateBook) {
  try {
    // GT-06: selector click plus optional typing, compatible with GT-05's PRE_CLICK contract.
    if (process.env.PRE_CLICK) {
      const control = page.locator(process.env.PRE_CLICK).filter({ visible: true }).first()
      await control.click()
      if (process.env.PRE_TYPE !== undefined) await control.fill(process.env.PRE_TYPE)
    }
    record.rateBookBefore = await page.evaluate(() => ({ search: document.querySelector('#yarn-rates-search').value, calls: (window.__serverCalls || []).length }))
    const activeLaunchers = await page.locator('[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]').filter({ visible: true }).count()
    if (activeLaunchers !== 1) throw new Error(`Expected one Rate Book launcher, saw ${activeLaunchers}`)
    if (process.env.PRE_CLICK) {
      // Exercise Exit independently before the full Done run, preserving all original filter state.
      await button.click()
      await page.locator('[data-tour-step="rb-purpose"][data-tour-status="ready"]').waitFor()
      await page.locator('[data-tour-control="next"]').click()
      await page.locator('[data-tour-step="rb-find"][data-tour-status="ready"]').waitFor()
      await page.locator('[data-tour-control="next"]').click()
      await page.locator('[data-tour-step="rb-update"][data-tour-status="ready"]').waitFor()
      await page.keyboard.press('Escape')
      await page.locator('.guided-tour-panel').waitFor({ state: 'detached' })
      record.rateBookExit = await page.evaluate(() => ({ search: document.querySelector('#yarn-rates-search').value,
        activeControl: document.activeElement?.getAttribute('data-tour-control'),
        prefs: Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('weavly:tour'))) }))
      if (record.rateBookExit.search !== record.rateBookBefore.search) throw new Error('Rate Book search changed after Exit')
      if (record.rateBookExit.activeControl !== 'quiet-tour') throw new Error('Exit did not focus the replay launcher')
      if (Object.values(record.rateBookExit.prefs).some(value => value.includes('"completed":true'))) throw new Error('Exit recorded completion')
    }
  } catch (error) {
    record.error = String(error)
    writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
    await page.screenshot({ path: `${out}/preflight-failure.png` })
    await browser.close()
    throw error
  }
}
if (workers) {
  record.workersBefore = await captureWorkersState()
  await button.click()
  await page.locator('[data-tour-step="wk-paytype"][data-tour-status="ready"]').waitFor()
  if (await page.locator('[data-tour-control="path-piece"]').getAttribute('aria-pressed') !== 'true') throw new Error('Workers initial path is not piece')
  // Switching more than once must restart readiness for the newly mounted editor.
  for (const path of ['salary', 'piece', 'salary']) {
    await page.locator(`[data-tour-control="path-${path}"]`).click()
    await page.locator(`[data-workers-tour-field="${path === 'piece' ? 'availability' : 'salary'}"]`).waitFor()
    await page.locator('[data-tour-step="wk-paytype"][data-tour-status="ready"]').waitFor()
  }
  await page.keyboard.press('Escape')
  await page.locator('.guided-tour-panel').waitFor({ state: 'detached' })
  record.workersExit = await captureWorkersState()
  if (record.workersExit.activeControl !== 'quiet-tour') throw new Error('Workers Exit did not focus replay launcher')
  if (Object.values(record.workersExit.prefs).some(value => value.includes('"completed":true'))) throw new Error('Workers Exit recorded completion')
}
if (machines) {
  await page.locator('[data-machines-tour="toolbar"] input[type="search"]').fill('Retained')
  await page.locator('[data-machines-tour="toolbar"] select').selectOption('needs_setup')
  record.machinesBefore = await captureMachinesState()
}
if (assignments) record.assignmentsBefore = await captureAssignmentsState()
await button.scrollIntoViewIfNeeded()
record.before = await page.evaluate(() => ({ x: scrollX, y: scrollY, inner: document.querySelector('[data-foundation-scroller]')?.scrollTop ?? null }))
if (dailySheet) record.dailyBefore = await captureDailyState()
if (production) record.productionBefore = await captureProductionState()
if (payroll) record.payrollBefore = await capturePayrollState()
if (estimator) record.estimatorBefore = await captureEstimatorState()
await button.click()
if (savedCostings || dispatch || workers || machines || assignments || production || payroll || dailySheet || rateBook || estimator || stock) await page.locator('.guided-tour-panel').waitFor({ timeout: 15000 })
if (workers) {
  await page.locator('[data-tour-step="wk-paytype"][data-tour-status="ready"]').waitFor()
  if (await page.locator('[data-tour-control="path-piece"]').getAttribute('aria-pressed') !== 'true') throw new Error('Workers replay did not reset to piece')
  if (workersPath === 'salary') await page.locator('[data-tour-control="path-salary"]').click()
}
if (scenarioName === 'foundation') {
  await page.waitForSelector('[data-testid="guided-tour-panel"]')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
}
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(900)
  if (scenarioName === 'foundation' || savedCostings || dispatch || workers || machines || assignments || production || payroll || dailySheet || rateBook || estimator || stock) await page.waitForFunction(() => {
    const panel = document.querySelector('.guided-tour-panel')
    return !panel || panel.getAttribute('data-tour-status') !== 'preparing'
  }, null, { timeout: savedCostings || dispatch || workers || machines || assignments || production || payroll || dailySheet || rateBook || estimator || stock ? 5000 : 2000 })
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
  const info = await page.evaluate(({ rateBook, rateBookPopulated, workers, assignments }) => {
    const panel = document.querySelector('.guided-tour-panel')
    if (!panel) return null
    const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) } }
    const hl = document.querySelector('.guided-tour-highlight')
    const pr = r(panel), hr = r(hl)
    const overlap = pr && hr ? Math.max(0, Math.min(pr.x + pr.w, hr.x + hr.w) - Math.max(pr.x, hr.x)) * Math.max(0, Math.min(pr.y + pr.h, hr.y + hr.h) - Math.max(pr.y, hr.y)) : 0
    const bar = panel.querySelector('[role="progressbar"]')
    const desc = panel.querySelector('[data-tour-description-scroll]')
    const active = document.activeElement
    const step = panel.getAttribute('data-tour-step')
    const rateField = { 'rb-purpose': 'overview', 'rb-find': 'yarnSearch', 'rb-update': 'quickEditAction', 'rb-review': 'reviewStatusBadge', 'rb-usage': 'linkedQualitiesPopover', 'rb-handoff': rateBookPopulated ? 'yarnSearch' : 'addRateAction' }[step]
    const visibleRateTarget = rateBook ? [...document.querySelectorAll(`[data-ratebook-field="${rateField}"]`)].find(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden') : null
    return {
      assignments: assignments ? {
        names: [...document.querySelectorAll('[data-configuration-tour="worker"] p:first-child')].map(node => node.textContent),
        inert: document.querySelector('.configuration-workspace')?.inert,
        picker: !!document.querySelector('[data-configuration-picker-preview="true"]'),
        enabledOptions: [...document.querySelectorAll('[data-configuration-picker-preview="true"] [data-configuration-picker-state]')].filter(node => !node.disabled).length,
        visibleClose: [...document.querySelectorAll('[data-configuration-picker-preview="true"] [data-slot="sheet-close"]')].filter(node => node.getClientRects().length).length,
        anchors: [...document.querySelectorAll('[data-tour-anchor="assignments.first-assign"], [data-tour-anchor="assignments.add-worker"]')].filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden').map(node => node.getAttribute('data-tour-anchor')),
        focusBanner: !![...document.querySelectorAll('.configuration-workspace > [role="status"] a')].find(node => node.href.includes('/owner/assignments?shift=')),
      } : null,
      workers: workers ? {
        search: document.querySelector('[data-workers-tour="toolbar"] input[type="search"]')?.value,
        shift: document.querySelector('[data-workers-tour="shift-filter"]')?.value,
        status: document.querySelector('[data-workers-tour="status-filter"]')?.value,
        samples: !!document.querySelector('[data-workers-tour="groups"]'),
        bannerCount: document.querySelectorAll('[data-tour-sample-banner]').length,
        names: [...document.querySelectorAll('[data-workers-tour="groups"] h3')].map(node => node.textContent),
        preview: !!document.querySelector('[data-workers-tour-preview="true"]'),
        available: !!document.querySelector('[data-workers-tour-field="availability"]'),
        effective: !!document.querySelector('[data-workers-tour-field="effective"]'),
        lastDay: !!document.querySelector('[data-workers-tour-field="lastDay"]'),
        enabledFields: [...document.querySelectorAll('[data-workers-tour-preview="true"] input, [data-workers-tour-preview="true"] [role="combobox"]')].filter(node => !node.matches(':disabled')).length,
        visibleClose: [...document.querySelectorAll('[data-workers-tour-preview="true"] [data-slot="dialog-close"]')].filter(node => node.getClientRects().length && getComputedStyle(node).display !== 'none').length,
        selectedPath: panel.querySelector('[data-tour-control^="path-"][aria-pressed="true"]')?.getAttribute('data-tour-control'),
        anchors: [...document.querySelectorAll('[data-tour-anchor="workers.add"]')].filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden').length,
        url: location.href,
      } : null,
      rateBookTarget: rateBook ? r(visibleRateTarget) : null,
      rateBookRow: visibleRateTarget?.closest('[data-ratebook-row-id]')?.getAttribute('data-ratebook-row-id') ?? null,
      rateBookSearch: rateBook ? document.querySelector('#yarn-rates-search')?.value : null,
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
      context: (() => { const target = document.querySelector('[data-costing-tour-dialog="true"], [data-dispatch-tour-preview="true"], [data-stock-tour-preview="true"], [data-production-tour-preview="true"], [data-payroll-tour-preview="true"], [data-workers-tour-preview="true"], [data-machines-tour-preview="true"], [data-configuration-picker-preview="true"], #mobile-live-estimate-panel'); return r(target) })(),
      estimatorMode: [...document.querySelectorAll('[data-estimator-field="entryMode"] [role="tab"][aria-selected="true"]')].filter(element => element.getClientRects().length).map(element => element.textContent),
      liveEstimateOpen: !!document.getElementById('mobile-live-estimate-panel'),
      search: document.querySelector('#saved-costings-search')?.value ?? null,
      dispatch: document.querySelector('[data-harness-dispatch-live]') ? {
        mounts: window.__dispatchMounts, unmounts: window.__dispatchUnmounts ?? 0,
        retainedSearch: window.__dispatchSearchNode?.value,
        sameSearchNode: window.__dispatchSearchNode === document.querySelector('[data-harness-dispatch-live] input'),
        replica: !!document.querySelector('[data-tour-replica="dispatch"]'),
        anchors: [...document.querySelectorAll('[data-tour-anchor="dispatch.new"]')].filter(node => node.getBoundingClientRect().width && node.getBoundingClientRect().height).length,
        enabledReplicaControls: [...document.querySelectorAll('[data-tour-replica="dispatch"] button, [data-tour-replica="dispatch"] input, [data-dispatch-tour-preview="true"] button, [data-dispatch-tour-preview="true"] input')].filter(node => !node.disabled).length,
      } : null,
      stock: document.querySelector('[data-tour-replica="fabric-stock"], [data-tour-replica="yarn-stock"], [data-harness-fabric-live], [data-harness-yarn-live]') ? {
        replica: !!document.querySelector('[data-tour-replica="fabric-stock"], [data-tour-replica="yarn-stock"]'),
        balance: document.querySelector('[data-fabric-tour-balance], [data-yarn-tour-balance]')?.textContent,
        pending: !!document.querySelector('[data-tour-replica="fabric-stock"] [title]'),
        mounts: window.__fabricMounts, unmounts: window.__fabricUnmounts ?? 0,
        retainedSearch: window.__fabricSearchNode?.value,
        sameSearchNode: window.__fabricSearchNode === document.querySelector('#stock-search'),
        anchors: [...document.querySelectorAll('[data-tour-anchor="fabric.opening"]')].filter(node => node.getBoundingClientRect().width && node.getBoundingClientRect().height).length,
        enabledReplicaControls: [...document.querySelectorAll('[data-tour-replica="fabric-stock"] :is(button,input,select,textarea), [data-tour-replica="yarn-stock"] :is(button,input,select,textarea), [data-stock-tour-preview="true"] :is(button,input,select,textarea)')].filter(node => !node.disabled).length,
      } : null,
      yarn: document.querySelector('[data-harness-yarn-live]') ? {
        mounts: window.__yarnMounts, unmounts: window.__yarnUnmounts ?? 0,
        date: window.__yarnDateNode?.value,
        sameDateNode: window.__yarnDateNode === document.querySelector('#yarn-audit-date'),
        anchors: [...document.querySelectorAll('[data-tour-anchor="yarn.opening"]')].filter(node => node.getBoundingClientRect().width && node.getBoundingClientRect().height).length,
        sections: [...document.querySelectorAll('[data-tour-replica="yarn-stock"] [data-yarn-tour-section]')].map(node => node.getAttribute('data-yarn-tour-section')),
        sampleBanners: document.querySelectorAll('[data-tour-sample-banner]').length,
        weight: document.querySelector('[data-stock-tour-preview="true"] input[value="98"], [data-stock-tour-preview="true"] input[value="20"], [data-stock-tour-preview="true"] input[value="100"]')?.value,
        movement: document.querySelector('[data-stock-tour="movement"]')?.textContent,
      } : null,
      sampleCloseControls: [...document.querySelectorAll('[data-costing-tour-dialog="true"] button')].filter(button => /^(Close|बंद करें|બંધ કરો)$/.test(button.textContent.trim()) || /^Close /.test(button.getAttribute('aria-label') ?? '')).length,
      rail: (() => { const e = Array.from(document.querySelectorAll('aside')).find(a => /left-rail/.test(a.className) && getComputedStyle(a).position === 'fixed' && a.getBoundingClientRect().width > 0); return r(e) })(),
      vh: innerHeight, vw: innerWidth,
      // Rail overlap cannot be measured by hit-testing (the page is inert during a tour); judge it from screenshots.
    }
  }, { rateBook, rateBookPopulated, workers, assignments })
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
  if (workers && i === 1) {
    await page.locator('[data-tour-control="back"]').click()
    await page.locator('[data-tour-step="wk-paytype"][data-tour-status="ready"]').waitFor()
    if (await page.locator(`[data-tour-control="path-${workersPath}"]`).getAttribute('aria-pressed') !== 'true') throw new Error('Workers Back changed pay path')
    await page.locator('[data-tour-control="next"]').click()
    await page.locator(`[data-tour-step="${info.step}"][data-tour-status="ready"]`).waitFor()
    record.workersBack = true
  }
  if (settledSampling) info.settlement = settlement
  if (dailySheet) info.daily = await captureDailyState()
  if (assignments && info.step === 'ma-linked') {
    await page.locator('[data-tour-control="back"]').click()
    await page.locator('[data-tour-step="ma-choose"][data-tour-status="ready"]').waitFor()
    await page.locator('[data-configuration-picker-preview="true"]').waitFor()
    await page.locator('[data-tour-control="next"]').click()
    await page.locator('[data-tour-step="ma-linked"][data-tour-status="ready"]').waitFor()
    record.assignmentsBack = true
  }
  if (machines) {
    info.machines = await captureMachinesState()
    if (info.step === 'mc-readiness') {
      await page.locator('[data-tour-control="back"]').click()
      await page.locator('[data-tour-step="mc-details"][data-tour-status="ready"]').waitFor()
      await page.locator('[data-machines-tour-preview="true"][data-state="open"]').waitFor()
      const back = await captureMachinesState()
      if (!back.preview || back.enabledFields || back.visibleClose) throw new Error('Machines Back did not restore the read-only preview')
      await page.locator('[data-tour-control="next"]').click()
      await page.locator('[data-tour-step="mc-readiness"][data-tour-status="ready"]').waitFor()
      record.machinesBack = true
    }
  }
  if (production) info.production = await captureProductionState()
  if (payroll) info.payroll = await capturePayrollState()
  record.steps.push(info)
  await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, '0')}.png` })
  const next = page.locator('.guided-tour-panel [data-tour-control="next"]').first()
  if (!(await next.count()) || await next.isDisabled()) { record.stoppedAt = i + 1; break }
  if (scenarioName === 'foundation' && info.step === 'dialog') {
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.guided-tour-panel'))
    break
  }
  if ((estimator || stock || machines || assignments || production || payroll || dailySheet) && Number(process.env.EXIT_AT) === i + 1) {
    record.exitAt = i + 1
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.guided-tour-panel'))
    break
  }
  await next.click()
}
if (rateBook || stock || machines || assignments || production || payroll || dailySheet) await page.waitForTimeout(400)
record.after = await page.evaluate(() => ({ scroll: { x: scrollX, y: scrollY, inner: document.querySelector('[data-foundation-scroller]')?.scrollTop ?? null }, active: document.activeElement?.outerHTML?.slice(0, 160), activeAnchor: document.activeElement?.getAttribute('data-tour-anchor'), activeRateBookField: document.activeElement?.getAttribute('data-ratebook-field'), activeControl: document.activeElement?.getAttribute('data-tour-control'), serverCalls: window.__serverCalls || [], navigations: window.__navigations || [], scrollCalls: window.__foundationScrollCalls || [], prefs: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('weavly:tour'))) }))
await page.waitForTimeout(400)
if (dispatch) record.after.dispatch = await page.evaluate(() => ({
  mounts: window.__dispatchMounts, unmounts: window.__dispatchUnmounts ?? 0,
  retainedSearch: window.__dispatchSearchNode?.value,
  sameSearchNode: window.__dispatchSearchNode === document.querySelector('[data-harness-dispatch-live] input'),
  liveHidden: !!document.querySelector('[data-harness-dispatch-live]')?.closest('[hidden]'),
  replica: !!document.querySelector('[data-tour-replica="dispatch"]'),
}))
if (fabricStock) record.after.stock = await page.evaluate(() => ({
  mounts: window.__fabricMounts, unmounts: window.__fabricUnmounts ?? 0,
  retainedSearch: window.__fabricSearchNode?.value,
  sameSearchNode: window.__fabricSearchNode === document.querySelector('#stock-search'),
  liveHidden: !!document.querySelector('[data-harness-fabric-live]')?.closest('[hidden]'),
  replica: !!document.querySelector('[data-tour-replica="fabric-stock"]'),
}))
if (yarnStock) record.after.yarn = await page.evaluate(() => ({
  mounts: window.__yarnMounts, unmounts: window.__yarnUnmounts ?? 0,
  date: window.__yarnDateNode?.value,
  sameDateNode: window.__yarnDateNode === document.querySelector('#yarn-audit-date'),
  liveHidden: !!document.querySelector('[data-harness-yarn-live]')?.closest('[hidden]'),
  replica: !!document.querySelector('[data-tour-replica="yarn-stock"]'),
}))

if (dailySheet) record.after.daily = await captureDailyState()
if (production) record.after.production = await captureProductionState()
if (payroll) record.after.payroll = await capturePayrollState()
if (estimator) record.estimatorAfter = await captureEstimatorState()
if (assignments) record.assignmentsAfter = await captureAssignmentsState()
if (workers) record.workersAfter = await captureWorkersState()
if (machines) record.machinesAfter = await captureMachinesState()
record.after.search = await page.locator(rateBook ? '#yarn-rates-search' : '#saved-costings-search').inputValue().catch(() => null)
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
if (savedCostings) {
  const issues = []
  const expected = scenarioName === 'quotes-compare' || scenarioName === 'free-costings' ? 4 : new URLSearchParams(scenarioQuery).get('tier') === 'lite' ? 6 : 7
  if (record.steps.length !== expected) issues.push(`expected ${expected} steps, saw ${record.steps.length}`)
  for (const step of record.steps) {
    if (step.status !== 'ready') issues.push(`${step.step}: ${step.status}`)
    if (step.overlapArea > 0) issues.push(`${step.step}: panel/outline overlap ${step.overlapArea}`)
    if (step.sampleCloseControls) issues.push(`${step.step}: sample close control visible`)
    if (step.step === 'find' && width >= 1280 && step.panel.x < step.highlight.x + step.highlight.w) issues.push('find: panel is not beside the right of the card')
    if (!step.focusInPanel) issues.push(`${step.step}: focus outside panel`)
    const h = step.highlight
    if (!h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(`${step.step}: outline not fully on screen`)
  }
  if (record.after.serverCalls.some(call => call.fn !== 'recordTourEventAction')) issues.push('unexpected server action')
  if (record.after.navigations.length) issues.push('unexpected navigation')
  const handoff = scenarioName === 'quotes-compare' ? 'costings.compare' : scenarioName === 'free-costings' ? 'free-costings.new' : 'costings.new'
  if (record.after.activeAnchor !== handoff) issues.push(`Done did not focus ${handoff}`)
  const search = new URLSearchParams(scenarioQuery).get('search')
  if (search && (record.after.search !== search || record.steps.some(step => step.search !== search))) issues.push('search was not preserved')
  if (logs.some(line => line.startsWith('pageerror:'))) issues.push('page error')
  record.issues = issues
  writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}
if (dispatch) {
  const issues = []
  const expected = ['overview', 'quality', 'parties', 'lots', 'saveDraft', 'confirm', 'receipt', 'difference', 'payment', 'handoff']
  if (JSON.stringify(record.steps.map(step => step.step)) !== JSON.stringify(expected)) issues.push('expected all ten dispatch steps in order')
  const intersection = (a, b) => a && b ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0
  for (const step of record.steps) {
    if (step.status !== 'ready') issues.push(`${step.step}: ${step.status}`)
    if (step.overlapArea > 0) issues.push(`${step.step}: panel/outline overlap`)
    if (width >= 768 && intersection(step.panel, step.context)) issues.push(`${step.step}: panel/dialog overlap`)
    if (['overview', 'difference'].includes(step.step) && intersection(step.rail, step.highlight)) issues.push(`${step.step}: rail intersects replica target`)
    if (!step.focusInPanel) issues.push(`${step.step}: focus outside panel`)
    const h = step.highlight
    if (step.panelOffscreen || !h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(`${step.step}: panel/outline off screen`)
    const handoff = step.step === 'handoff'
    if (step.liveHidden === handoff || step.dispatch?.replica === handoff) issues.push(`${step.step}: wrong live/replica visibility`)
    if (handoff && step.dispatch?.anchors !== 1) issues.push('handoff: expected one visible New dispatch anchor')
    if (step.dispatch?.enabledReplicaControls) issues.push(`${step.step}: enabled replica control`)
    if (step.dispatch?.mounts !== 1 || step.dispatch?.unmounts || !step.dispatch?.sameSearchNode || step.dispatch?.retainedSearch !== 'Retained search') issues.push(`${step.step}: live state was not retained`)
  }
  if (record.after.dispatch?.liveHidden || record.after.dispatch?.replica || record.after.dispatch?.mounts !== 1 || record.after.dispatch?.unmounts || !record.after.dispatch?.sameSearchNode || record.after.dispatch?.retainedSearch !== 'Retained search') issues.push('Done did not restore the same live client/state')
  const pending = new URLSearchParams(scenarioQuery).get('pending') === '1'
  if (pending ? !['take-tour', 'quiet-tour'].includes(record.after.activeControl) : record.after.activeAnchor !== 'dispatch.new') issues.push('Done focus did not reach the enabled handoff or launcher fallback')
  if (record.after.serverCalls.some(call => call.fn !== 'recordTourEventAction')) issues.push('unexpected server action')
  if (record.after.navigations.length) issues.push('unexpected navigation')
  if (process.env.REDUCED_MOTION === '1' && record.after.scrollCalls.some(call => call.behavior === 'smooth')) issues.push('reduced motion used smooth scrolling')
  if (logs.some(line => line.startsWith('pageerror:'))) issues.push('page error')
  record.issues = issues
  writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}
// GT-08/09 assertions are prepared for deferred browser verification, not a claim of a run.
if (stock) {
  const issues = []
  const steps = fabricStock ? ['fs-balance', 'fs-pending', 'fs-opening', 'fs-correct', 'fs-history', 'fs-handoff'] : ['ys-balance', 'ys-opening', 'ys-receipt', 'ys-link', 'ys-usage', 'ys-correct', 'ys-handoff']
  const expected = record.exitAt ? steps.slice(0, record.exitAt) : steps
  if (JSON.stringify(record.steps.map(step => step.step)) !== JSON.stringify(expected)) issues.push('stock step order/count mismatch')
  const intersection = (a, b) => a && b ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0
  const balances = { 'fs-balance': 100, 'fs-pending': 100, 'fs-opening': 100, 'fs-correct': 600, 'fs-history': 590 }
  for (const step of record.steps) {
    if (step.status !== 'ready') issues.push(`${step.step}: ${step.status}`)
    if (!step.focusInPanel) issues.push(`${step.step}: focus outside panel`)
    if (step.stock?.enabledReplicaControls) issues.push(`${step.step}: enabled business control in sample`)
    const handoff = step.step === (fabricStock ? 'fs-handoff' : 'ys-handoff')
    if (step.liveHidden === handoff || step.stock?.replica === handoff) issues.push(`${step.step}: live/replica visibility`)
    if (fabricStock) {
      if (step.overlapArea > 0) issues.push(`${step.step}: panel/outline overlap`)
      if (width >= 768 && intersection(step.panel, step.context)) issues.push(`${step.step}: panel/dialog overlap`)
      if (width >= 1440 && !step.context && intersection(step.rail, step.highlight)) issues.push(`${step.step}: rail intersects target`)
      const h = step.highlight
      if (step.panelOffscreen || !h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(`${step.step}: panel/outline off screen`)
      if (handoff ? step.stock?.anchors !== 1 : parseInt(step.stock?.balance, 10) !== balances[step.step]) issues.push(`${step.step}: wrong anchor or balance`)
      if (step.stock?.pending !== ['fs-balance', 'fs-pending', 'fs-opening'].includes(step.step)) issues.push(`${step.step}: wrong Pending state`)
      if (step.stock?.mounts !== 1 || step.stock?.unmounts || !step.stock?.sameSearchNode || step.stock?.retainedSearch !== 'Retained') issues.push(`${step.step}: live state changed`)
    }
    if (yarnStock) {
      if (step.overlapArea > 0) issues.push(`${step.step}: panel/outline overlap`)
      if (width >= 768 && intersection(step.panel, step.context)) issues.push(`${step.step}: panel/dialog overlap`)
      if (width >= 1440 && !step.context && intersection(step.rail, step.highlight)) issues.push(`${step.step}: rail intersects target`)
      const h = step.highlight
      if (step.panelOffscreen || !h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(`${step.step}: panel/outline off screen`)
      const balance = { 'ys-balance': 100, 'ys-opening': 100, 'ys-receipt': 120, 'ys-link': 120, 'ys-usage': 100, 'ys-correct': 100 }[step.step]
      if (handoff ? step.yarn?.anchors !== 1 : parseInt(step.stock?.balance, 10) !== balance) issues.push(`${step.step}: wrong Yarn anchor or balance`)
      const sections = ['header', 'balance', 'date', 'yarns', 'costings', 'history']
      if (!handoff && JSON.stringify(step.yarn?.sections) !== JSON.stringify(sections)) issues.push(`${step.step}: wrong Yarn section order`)
      if (step.yarn?.sampleBanners !== (handoff ? 0 : 1)) issues.push(`${step.step}: wrong sample disclosure count`)
      const weight = { 'ys-opening': '100', 'ys-receipt': '20', 'ys-correct': '98' }[step.step]
      if (weight && step.yarn?.weight !== weight) issues.push(`${step.step}: wrong sample weight`)
      if (step.step === 'ys-usage' && !step.yarn?.movement?.includes('−20 kg')) issues.push('Yarn production deduction missing')
      if (step.yarn?.mounts !== 1 || step.yarn?.unmounts || !step.yarn?.sameDateNode || step.yarn?.date !== '2026-09-14') issues.push(`${step.step}: Yarn live state changed`)
    }
  }
  if (fabricStock && (record.after.stock?.liveHidden || record.after.stock?.replica || record.after.stock?.mounts !== 1 || record.after.stock?.unmounts || !record.after.stock?.sameSearchNode || record.after.stock?.retainedSearch !== 'Retained')) issues.push('live client/state not restored')
  if (yarnStock && (record.after.yarn?.liveHidden || record.after.yarn?.replica || record.after.yarn?.mounts !== 1 || record.after.yarn?.unmounts || !record.after.yarn?.sameDateNode || record.after.yarn?.date !== '2026-09-14')) issues.push('Yarn live client/state not restored')
  if (fabricStock && (!record.exitAt ? record.after.activeAnchor !== 'fabric.opening' : !['take-tour', 'quiet-tour'].includes(record.after.activeControl))) issues.push('stock focus restoration failed')
  if (yarnStock && (!record.exitAt ? record.after.activeAnchor !== 'yarn.opening' : !['take-tour', 'quiet-tour'].includes(record.after.activeControl))) issues.push('Yarn focus restoration failed')
  if (record.exitAt && Object.values(record.after.prefs).some(value => value.includes('"completed":true'))) issues.push('Exit recorded completion')
  if (record.after.serverCalls.some(call => call.fn !== 'recordTourEventAction')) issues.push('unexpected stock server action')
  if (record.after.navigations.length || apiRequests.length) issues.push('unexpected stock navigation/API request')
  if (process.env.REDUCED_MOTION === '1' && record.after.scrollCalls.some(call => call.behavior === 'smooth')) issues.push('reduced motion used smooth scrolling')
  if (logs.some(line => line.startsWith('pageerror:'))) issues.push('stock page error')
  record.issues = issues
  writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}
// GT-10 assertions are prepared for later authorized browser verification.
if (payroll) {
  const issues = []
  const steps = payrollExtra
    ? ['pra-advance', 'pra-deduction', 'pra-records', 'pra-export', 'pra-correct', 'pra-handoff']
    : ['pr-period', 'pr-readiness', 'pr-earnings', 'pr-recovery', 'pr-settle', 'pr-paid', 'pr-complete', 'pr-handoff']
  const expected = record.exitAt ? steps.slice(0, record.exitAt) : steps
  if (JSON.stringify(record.steps.map(step => step.step)) !== JSON.stringify(expected)) issues.push('Payroll step order/count mismatch')
  const intersection = (a, b) => a && b ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0
  const unchanged = state => state?.mounts === 1 && !state.unmounts && state.sameSearchNode && state.search === record.payrollBefore.search && JSON.stringify(state.storage) === JSON.stringify(record.payrollBefore.storage)
  for (const step of record.steps) {
    if (step.status !== 'ready') issues.push(`${step.step}: ${step.status}`)
    if (!step.focusInPanel) issues.push(`${step.step}: focus outside panel`)
    if (step.overlapArea > 0) issues.push(`${step.step}: panel/outline overlap`)
    if (width >= 768 && intersection(step.panel, step.context)) issues.push(`${step.step}: panel/dialog overlap`)
    if (width >= 1440 && intersection(step.rail, step.highlight)) issues.push(`${step.step}: rail paints over target`)
    const h = step.highlight
    if (step.panelOffscreen || !h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(`${step.step}: panel/outline off screen`)
    const handoff = step.step.endsWith('handoff')
    if (step.payroll?.liveHidden === handoff || step.payroll?.replica === handoff) issues.push(`${step.step}: wrong live/replica visibility`)
    if (!unchanged(step.payroll)) issues.push(`${step.step}: live subtree/search/draft state changed`)
    if (step.payroll?.enabledReplicaControls) issues.push(`${step.step}: enabled replica control`)
    if (step.payroll?.paymentDate) issues.push(`${step.step}: payment-date teaching returned`)
  }
  if (!unchanged(record.after.payroll) || record.after.payroll.liveHidden || record.after.payroll.replica) issues.push('Payroll live state not restored')
  const anchor = payrollExtra ? 'payroll.records' : 'payroll.settle'
  if (!record.exitAt && record.after.activeAnchor !== anchor) issues.push(`Done did not focus ${anchor}`)
  if (record.exitAt && !(payrollExtra ? record.after.activeControl === 'payroll-help' : ['take-tour', 'quiet-tour'].includes(record.after.activeControl))) issues.push('Exit did not restore launcher focus')
  const calls = record.after.serverCalls.slice(record.payrollBefore.calls)
  if (calls.some(call => call.fn !== 'recordTourEventAction')) issues.push('unexpected business action')
  if (payrollExtra && (calls.length || JSON.stringify(record.after.prefs) !== JSON.stringify(record.payrollBefore.prefs))) issues.push('optional walkthrough wrote a preference event')
  if (record.exitAt && Object.values(record.after.prefs).some(value => value.includes('"completed":true'))) issues.push('Exit recorded completion')
  if (record.after.navigations.length || apiRequests.length !== record.payrollBefore.apiCalls) issues.push('unexpected navigation/API request')
  if (process.env.REDUCED_MOTION === '1' && record.after.scrollCalls.some(call => call.behavior === 'smooth')) issues.push('reduced motion used smooth scrolling')
  if (logs.some(line => line.startsWith('pageerror:'))) issues.push('Payroll page error')
  record.issues = issues
  writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}

if (dailySheet) {
  const issues = []
  const expected = ['ds-sheet', 'ds-shift', 'ds-reading', 'ds-pending', 'ds-earnings', 'ds-draft', 'ds-save', 'ds-correct', 'ds-handoff'].slice(0, record.exitAt || 9)
  if (JSON.stringify(record.steps.map(step => step.step)) !== JSON.stringify(expected)) issues.push('Daily Sheet step order/count mismatch')
  if (record.dailyBefore.guides !== 1) issues.push('expected one visible Daily Sheet guide')
  if (width >= 1280 && (!record.dailyBefore.guideInRightRail || !record.dailyBefore.guideLast)) issues.push('guide is not last in the right rail')
  if (width < 1280 && !record.dailyBefore.guideAboveSheet) issues.push('inline guide is not above the sheet')
  const unchanged = state => state.sameNode && state.value === record.dailyBefore.value && state.date === record.dailyBefore.date && state.url === record.dailyBefore.url && JSON.stringify(state.storage) === JSON.stringify(record.dailyBefore.storage)
  const intersection = (a, b) => a && b ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0
  for (const step of record.steps) {
    const handoff = step.step === 'ds-handoff'
    if (step.status !== 'ready') issues.push(`${step.step}: ${step.status}`)
    if (step.overlapArea || (width >= 768 && intersection(step.panel, step.context))) issues.push(`${step.step}: overlap`)
    const h = step.highlight
    if (step.panelOffscreen || !h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(`${step.step}: off screen`)
    if (!step.focusInPanel) issues.push(`${step.step}: focus outside panel`)
    if (step.daily.liveHidden === handoff || step.daily.replica === handoff) issues.push(`${step.step}: wrong visibility`)
    if (step.daily.enabledReplicaControls) issues.push(`${step.step}: enabled sample control`)
    if (!unchanged(step.daily)) issues.push(`${step.step}: reading/node/device draft/navigation changed`)
    if (handoff && step.daily.visibleAnchors !== 1) issues.push('handoff target missing or duplicated')
  }
  if (!unchanged(record.after.daily) || record.after.daily.liveHidden || record.after.daily.replica) issues.push('live sheet not restored')
  if (record.exitAt) {
    if (!['take-tour', 'quiet-tour'].includes(record.after.activeControl)) issues.push('Exit did not restore launcher focus')
    if (JSON.stringify(record.before) !== JSON.stringify(record.after.scroll)) issues.push('Exit scroll not restored')
    if (Object.values(record.after.prefs).some(value => value.includes('"completed":true'))) issues.push('Exit recorded completion')
  } else if (record.after.activeAnchor !== record.dailyBefore.anchor) issues.push('Done did not focus the live handoff')
  if (record.after.serverCalls.slice(record.dailyBefore.calls).some(call => call.fn !== 'recordTourEventAction')) issues.push('business action during Daily Sheet tour')
  if (apiRequests.length !== record.dailyBefore.apiCalls || record.after.navigations.length) issues.push('network/navigation during Daily Sheet tour')
  if (process.env.REDUCED_MOTION === '1' && record.after.scrollCalls.some(call => call.behavior === 'smooth')) issues.push('smooth scrolling under reduced motion')
  if (logs.some(line => line.startsWith('pageerror:'))) issues.push('page error')
  record.issues = issues
  writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}
if (production) {
  const issues = []
  const expected = ['pd-overview', 'pd-prereq', 'pd-activate', 'pd-looms', 'pd-handoff'].slice(0, record.exitAt || 5)
  if (JSON.stringify(record.steps.map(step => step.step)) !== JSON.stringify(expected)) issues.push('Production step order/count mismatch')
  const intersection = (a, b) => a && b ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0
  const unchanged = state => state?.mounts === 1 && !state.unmounts && state.sameSearchNode && state.search === record.productionBefore.search && JSON.stringify(state.filter) === JSON.stringify(record.productionBefore.filter) && JSON.stringify(state.storage) === JSON.stringify(record.productionBefore.storage)
  for (const step of record.steps) {
    if (step.status !== 'ready') issues.push(`${step.step}: ${step.status}`)
    if (step.overlapArea > 0) issues.push(`${step.step}: panel/outline overlap`)
    if (width >= 768 && intersection(step.panel, step.context)) issues.push(`${step.step}: panel/dialog overlap`)
    if (width >= 1440 && intersection(step.rail, step.highlight)) issues.push(`${step.step}: rail intersects target`)
    const h = step.highlight
    if (step.panelOffscreen || !h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(`${step.step}: panel/outline off screen`)
    if (!step.focusInPanel) issues.push(`${step.step}: focus outside panel`)
    const handoff = step.step === 'pd-handoff'
    if (step.production?.liveHidden === handoff || step.production?.replica === handoff) issues.push(`${step.step}: wrong live/replica visibility`)
    if (handoff && step.production?.anchors !== 1) issues.push('handoff: expected one visible Activate Quality anchor')
    if (step.production?.enabledReplicaControls) issues.push(`${step.step}: enabled sample control`)
    if (!unchanged(step.production)) issues.push(`${step.step}: live filter/search/draft state changed`)
  }
  if (!unchanged(record.after.production) || record.after.production.liveHidden || record.after.production.replica) issues.push('live subtree/state not restored')
  if (record.exitAt) {
    if (!['take-tour', 'quiet-tour'].includes(record.after.activeControl)) issues.push('Exit did not focus the launcher')
    if (Object.values(record.after.prefs).some(value => value.includes('"completed":true'))) issues.push('Exit recorded completion')
    if (JSON.stringify(record.before) !== JSON.stringify(record.after.scroll)) issues.push('Exit did not restore scroll')
  } else if (record.after.activeAnchor !== 'production.activate') issues.push('Done did not focus Activate Quality')
  if (record.after.serverCalls.slice(record.productionBefore.calls).some(call => call.fn !== 'recordTourEventAction')) issues.push('unexpected tour server action')
  if (record.after.navigations.length) issues.push('unexpected navigation')
  if (apiRequests.length !== record.productionBefore.apiCalls) issues.push('unexpected tour API request')
  if (process.env.REDUCED_MOTION === '1' && record.after.scrollCalls.some(call => call.behavior === 'smooth')) issues.push('reduced motion used smooth scrolling')
  if (logs.some(line => line.startsWith('pageerror:'))) issues.push('page error')
  record.issues = issues
  writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}
if (rateBook) {
  const issues = []
  const expected = ['rb-purpose', 'rb-find', 'rb-update', 'rb-review', 'rb-usage', 'rb-handoff']
  if (JSON.stringify(record.steps.map(step => step.step)) !== JSON.stringify(expected)) issues.push('Rate Book step order/count mismatch')
  let row = null
  for (const step of record.steps) {
    const rowStep = ['rb-update', 'rb-review', 'rb-usage'].includes(step.step)
    if (rateBookNoRows && rowStep) {
      if (step.status !== 'unavailable') issues.push(`${step.step}: expected unavailable recovery`)
      if (step.highlight) issues.push(`${step.step}: stale outline on unavailable row`)
      continue
    }
    if (step.status !== 'ready') issues.push(`${step.step}: ${step.status}`)
    if (step.overlapArea > 0) issues.push(`${step.step}: panel/outline overlap`)
    if (step.panelOffscreen || !step.focusInPanel) issues.push(`${step.step}: panel offscreen or focus escaped`)
    const h = step.highlight, target = step.rateBookTarget
    if (!h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(`${step.step}: outline not fully on screen`)
    if (!target || !h || Math.abs(h.x - target.x + 6) > 2 || Math.abs(h.y - target.y + 6) > 2 || Math.abs(h.w - target.w - 12) > 2 || Math.abs(h.h - target.h - 12) > 2) issues.push(`${step.step}: outline does not match the specified target`)
    if (rowStep) {
      if (!step.rateBookRow) issues.push(`${step.step}: missing row target`)
      if (row && row !== step.rateBookRow) issues.push(`${step.step}: row changed between steps`)
      row = step.rateBookRow
      const sample = { en: 'Sample', gu: 'નમૂનો', hi: 'नमूना' }[lang]
      if (step.eyebrow.includes(sample) !== !rateBookPopulated) issues.push(`${step.step}: incorrect Sample eyebrow`)
    }
    if (step.rateBookSearch !== record.rateBookBefore.search) issues.push(`${step.step}: search text changed`)
  }
  if (record.after.search !== record.rateBookBefore.search) issues.push('search not preserved after Done')
  if (record.after.activeRateBookField !== (rateBookPopulated ? 'yarnSearch' : 'addRateAction')) issues.push('Done did not focus the correct live handoff')
  if (record.after.serverCalls.slice(record.rateBookBefore.calls).some(call => call.fn !== 'recordTourEventAction')) issues.push('tour caused a business server action')
  if (record.after.navigations.length) issues.push('unexpected navigation')
  if (logs.some(line => line.startsWith('pageerror:'))) issues.push('page error')
  record.issues = issues
  writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}

if (estimator) {
  const issues = []
  const expected = record.exitAt ?? 10
  if (record.steps.length !== expected) issues.push(`expected ${expected} steps, saw ${record.steps.length}`)
  const names = ['purpose', 'warp', 'weft', 'weaving', 'warping', 'overhead', 'pricing', 'live', 'save', 'handoff'].map(name => `est-${name}`)
  for (const [index, step] of record.steps.entries()) {
    if (step.step !== names[index]) issues.push(`unexpected step ${step.step}`)
    if (step.status !== 'ready') issues.push(`${step.step}: ${step.status}`)
    if (step.overlapArea > 0) issues.push(`${step.step}: panel/outline overlap ${step.overlapArea}`)
    if (step.panelOffscreen || !step.focusInPanel) issues.push(`${step.step}: panel offscreen or focus outside panel`)
    const h = step.highlight
    if (!h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(`${step.step}: outline not fully on screen`)
    if (step.step === 'est-purpose' && h && width >= 1280 && step.panel.x < h.x + h.w) issues.push('purpose: panel is not to the right of the card')
    if (JSON.stringify(step.estimatorMode) !== JSON.stringify(record.steps[0].estimatorMode) || step.estimatorMode.some(label => /Detailed|વિગતવાર|विस्तृत/.test(label))) issues.push(`${step.step}: Quick view not maintained`)
    if (step.liveEstimateOpen !== ['est-live', 'est-save'].includes(step.step)) issues.push(`${step.step}: wrong Live cost state`)
    if (width >= 768 && step.context) {
      const c = step.context, p = step.panel
      if (Math.max(0, Math.min(p.x + p.w, c.x + c.w) - Math.max(p.x, c.x)) * Math.max(0, Math.min(p.y + p.h, c.y + c.h) - Math.max(p.y, c.y)) > 0) issues.push(`${step.step}: panel/sheet overlap`)
    }
  }
  const before = record.estimatorBefore, after = record.estimatorAfter
  for (const key of ['mode', 'liveEstimateOpen', 'inputs', 'storage']) if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) issues.push(`${key} not restored/preserved`)
  const mountReads = calls => calls.filter(call => call.fn === 'getEstimatorSecondaryData').length
  if (mountReads(after.serverCalls) !== mountReads(before.serverCalls)) issues.push('secondary-data reads increased during tour')
  if (after.serverCalls.slice(before.serverCalls.length).some(call => call.fn !== 'recordTourEventAction')) issues.push('unexpected tour server action')
  if (apiRequests.some(request => new URL(request.url).pathname === '/api/free/calculate')) issues.push('Free calculation requested')
  if (record.after.navigations.length) issues.push('unexpected navigation')
  if (record.exitAt ? !['take-tour', 'quiet-tour'].includes(after.activeControl) : after.activeField !== 'qualityLabel') issues.push('incorrect Exit/Done focus')
  if (logs.some(line => line.startsWith('pageerror:'))) issues.push('page error')
  record.issues = issues
  writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}

if (workers) {
  const issues = []
  const expected = workersPath === 'piece'
    ? ['wk-paytype', 'wkp-availability', 'wkp-wage', 'wkp-loom', 'wkp-earnings', 'wk-handoff']
    : ['wk-paytype', 'wks-salary', 'wks-joining', 'wks-changes', 'wks-payroll', 'wk-handoff']
  if (JSON.stringify(record.steps.map(step => step.step)) !== JSON.stringify(expected)) issues.push('Workers six-step order mismatch')
  if (!record.workersBack) issues.push('Workers Back traversal not verified')
  for (const step of record.steps) {
    const sample = step.step !== 'wk-handoff', w = step.workers
    if (step.status !== 'ready') issues.push(`${step.step}: ${step.status}`)
    if (step.overlapArea > 0 || step.panelOffscreen || !step.focusInPanel) issues.push(`${step.step}: overlap, offscreen panel or focus escaped`)
    const h = step.highlight
    if (!h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(`${step.step}: outline offscreen`)
    if (width >= 768 && step.context) {
      const c = step.context, p = step.panel
      if (Math.max(0, Math.min(p.x+p.w,c.x+c.w)-Math.max(p.x,c.x))*Math.max(0,Math.min(p.y+p.h,c.y+c.h)-Math.max(p.y,c.y)) > 0) issues.push(`${step.step}: panel/editor overlap`)
    }
    if ((width >= 1280 || (lang === 'gu' && width === 390 && step.step === 'wk-paytype')) && step.descriptionScrollable) issues.push(`${step.step}: description requires scrolling`)
    if (w.samples !== sample || w.bannerCount !== (sample ? 1 : 0)) issues.push(`${step.step}: wrong sample visibility`)
    if (w.preview !== ['wk-paytype', 'wkp-availability', 'wks-salary', 'wks-joining', 'wks-changes'].includes(step.step)) issues.push(`${step.step}: wrong editor visibility`)
    if (w.enabledFields || w.visibleClose) issues.push(`${step.step}: writable/closable preview`)
    if (step.step === 'wk-paytype' && (w.selectedPath !== `path-${workersPath}` || w.available !== (workersPath === 'piece'))) issues.push('pay choice and editor disagree')
    if (step.step === 'wks-changes' && (!w.effective || !w.lastDay)) issues.push('changes must show both effective date and last working day')
    if (sample && (w.search !== '' || w.shift !== 'all' || w.status !== 'active')) issues.push(`${step.step}: filters not shadowed`)
    if (sample && JSON.stringify(w.names) !== JSON.stringify({ en: ['Sample worker', 'Sample staff'], gu: ['નમૂના કારીગર', 'નમૂના સ્ટાફ'], hi: ['नमूना कारीगर', 'नमूना स्टाफ'] }[lang])) issues.push(`${step.step}: sample names not localized`)
    if (w.url !== record.workersBefore.url) issues.push(`${step.step}: URL changed`)
    if (!sample && (w.anchors !== 1 || w.search !== record.workersBefore.search || w.shift !== record.workersBefore.shift || w.status !== record.workersBefore.status)) issues.push('handoff did not restore live page/control')
  }
  for (const result of [record.workersExit, record.workersAfter]) {
    for (const key of ['search', 'shift', 'status', 'url', 'storage']) if (JSON.stringify(result[key]) !== JSON.stringify(record.workersBefore[key])) issues.push(`${key} changed after Workers tour`)
    if (result.preview || result.samples) issues.push('Workers samples remained after cleanup')
  }
  if (record.workersAfter.activeAnchor !== 'workers.add') issues.push('Workers Done did not focus Add worker')
  if (Math.abs(record.after.scroll.x - record.before.x) > 1 || Math.abs(record.after.scroll.y - record.before.y) > 1) issues.push('Workers launch scroll was not restored')
  if (record.after.serverCalls.slice(record.workersBefore.calls).some(call => call.fn !== 'recordTourEventAction')) issues.push('Workers caused a business server action')
  if (record.after.navigations.length || apiRequests.length) issues.push('Workers caused navigation/API request')
  if (process.env.REDUCED_MOTION === '1' && record.after.scrollCalls.some(call => call.behavior === 'smooth')) issues.push('Workers reduced motion used smooth scrolling')
  if (logs.some(line => line.startsWith('pageerror:'))) issues.push('page error')
  // Completion replay must also reset to piece, even after the salary path.
  await page.locator('[data-tour-control="quiet-tour"]').filter({ visible: true }).first().click()
  await page.locator('[data-tour-step="wk-paytype"][data-tour-status="ready"]').waitFor()
  if (await page.locator('[data-tour-control="path-piece"]').getAttribute('aria-pressed') !== 'true') issues.push('completion replay did not reset to piece')
  await page.keyboard.press('Escape')
  await page.locator('.guided-tour-panel').waitFor({ state: 'detached' })
  record.issues = issues
  writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}

if (assignments) {
  const issues = []
  const expected = ['ma-purpose', 'ma-shift', 'ma-job', 'ma-assign', 'ma-choose', 'ma-linked', 'ma-handoff'].slice(0, record.exitAt || 7)
  if (JSON.stringify(record.steps.map(step => step.step)) !== JSON.stringify(expected)) issues.push('incorrect assignment steps')
  for (const step of record.steps) {
    if (step.status !== 'ready') issues.push(`${step.step}: ${step.status}`)
    if (step.overlapArea > 0) issues.push(`${step.step}: panel/outline overlap ${step.overlapArea}; MA-1/default board anchor remains unverified`)
    if (step.panelOffscreen || !step.focusInPanel) issues.push(`${step.step}: panel bounds/focus`)
    const rect = step.highlight
    if (!rect || rect.x < 0 || rect.y < 0 || rect.x + rect.w > width || rect.y + rect.h > height) issues.push(`${step.step}: outline offscreen`)
    if (!step.assignments?.inert || step.assignments.focusBanner) issues.push(`${step.step}: live interaction/focus banner leak`)
    if (step.assignments?.picker !== (step.step === 'ma-choose') || step.assignments?.enabledOptions || step.assignments?.visibleClose) issues.push(`${step.step}: picker isolation`)
    const hasLiveWorker = step.assignments?.names.some(name => name.startsWith('Retained'))
    if (step.step !== 'ma-handoff' && hasLiveWorker) issues.push(`${step.step}: live data in samples`)
    if (step.step === 'ma-handoff') {
      const handoff = hasLiveWorker ? 'assignments.first-assign' : 'assignments.add-worker'
      if (!step.assignments.anchors.includes(handoff)) issues.push('handoff: missing expected live target')
      if (record.after.activeAnchor !== handoff && record.after.activeControl !== 'quiet-tour') issues.push('Done did not focus handoff or restored-view launcher')
    }
  }
  if ((!record.exitAt || record.exitAt >= 6) && !record.assignmentsBack) issues.push('picker Back restoration not exercised')
  for (const key of ['search', 'shift', 'mobileView', 'url', 'storage']) {
    if (JSON.stringify(record.assignmentsAfter[key]) !== JSON.stringify(record.assignmentsBefore[key])) issues.push(`${key} changed after tour`)
  }
  if (record.assignmentsAfter.picker || record.assignmentsAfter.names.some(name => /Sample|નમૂના|नमूना/.test(name))) issues.push('samples retained after exit')
  if (record.after.serverCalls.some(call => call.fn !== 'recordTourEventAction')) issues.push('business server call')
  if (record.after.navigations.length || apiRequests.length) issues.push('navigation/API request')
  if (process.env.REDUCED_MOTION === '1' && record.after.scrollCalls.some(call => call.behavior === 'smooth')) issues.push('smooth scroll with reduced motion')
  if (record.exitAt && Object.values(record.after.prefs).some(value => value.includes('"completed":true'))) issues.push('Exit recorded completion')
  await page.locator('[data-tour-control="quiet-tour"]').filter({ visible: true }).first().click()
  await page.locator('[data-tour-step="ma-purpose"][data-tour-status="ready"]').waitFor()
  await page.keyboard.press('Escape')
  await page.locator('.guided-tour-panel').waitFor({ state: 'detached' })
  record.issues = issues
  writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}


// GT-13: fixtures and assertions only; the required viewport/reduced-motion runs
// remain UNVERIFIED until the separately authorized browser review.
if (machines) {
  const issues = []
  const expected = ['mc-purpose', 'mc-details', 'mc-readiness', 'mc-quality', 'mc-worker', 'mc-handoff'].slice(0, record.exitAt || 6)
  if (JSON.stringify(record.steps.map(step => step.step)) !== JSON.stringify(expected)) issues.push('Machines six-step order mismatch')
  if ((!record.exitAt || record.exitAt >= 3) && !record.machinesBack) issues.push('Machines Back traversal not verified')
  for (const step of record.steps) {
    const sample = step.step !== 'mc-handoff', m = step.machines
    if (step.status !== 'ready') issues.push(step.step + ': ' + step.status + '; rail fallback requires reviewer decision if persistent on phones')
    if (step.overlapArea > 0 || step.panelOffscreen || !step.focusInPanel) issues.push(step.step + ': overlap, offscreen panel or focus escaped')
    const h = step.highlight
    if (!h || h.x < 0 || h.y < 0 || h.x + h.w > width || h.y + h.h > height) issues.push(step.step + ': outline offscreen')
    if (width >= 768 && step.context) {
      const c = step.context, p = step.panel
      if (Math.max(0, Math.min(p.x+p.w,c.x+c.w)-Math.max(p.x,c.x))*Math.max(0,Math.min(p.y+p.h,c.y+c.h)-Math.max(p.y,c.y)) > 0) issues.push(step.step + ': panel/editor overlap')
    }
    if (!m.inert || m.samples !== sample || m.bannerCount !== (sample ? 1 : 0)) issues.push(step.step + ': wrong sample state or live page not inert')
    if (m.preview !== (step.step === 'mc-details') || m.enabledFields || m.visibleClose) issues.push(step.step + ': preview state/safety mismatch')
    if (sample && (m.search !== '' || m.status !== 'all' || m.sampleCount !== 2)) issues.push(step.step + ': live filters not shadowed or incorrect sample count')
    if (sample && m.names.some(name => name.includes('Retained'))) issues.push(step.step + ': live row leaked into samples')
    if (m.url !== record.machinesBefore.url || JSON.stringify(m.storage) !== JSON.stringify(record.machinesBefore.storage)) issues.push(step.step + ': URL/drafts changed')
    if (!sample && (m.anchors !== 1 || m.search !== record.machinesBefore.search || m.status !== record.machinesBefore.status)) issues.push('Machines handoff did not restore filters/live Add machine')
    const sampleEyebrow = { en: 'Sample', gu: 'નમૂનો', hi: 'नमूना' }[lang]
    if (step.eyebrow.includes(sampleEyebrow) !== ['mc-details', 'mc-readiness'].includes(step.step)) issues.push(step.step + ': wrong preset eyebrow')
  }
  for (const key of ['search', 'status', 'url', 'storage', 'names']) if (JSON.stringify(record.machinesAfter[key]) !== JSON.stringify(record.machinesBefore[key])) issues.push(key + ' changed after Machines tour')
  if (record.machinesAfter.preview || record.machinesAfter.samples || record.machinesAfter.inert) issues.push('Machines cleanup incomplete')
  if (record.exitAt ? !['take-tour', 'quiet-tour'].includes(record.after.activeControl) : record.after.activeAnchor !== 'machines.add') issues.push('Machines Exit/Done focus incorrect')
  if (Math.abs(record.after.scroll.x - record.before.x) > 1 || Math.abs(record.after.scroll.y - record.before.y) > 1) issues.push('Machines launch scroll not restored')
  if (record.after.serverCalls.slice(record.machinesBefore.calls).some(call => call.fn !== 'recordTourEventAction')) issues.push('Machines business server action')
  if (record.after.navigations.length || apiRequests.length) issues.push('Machines navigation/API request')
  if (process.env.REDUCED_MOTION === '1' && record.after.scrollCalls.some(call => call.behavior === 'smooth')) issues.push('Machines reduced motion used smooth scrolling')
  if (record.exitAt && Object.values(record.after.prefs).some(value => value.includes('"completed":true'))) issues.push('Machines Exit recorded completion')
  if (logs.some(line => line.startsWith('pageerror:'))) issues.push('page error')
  await page.locator('[data-tour-control="quiet-tour"]').filter({ visible: true }).first().click()
  await page.locator('[data-tour-step="mc-purpose"][data-tour-status="ready"]').waitFor()
  await page.keyboard.press('Escape')
  await page.locator('.guided-tour-panel').waitFor({ state: 'detached' })
  const replay = await captureMachinesState()
  if (replay.samples || replay.preview || replay.search !== record.machinesBefore.search || replay.status !== record.machinesBefore.status) issues.push('Machines replay Exit did not restore live state')
  record.issues = issues
  writeFileSync(out + '/record.json', JSON.stringify(record, null, 2))
  if (issues.length) { console.error(issues); process.exitCode = 1 }
}

async function captureMachinesState() {
  return page.evaluate(() => {
    const visible = node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden'
    return {
      search: document.querySelector('[data-machines-tour="toolbar"] input[type="search"]')?.value,
      status: document.querySelector('[data-machines-tour="toolbar"] select')?.value,
      names: [...document.querySelectorAll('.machines-workspace-shell article h3')].map(node => node.textContent),
      samples: !!document.querySelector('[data-machines-tour-id]'),
      sampleCount: document.querySelectorAll('[data-machines-tour-id]').length,
      bannerCount: document.querySelectorAll('[data-tour-sample-banner]').length,
      preview: !!document.querySelector('[data-machines-tour-preview="true"][data-state="open"]'),
      enabledFields: [...document.querySelectorAll('[data-machines-tour-preview="true"] input, [data-machines-tour-preview="true"] select, [data-machines-tour-preview="true"] button')].filter(node => visible(node) && !node.matches(':disabled')).length,
      visibleClose: [...document.querySelectorAll('[data-machines-tour-preview="true"] [data-slot="dialog-close"], [data-machines-tour-preview="true"] [data-slot="dialog-footer"] button[type="button"]')].filter(visible).length,
      anchors: [...document.querySelectorAll('[data-tour-anchor="machines.add"]')].filter(visible).length,
      inert: document.querySelector('.machines-workspace-shell')?.inert,
      url: location.href, calls: (window.__serverCalls || []).length,
      storage: Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('weavly:tour')).sort(([a], [b]) => a.localeCompare(b))),
    }
  })
}

async function captureAssignmentsState() {
  return page.evaluate(() => {
    const visible = node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden'
    return {
      search: [...document.querySelectorAll('[data-configuration-tour="search"]')].filter(visible).map(node => node.value),
      shift: document.querySelector('[data-configuration-tour="shift"] [aria-pressed="true"]')?.textContent,
      mobileView: [...document.querySelectorAll('[aria-label="Assignment workspace view"] [aria-pressed="true"]')].filter(visible).map(node => node.textContent),
      names: [...document.querySelectorAll('[data-configuration-tour="worker"] p:first-child')].filter(visible).map(node => node.textContent),
      picker: !!document.querySelector('[data-configuration-picker-preview="true"]'),
      url: location.href,
      storage: Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('weavly:tour')).sort(([a], [b]) => a.localeCompare(b))),
    }
  })
}

async function captureWorkersState() {
  return page.evaluate(() => ({
    search: document.querySelector('[data-workers-tour="toolbar"] input[type="search"]')?.value,
    shift: document.querySelector('[data-workers-tour="shift-filter"]')?.value,
    status: document.querySelector('[data-workers-tour="status-filter"]')?.value,
    url: location.href, calls: (window.__serverCalls || []).length,
    storage: Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('weavly:tour')).sort(([a], [b]) => a.localeCompare(b))),
    prefs: Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('weavly:tour'))),
    activeControl: document.activeElement?.getAttribute('data-tour-control'),
    activeAnchor: document.activeElement?.getAttribute('data-tour-anchor'),
    preview: !!document.querySelector('[data-workers-tour-preview="true"]'),
    samples: !!document.querySelector('[data-workers-tour="groups"]'),
  }))
}

async function captureEstimatorState() {
  return page.evaluate(() => ({
    mode: [...document.querySelectorAll('[data-estimator-field="entryMode"] [role="tab"][aria-selected="true"]')].filter(element => element.getClientRects().length).map(element => element.textContent),
    liveEstimateOpen: !!document.getElementById('mobile-live-estimate-panel'),
    inputs: [...document.querySelectorAll('#estimator-form-panel input, #estimator-form-panel select, #estimator-form-panel textarea')].map(element => ({ field: element.getAttribute('data-estimator-field'), value: element.value, checked: element.checked })),
    storage: Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('weavly:tour')).sort(([a], [b]) => a.localeCompare(b))),
    serverCalls: window.__serverCalls || [],
    activeField: document.activeElement?.getAttribute('data-estimator-field'),
    activeControl: document.activeElement?.getAttribute('data-tour-control'),
  }))
}
console.log(JSON.stringify({ scenario, lang, size, steps: record.steps.length, logs: logs.slice(0, 8) }))
await browser.close()

// GT-11: capture the same real client/input and non-tour storage through replica/handoff.
async function captureProductionState() {
  const state = await page.evaluate(() => {
    const live = document.querySelector('[data-harness-production-live]')
    const search = live?.querySelector('section input')
    const board = search?.closest('section')
    return {
      mounts: window.__productionMounts, unmounts: window.__productionUnmounts ?? 0,
      search: search?.value, sameSearchNode: search === window.__productionSearchNode,
      filter: [...(board?.querySelectorAll('button') ?? [])].slice(0, 3).map(button => button.classList.contains('bg-loom')),
      storage: Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('weavly:tour')).sort(([a], [b]) => a.localeCompare(b))),
      liveHidden: !!live?.closest('[hidden]'), replica: !!document.querySelector('[data-tour-replica="production"]'),
      anchors: [...document.querySelectorAll('[data-tour-anchor="production.activate"]')].filter(node => node.getBoundingClientRect().width && node.getBoundingClientRect().height).length,
      enabledReplicaControls: [...document.querySelectorAll('[data-tour-replica="production"] button, [data-tour-replica="production"] input, [data-production-tour-preview="true"] button, [data-production-tour-preview="true"] input')].filter(node => !node.disabled).length,
      calls: (window.__serverCalls || []).length,
    }
  })
  return { ...state, apiCalls: apiRequests.length }
}

// GT-12: retained node identity plus exact device draft bytes; no production action.
async function captureDailyState() {
  const state = await page.evaluate(() => {
    const node = document.querySelector('[data-tour-anchor="daily.first-reading"], [data-tour-anchor="daily.empty-action"]')
    const visible = element => !!element && !!element.getBoundingClientRect().width && !!element.getBoundingClientRect().height
    const guide = document.querySelector('[data-tour-id="daily-sheet"]')
    const rail = guide?.closest('aside')
    const top = rail?.querySelector('.production-daily-sheet-rail-top')
    const bottom = rail?.querySelector('.production-daily-sheet-rail-bottom')
    const sheet = document.querySelector('[data-harness-daily-live] h1')
    return {
      sameNode: node === window.__dailyNode, value: node?.value ?? null, anchor: node?.getAttribute('data-tour-anchor'),
      date: document.querySelector('#base-daily-date')?.value, url: location.href,
      storage: Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('weavly:tour')).sort(([a], [b]) => a.localeCompare(b))),
      calls: (window.__serverCalls || []).length, liveHidden: !!node?.closest('[hidden]'), replica: !!document.querySelector('[data-tour-replica="daily-sheet"]'),
      enabledReplicaControls: [...document.querySelectorAll('[data-tour-replica="daily-sheet"] button, [data-tour-replica="daily-sheet"] input, [data-daily-tour-preview="true"] button, [data-daily-tour-preview="true"] input')].filter(control => !control.disabled).length,
      visibleAnchors: [...document.querySelectorAll('[data-tour-anchor="daily.first-reading"], [data-tour-anchor="daily.empty-action"]')].filter(visible).length,
      guides: [...document.querySelectorAll('[data-tour-id="daily-sheet"]')].filter(visible).length,
      guideInRightRail: visible(rail) && getComputedStyle(rail).position === 'fixed' && rail.getBoundingClientRect().left > innerWidth / 2,
      guideLast: visible(guide) && visible(top) && visible(bottom) && guide.getBoundingClientRect().top >= Math.max(top.getBoundingClientRect().bottom, bottom.getBoundingClientRect().bottom),
      guideAboveSheet: visible(guide) && visible(sheet) && guide.getBoundingClientRect().bottom <= sheet.getBoundingClientRect().top,
    }
  })
  return { ...state, apiCalls: apiRequests.length }
}

// Record actual live node identity and draft bytes without invoking business handlers.
async function capturePayrollState() {
  return page.evaluate(apiCalls => {
    const live = document.querySelector('[data-harness-payroll-live]')
    const search = document.querySelector('#base-payroll-search')
    const sample = '[data-tour-replica="payroll"] :is(button,input,select,textarea), [data-payroll-tour-preview="true"] :is(button,input,select,textarea)'
    return {
      mounts: window.__payrollMounts, unmounts: window.__payrollUnmounts ?? 0,
      sameSearchNode: search === window.__payrollSearchNode, search: search?.value,
      liveHidden: !!live?.closest('[hidden]'), replica: !!document.querySelector('[data-tour-replica="payroll"]'),
      enabledReplicaControls: [...document.querySelectorAll(sample)].filter(node => !node.disabled).length,
      paymentDate: !!document.querySelector('[data-payroll-tour-preview="true"] input[type="date"]'),
      storage: Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith('weavly:tour'))),
      prefs: Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('weavly:tour'))),
      calls: (window.__serverCalls || []).length, apiCalls,
    }
  }, apiRequests.length)
}
