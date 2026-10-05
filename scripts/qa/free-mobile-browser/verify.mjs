// Repeatable browser emulation of actual UI components over synthetic transport.
// This does not prove authentication, hosted APIs, payments or installed PWAs.
import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const base = process.argv.find(arg => arg.startsWith('--url='))?.slice(6) ?? 'http://127.0.0.1:4190'
const stage = process.argv.find(arg => arg.startsWith('--stage='))?.slice(8) ?? 'after'
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',')
const output = `output/playwright/free-mobile-redesign/${stage}`
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
const external = []
const requestLog = async page => page.request.get(`${base}/__fixture__/requests`).then(response => response.json())
const calculateRequests = async page => (await requestLog(page)).filter(request => request.path === '/api/free/calculate')
const waitFor = async (predicate, message) => {
    const limit = Date.now() + 12000
    while (Date.now() < limit) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 100)) }
    throw new Error(message)
}
async function fixture(name, task, options = {}) {
    if (only && !only.includes(name)) return
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, ...options })
    await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { external.push(url.origin); return route.abort() }
        return route.continue()
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss())
    await page.request.get(`${base}/__fixture__/reset`)
    try { await task(page, context); assert.deepEqual(errors, [], 'Uncaught browser errors'); await rm(`${output}/failure-${name}.png`, { force: true }); results.push({ name, status: 'passed' }) }
    catch (error) { results.push({ name, status: 'failed', error: error.message, pageErrors: errors }); await page.screenshot({ animations: 'disabled', path: `${output}/failure-${name}.png`, fullPage: true }).catch(() => {}) }
    finally { await context.close() }
    console.info(`${results.at(-1).status}: ${name}${results.at(-1).error ? ` — ${results.at(-1).error}` : ''}`)
}
async function enter(page, scenario = 'normal') {
    // Isolate hook state assertions from the existing successful-save route
    // handoff. That navigation is separately exercised without this override.
    await page.addInitScript(() => { window.__fixtureHoldSaveNavigation = true })
    await page.goto(`${base}/free?scenario=${scenario}`)
    await page.getByRole('heading', { name: 'Cost estimate', exact: true }).waitFor()
    await waitFor(async () => (await requestLog(page)).some(request => request.path === '/api/free/status'), 'Initial status not read')
}
async function openYarnRows(page) {
    for (const row of ['warpRows.0', 'weftRows.0']) { const button = page.locator(`[data-estimator-row="${row}"] button[aria-expanded="false"]`); if (await button.isVisible()) await button.click() }
}
async function fillInputs(page, warning = false, localized = false) {
    await openYarnRows(page)
    const qualityName = localized ? page.locator('input[data-estimator-field="qualityLabel"]') : page.getByLabel('Fabric quality name', { exact: true })
    await qualityName.fill('Synthetic mobile costing')
    const fill = async (field, value, index = 0) => page.locator(`[data-estimator-field="${field}"] input`).nth(index).fill(value)
    await fill('calcDenier', '75', 0); await fill('calcDenier', '75', 1)
    await fill('beamEnds', '3200'); await fill('picks', '68')
    await fill('yarnRate', '120', 0); await fill('yarnRate', '112', 1)
    await fill('effectiveCostingWidthCm', warning ? '10' : '44')
    await (localized ? page.locator('input[data-estimator-field="perPickCostPaisa"]') : page.getByLabel('Weaving rate in rupees per metre', { exact: true })).fill('8')
    if (await page.locator('[data-estimator-field="overheadOverridePerM"] input').count() === 0) await page.getByRole('radio', { name: 'Direct overhead rate', exact: true }).click()
    await fill('overheadOverridePerM', '3')
    await qualityName.blur()
}
async function openCost(page) {
    const openPanel = page.locator('#mobile-live-estimate-panel[data-state="open"]')
    // A closing Radix Sheet can remain visible during its exit animation.
    // Require the actual open state before reading a result or resizing it.
    if (await openPanel.isVisible()) return
    const shortcut = page.getByTestId('mobile-live-estimate-shortcut').getByRole('button')
    await shortcut.click()
    await openPanel.waitFor({ state: 'visible' })
}
const saveAction = page => page.getByTestId('save-costing-action')
async function submit(page) { await openCost(page); await saveAction(page).click() }
async function openPlans(page) {
    let action = page.locator('[data-free-plan-action="compare"]:visible').first()
    if (await action.count() === 0) await page.getByTestId('free-usage-toggle').click()
    action = page.locator('[data-free-plan-action="compare"]:visible').first()
    await action.click()
}
async function installSyntheticCheckout(page) {
    await page.addInitScript(() => {
        window.Razorpay = class {
            constructor(options) { window.__syntheticCheckout = options }
            on() {}
            open() {}
        }
    })
}

// scrollWidth alone misses content cropped by overflow-x:hidden. Inspect the
// actual rendered text ranges, interactive boxes and native-input unit gutters.
async function renderedBounds(page) {
    return page.evaluate(() => {
        const issues = [], texts = [], tolerance = 2
        const visible = element => element instanceof HTMLElement && !element.closest('.sr-only,[aria-hidden="true"],[inert]') && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        const name = element => element.closest('[data-estimator-field]')?.getAttribute('data-estimator-field') || element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 70) || element.tagName
        const clippedHorizontally = rect => rect.left < -tolerance || rect.right > innerWidth + tolerance
        for (const element of document.querySelectorAll('button,a,input,select,textarea,[role="tab"],[role="radio"]')) {
            if (!visible(element)) continue
            const rect = element.getBoundingClientRect()
            if (clippedHorizontally(rect)) issues.push({ kind: 'control-viewport', label: name(element), left: rect.left, right: rect.right })
        }
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
            const node = walker.currentNode, element = node.parentElement
            if (!node.textContent.trim() || !visible(element) || element.closest('svg,script,style,option')) continue
            const range = document.createRange(); range.selectNodeContents(node)
            for (const rect of range.getClientRects()) {
                if (!rect.width || !rect.height) continue
                const label = node.textContent.trim().slice(0, 90)
                if (clippedHorizontally(rect)) issues.push({ kind: 'text-viewport', label, left: rect.left, right: rect.right })
                const control = element.closest('button,a,[role="tab"],[role="radio"]')
                if (control) {
                    const bound = control.getBoundingClientRect()
                    if (rect.left < bound.left - tolerance || rect.right > bound.right + tolerance || rect.top < bound.top - tolerance || rect.bottom > bound.bottom + tolerance) issues.push({ kind: 'text-control', label, control: name(control) })
                }
                let fixed = false
                for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
                    const style = getComputedStyle(ancestor), bound = ancestor.getBoundingClientRect()
                    if (style.position === 'fixed') fixed = true
                    if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX) && (rect.left < bound.left - tolerance || rect.right > bound.right + tolerance)) issues.push({ kind: 'text-ancestor-clip', label, ancestor: name(ancestor) })
                }
                texts.push({ element, label, rect, fixed })
            }
        }
        for (let first = 0; first < texts.length; first++) for (let second = first + 1; second < texts.length; second++) {
            const a = texts[first], b = texts[second]
            // Fixed navigation/docks can cover scrolled content by design. Their
            // focus/clearance behavior is verified separately, not as text flow.
            if (a.fixed !== b.fixed || a.element === b.element || a.element.contains(b.element) || b.element.contains(a.element)) continue
            if (Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > tolerance && Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > tolerance) issues.push({ kind: 'text-overlap', labels: [a.label, b.label] })
        }
        for (const unit of document.querySelectorAll('span.pointer-events-none')) {
            if (!visible(unit) || getComputedStyle(unit).position !== 'absolute' || !unit.textContent?.trim()) continue
            const input = unit.parentElement.querySelector('input')
            if (!input || !visible(input)) continue
            const rect = input.getBoundingClientRect(), unitRect = unit.getBoundingClientRect(), style = getComputedStyle(input)
            const right = getComputedStyle(unit).right !== 'auto'
            const reserved = parseFloat(right ? style.paddingRight : style.paddingLeft)
            const needed = right ? rect.right - unitRect.left : unitRect.right - rect.left
            if (reserved + tolerance < needed) issues.push({ kind: 'unit-reservation', field: name(input), unit: unit.textContent.trim(), reserved, needed })
        }
        const canvas = document.createElement('canvas'), drawing = canvas.getContext('2d')
        for (const input of document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])')) {
            if (!visible(input)) continue
            const style = getComputedStyle(input)
            const available = input.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
            const required = Math.max(parseFloat(style.fontSize), parseFloat(style.lineHeight) || 0)
            if (required > available + tolerance) issues.push({ kind: 'input-vertical-clip', field: name(input), required, available })
        }
        for (const input of document.querySelectorAll('input[type="number"]')) {
            if (!visible(input) || !input.value || document.activeElement === input) continue
            const style = getComputedStyle(input)
            drawing.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
            const textWidth = drawing.measureText(input.value).width
            const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
            if (textWidth > available + tolerance) issues.push({ kind: 'number-value-clip', field: name(input), value: input.value, textWidth, available })
        }
        return issues
    })
}

async function rememberTextSizes(page) {
    await page.evaluate(() => {
        window.__syntheticTextSizes = [document.body, ...document.body.querySelectorAll('*')].filter(node => node instanceof HTMLElement).map(node => {
            const style = getComputedStyle(node)
            return { node, fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) }
        })
    })
}
async function resizeText(page, percent) {
    await page.evaluate(percent => {
        for (const { node, fontSize, lineHeight } of window.__syntheticTextSizes) {
            // Inspect settled geometry rather than a midway interpolation from
            // transition-all inputs. The viewport/layout sizes stay unchanged.
            node.style.setProperty('transition', 'none', 'important')
            node.style.setProperty('animation', 'none', 'important')
            if (Number.isFinite(fontSize)) node.style.setProperty('font-size', `${fontSize * percent / 100}px`, 'important')
            if (Number.isFinite(lineHeight)) node.style.setProperty('line-height', `${lineHeight * percent / 100}px`, 'important')
        }
    }, percent)
}

await fixture('mobile-and-desktop-captures', async page => {
    await enter(page)
    for (const [width, height] of [[320, 568], [390, 844], [430, 932], [1440, 900]]) {
        await page.setViewportSize({ width, height }); await page.screenshot({ animations: 'disabled', path: `${output}/estimator-${width}x${height}-synthetic.png`, fullPage: false })
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Estimator overflow at ${width}`)
    }
    const historyResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/free/costings' && response.ok())
    await page.goto(`${base}/free/costings`)
    await page.getByRole('heading', { name: 'Saved costings', exact: false }).first().waitFor()
    await historyResponse
    await waitFor(async () => await page.getByText('Loading...', { exact: true }).count() === 0, 'Saved history did not finish loading')
    await waitFor(async () => await page.getByText('Tour sample', { exact: true }).count() === 2, 'Synthetic saved records did not render')
    for (const [width, height] of [[320, 568], [390, 844], [430, 932], [1440, 900]]) {
        await page.setViewportSize({ width, height }); await page.screenshot({ animations: 'disabled', path: `${output}/history-${width}x${height}-synthetic.png`, fullPage: false })
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `History overflow at ${width}`)
    }
    for (const tier of ['lite', 'base']) {
        await page.goto(`${base}/free/estimator?tier=${tier}`); await page.getByRole('heading', { name: 'Cost estimate', exact: true }).waitFor()
        for (const [width, height] of [[390, 844], [1440, 900]]) { await page.setViewportSize({ width, height }); await page.screenshot({ animations: 'disabled', path: `${output}/${tier}-estimator-${width}x${height}-synthetic.png`, fullPage: false }) }
    }
}, { hasTouch: false })

await fixture('repeated-taps-and-repeated-save', async page => {
    await enter(page); await fillInputs(page); await openCost(page)
    assert(await saveAction(page).isEnabled(), 'Valid costing action disabled')
    await saveAction(page).evaluate(button => { button.click(); button.click(); button.click() })
    await page.getByTestId('free-saved-receipt').waitFor()
    assert.equal((await calculateRequests(page)).length, 1, 'Repeated tap made duplicate calculate requests')
    await openCost(page)
    assert(await saveAction(page).isDisabled(), 'Unchanged completed save must be disabled')
    await page.screenshot({ animations: 'disabled', path: `${output}/saved-result-synthetic.png`, fullPage: false })
})

await fixture('saved-result-long-identity-unsaved-rename-and-correction', async page => {
    await enter(page); await fillInputs(page)
    const labelA = 'Saved sample A — Surat 75 denier plain weave fabric for October order with a long identifiable quality name'
    const labelB = 'Unsaved renamed sample B — revised October customer quality'
    const name = page.getByLabel('Fabric quality name', { exact: true })
    await name.fill(labelA); await name.blur(); await submit(page)
    await page.getByTestId('free-saved-receipt').waitFor()
    await openCost(page)
    await page.getByRole('button', { name: 'Close', exact: true }).last().click()
    await name.fill(labelB); await name.blur(); await openCost(page)
    const identity = page.locator('[data-free-result-identity] > .free-mobile-only')
    assert.equal(await identity.innerText(), `Saved ${labelA} · v1`, 'Saved result must retain saved record name and revision after an unsaved rename')
    assert(!(await identity.innerText()).includes(labelB))
    const dimensions = await identity.evaluate(span => {
        const container = span.parentElement
        const style = getComputedStyle(container)
        return { lines: span.getClientRects().length, overflowX: style.overflowX, whiteSpace: style.whiteSpace, scrollWidth: container.scrollWidth, width: container.clientWidth, scrollHeight: container.scrollHeight, height: container.clientHeight }
    })
    assert(dimensions.lines > 1, 'Long saved identity should wrap at 320px')
    assert.equal(dimensions.whiteSpace, 'normal'); assert.equal(dimensions.overflowX, 'visible')
    assert(dimensions.scrollWidth <= dimensions.width && dimensions.scrollHeight <= dimensions.height, 'Saved identity must not clip')
    await page.screenshot({ animations: 'disabled', path: `${output}/saved-long-identity-unsaved-rename-synthetic.png`, fullPage: false })
    await page.setViewportSize({ width: 1440, height: 900 })
    const desktopIdentity = page.locator('[data-free-result-identity] > .free-desktop-only')
    assert.equal(await desktopIdentity.innerText(), `${labelA} · v1`, 'Desktop saved result must retain saved record identity after an unsaved rename')
    assert(await desktopIdentity.isVisible()); assert(!(await desktopIdentity.innerText()).includes(labelB))
    await page.screenshot({ animations: 'disabled', path: `${output}/saved-long-identity-unsaved-rename-desktop-synthetic.png`, fullPage: false })
    await page.setViewportSize({ width: 320, height: 568 })
    await saveAction(page).click()
    await waitFor(async () => (await page.getByTestId('free-saved-receipt').innerText()).includes(labelB), 'Correction receipt did not use saved renamed label')
    assert((await page.getByTestId('free-saved-receipt').innerText()).includes('Recalculated and saved · no costing used'), 'Eligible correction must show truthful no-charge receipt copy')
    await openCost(page)
    assert.equal(await identity.innerText(), `Saved ${labelB} · v2`, 'Correction must identify the newly saved revision')
    const sent = await calculateRequests(page)
    assert.equal(sent.length, 2); assert.equal(sent[0].body.label, labelA); assert.equal(sent[1].body.label, labelB)
    assert.equal(sent[1].body.expectedRevision, 1); assert.equal(sent[1].body.costingId, requestIdOfToken(sent[0].body.requestToken))
    const status = await page.request.get(`${base}/api/free/status`).then(response => response.json())
    assert.equal(status.quota.used, 1); assert.equal(status.quota.remaining, 1, 'Eligible correction must not consume another allowance')
    await page.screenshot({ animations: 'disabled', path: `${output}/saved-long-identity-corrected-v2-synthetic.png`, fullPage: false })
}, { viewport: { width: 320, height: 568 } })

function requestIdOfToken(token) { return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()).requestId }

await fixture('saved-history-route-handoff', async page => {
    await enter(page); await page.evaluate(() => { window.__fixtureHoldSaveNavigation = false }); await fillInputs(page); await submit(page)
    await page.waitForURL(/\/free\/costings\?costing=/)
    await page.getByRole('heading', { name: 'Saved costings', exact: false }).first().waitFor()
    await page.getByRole('dialog').waitFor()
    assert(await page.getByRole('dialog').getByText('Synthetic mobile costing', { exact: true }).isVisible())
    await page.screenshot({ animations: 'disabled', path: `${output}/saved-history-handoff-synthetic.png`, fullPage: false })
})

await fixture('invalid-input-feedback-no-request', async page => {
    await enter(page); await openCost(page)
    assert(await saveAction(page).isDisabled(), 'Invalid costing action enabled')
    assert.equal((await calculateRequests(page)).length, 0)
    await page.screenshot({ animations: 'disabled', path: `${output}/invalid-inputs-synthetic.png`, fullPage: false })
})

await fixture('warning-cancel-confirm', async page => {
    await enter(page); await fillInputs(page, true); await submit(page)
    await page.getByRole('heading', { name: 'Review unusual values' }).waitFor()
    await page.screenshot({ animations: 'disabled', path: `${output}/client-warning-review-synthetic.png`, fullPage: false })
    assert.equal((await calculateRequests(page)).length, 0, 'Warning must precede sending')
    await page.getByRole('button', { name: 'Go back', exact: true }).click()
    assert.equal((await calculateRequests(page)).length, 0)
    await submit(page); await page.getByRole('heading', { name: 'Review unusual values' }).waitFor()
    await page.getByRole('button', { name: 'Review and save', exact: true }).click()
    await page.getByTestId('free-saved-receipt').waitFor()
    const sent = await calculateRequests(page)
    assert.equal(sent.length, 1); assert.equal(sent[0].body.warningsAcknowledged, true)
})

await fixture('server-warning-correct-confirm', async page => {
    await enter(page, 'warning'); await fillInputs(page); await submit(page)
    await page.getByTestId('free-recovery-warning').waitFor()
    await page.screenshot({ animations: 'disabled', path: `${output}/server-warning-review-synthetic.png`, fullPage: false })
    assert.equal((await calculateRequests(page)).length, 1)
    await page.locator('[data-free-recovery-action="correct"]').click()
    await page.getByLabel('Fabric quality name', { exact: true }).fill('Corrected server-reviewed costing')
    await submit(page); await page.getByTestId('free-recovery-warning').waitFor()
    await page.screenshot({ animations: 'disabled', path: `${output}/server-warning-confirm-synthetic.png`, fullPage: false })
    await page.locator('[data-free-recovery-action="confirm"]').click()
    await page.getByTestId('free-saved-receipt').waitFor()
    const sent = await calculateRequests(page)
    assert.equal(sent.length, 3); assert.equal(sent[1].body.requestToken, sent[2].body.requestToken)
    assert.equal(sent[1].body.warningsAcknowledged, false); assert.equal(sent[2].body.warningsAcknowledged, true)
    assert.deepEqual(sent[1].body.estimate, sent[2].body.estimate)
})

await fixture('uncertain-outcome-safe-exact-retry', async page => {
    await enter(page, 'uncertain'); await fillInputs(page); await submit(page)
    await page.getByTestId('free-recovery-pending').waitFor()
    await page.screenshot({ animations: 'disabled', path: `${output}/uncertain-outcome-synthetic.png`, fullPage: false })
    await page.locator('[data-free-recovery-action="retry"]').click()
    await page.getByTestId('free-saved-receipt').waitFor()
    const sent = await calculateRequests(page)
    assert.equal(sent.length, 2); assert.deepEqual(sent[1].body, sent[0].body, 'Safe retry must use exact body/token')
})

await fixture('saved-result-balance-refresh-failure', async page => {
    await enter(page, 'balance-failure'); await fillInputs(page); await submit(page)
    await page.getByTestId('free-saved-receipt').waitFor()
    await waitFor(async () => await page.getByTestId('free-usage-card').getByText(/balance could not be refreshed/i).count() > 0, 'Unverified balance message absent')
    assert(await page.getByTestId('free-saved-receipt').isVisible(), 'Balance refresh failure removed saved receipt')
    await page.screenshot({ animations: 'disabled', path: `${output}/saved-balance-unverified-synthetic.png`, fullPage: false })
})

await fixture('zero-allowance-and-eligible-correction', async page => {
    await enter(page, 'zero'); await fillInputs(page); await openCost(page)
    assert(await saveAction(page).isDisabled(), 'New costing must be blocked at zero allowance')
    await page.screenshot({ animations: 'disabled', path: `${output}/zero-allowance-new-costing-synthetic.png`, fullPage: false })
    await enter(page, 'correction')
    await page.getByLabel('Fabric quality name', { exact: true }).fill('Corrected synthetic')
    await submit(page); await page.getByTestId('free-saved-receipt').waitFor()
    const sent = await calculateRequests(page)
    assert.equal(sent.length, 1); assert(sent[0].body.costingId); assert.equal(sent[0].body.expectedRevision, 1)
    await page.screenshot({ animations: 'disabled', path: `${output}/zero-allowance-correction-synthetic.png`, fullPage: false })
})

await fixture('leave-cancel-and-browser-back-forward', async page => {
    await page.goto(`${base}/free/costings`); await enter(page)
    await page.getByLabel('Fabric quality name', { exact: true }).fill('Retained in this page')
    await page.locator('[data-mobile-navigation] a[href="/free/costings"]').click()
    await page.getByRole('dialog').waitFor()
    await page.getByRole('button', { name: /stay on/i }).click()
    assert.equal(await page.getByLabel('Fabric quality name', { exact: true }).inputValue(), 'Retained in this page')
    await page.goBack(); assert(new URL(page.url()).pathname === '/free/costings')
    await page.goForward(); assert(new URL(page.url()).pathname === '/free')
    // A full route remount has no durable Free draft. Browser bfcache policy is
    // engine-specific; do not claim that Back/Forward always discards it.
    await page.reload()
    assert.equal(await page.getByLabel('Fabric quality name', { exact: true }).inputValue(), '')
})

await fixture('upgrade-dismiss-retained-inputs', async page => {
    await installSyntheticCheckout(page)
    await enter(page); await fillInputs(page)
    await openPlans(page)
    await page.getByRole('button', { name: /Continue (with|on) Free|Keep using Free/i }).click()
    assert.equal(await page.getByLabel('Fabric quality name', { exact: true }).inputValue(), 'Synthetic mobile costing')
    await openPlans(page)
    await page.locator('#subscribe-btn-lite').click()
    await waitFor(async () => await page.evaluate(() => Boolean(window.__syntheticCheckout)), 'Synthetic checkout not opened')
    await page.evaluate(() => window.__syntheticCheckout.modal.ondismiss())
    await waitFor(async () => (await requestLog(page)).some(request => request.path === '/api/billing/status'), 'Dismissal was not reconciled')
    assert.equal(await page.getByLabel('Fabric quality name', { exact: true }).inputValue(), 'Synthetic mobile costing')
    assert.equal((await calculateRequests(page)).length, 0)
    await page.screenshot({ animations: 'disabled', path: `${output}/upgrade-dismiss-synthetic.png`, fullPage: false })
})

await fixture('verified-upgrade-in-place-retained-inputs', async page => {
    await installSyntheticCheckout(page)
    await enter(page, 'upgrade-active'); await fillInputs(page); await openPlans(page)
    await page.locator('#subscribe-btn-lite').click()
    await waitFor(async () => await page.evaluate(() => Boolean(window.__syntheticCheckout)), 'Synthetic checkout not opened')
    await page.evaluate(() => window.__syntheticCheckout.handler({ razorpay_payment_id: 'pay_synthetic', razorpay_order_id: 'order_synthetic', razorpay_signature: 'synthetic' }))
    await waitFor(async () => await page.getByTestId('free-usage-card').count() === 0, 'Verified paid activation did not switch mounted estimator')
    assert.equal(await page.getByLabel('Fabric quality name', { exact: true }).inputValue(), 'Synthetic mobile costing')
    assert.equal((await calculateRequests(page)).length, 0)
    const drafts = await page.evaluate(() => Object.keys(localStorage).filter(key => /estimator.*draft|draft.*estimator/.test(key)))
    assert.deepEqual(drafts, [], 'In-place upgrade must not introduce durable estimator draft')
    await page.screenshot({ animations: 'disabled', path: `${output}/upgrade-activation-synthetic.png`, fullPage: false })
})

await fixture('keyboard-viewport-simulation', async page => {
    await page.addInitScript(() => {
        window.__syntheticKeyboardHeight = null
        Object.defineProperty(window.visualViewport, 'height', { get: () => window.__syntheticKeyboardHeight ?? innerHeight })
    })
    await enter(page)
    await page.getByLabel('Fabric quality name', { exact: true }).focus()
    await page.evaluate(() => { window.__syntheticKeyboardHeight = innerHeight - 300; visualViewport.dispatchEvent(new Event('resize')) })
    await waitFor(async () => await page.locator('html[data-mobile-keyboard]').count() > 0, 'Keyboard observer did not respond to shrunken emulated viewport')
    assert(await page.locator('[data-mobile-navigation]').isHidden(), 'Bottom bar should hide with emulated keyboard')
    assert(await page.getByTestId('mobile-live-estimate-shortcut').isHidden(), 'Dock should hide with emulated keyboard')
    await page.screenshot({ animations: 'disabled', path: `${output}/keyboard-simulation-synthetic.png`, fullPage: false })
    await page.evaluate(() => { window.__syntheticKeyboardHeight = innerHeight; visualViewport.dispatchEvent(new Event('resize')) })
    await page.getByLabel('Fabric quality name', { exact: true }).blur()
    await waitFor(async () => await page.locator('html[data-mobile-keyboard]').count() === 0, 'Keyboard observer did not clear')
    assert(await page.locator('[data-mobile-navigation]').isVisible())
})

await fixture('320-reflow-enlarged-text-language-mode-focus', async page => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.addInitScript(() => localStorage.setItem('weavly-estimator-width-unit', 'inch'))
    const bounds = []
    for (const language of ['en', 'hi', 'gu']) {
        await page.goto(`${base}/free?language=${language}`)
        await waitFor(async () => await page.locator('html').getAttribute('lang') === language, 'Language did not load')
        // Expanded yarn rows and real numeric inputs exercise units as well as
        // the introductory state; native value scrolling remains allowed.
        await fillInputs(page, false, true)
        await rememberTextSizes(page)
        for (const percent of [150, 200]) {
            await resizeText(page, percent)
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${percent}% enlarged text overflow in ${language}`)
            bounds.push({ language, percent, issues: await renderedBounds(page) })
            await page.screenshot({ animations: 'disabled', path: `${output}/enlarged-${language}-${percent}percent-320x568-synthetic.png`, fullPage: false })
        }
        await page.locator('#free-estimator-help-trigger').click()
        bounds.push({ language, percent: 200, state: 'help-replay', issues: await renderedBounds(page) })
        await page.screenshot({ animations: 'disabled', path: `${output}/enlarged-${language}-200percent-help-replay-synthetic.png`, fullPage: false })
        assert(await page.locator('#free-estimator-help [data-tour-control="quiet-tour"]').isVisible(), 'Enlarged replay guide launcher stays discoverable')
        await page.locator('#free-estimator-help-close').click()
        assert(await page.locator('#free-estimator-help-trigger').evaluate(button => button === document.activeElement), 'Enlarged estimator Help Close should return focus')
        await page.locator('[data-tour-anchor="estimator.quick-weft"] button[aria-pressed]').first().click()
        await page.waitForTimeout(200)
        assert.equal(await page.locator('[data-estimator-field="effectiveCostingWidthCm"] input').inputValue(), '111.76', 'Switching the display unit must preserve finished width')
        bounds.push({ language, percent: 200, mode: 'cm', issues: await renderedBounds(page) })
        await page.locator('[data-estimator-field="effectiveCostingWidthCm"] input').scrollIntoViewIfNeeded()
        await page.screenshot({ animations: 'disabled', path: `${output}/enlarged-${language}-200percent-cm-synthetic.png`, fullPage: false })
        await page.locator('[data-estimator-field="weavingRateMode"] [role="radio"]').nth(1).click()
        await page.waitForTimeout(200)
        bounds.push({ language, percent: 200, mode: 'paise-per-pick', issues: await renderedBounds(page) })
        await page.locator('input[data-estimator-field="perPickCostPaisa"]').scrollIntoViewIfNeeded()
        await page.screenshot({ animations: 'disabled', path: `${output}/enlarged-${language}-200percent-paise-per-pick-synthetic.png`, fullPage: false })
        const lastField = page.locator('[data-estimator-field="orderQuantityM"] input').last()
        await lastField.focus(); await lastField.scrollIntoViewIfNeeded()
        assert(await lastField.evaluate(input => input === document.activeElement), `Last costing field lost focus in ${language}`)
        await page.screenshot({ animations: 'disabled', path: `${output}/enlarged-${language}-200percent-last-field-synthetic.png`, fullPage: false })
        await page.goto(`${base}/free?language=${language}`)
        await waitFor(async () => await page.locator('html').getAttribute('lang') === language, 'Manual unit language did not load')
        await fillInputs(page, false, true)
        for (const [row, amount] of [['warpRows.0', '3.25'], ['weftRows.0', '2.75']]) {
            await page.locator(`[data-estimator-row="${row}"] [data-estimator-field="calculationMode"] [role="radio"]`).nth(1).click()
            await page.locator(`[data-estimator-row="${row}"] [data-estimator-field="manualKgPer100m"] input`).fill(amount)
        }
        await rememberTextSizes(page); await resizeText(page, 200)
        bounds.push({ language, percent: 200, mode: 'manual-kg-per-100m', issues: await renderedBounds(page) })
        await page.locator('[data-estimator-row="warpRows.0"] [data-estimator-field="manualKgPer100m"] input').scrollIntoViewIfNeeded()
        await page.screenshot({ animations: 'disabled', path: `${output}/enlarged-${language}-200percent-manual-kg-synthetic.png`, fullPage: false })
        await page.goto(`${base}/free?language=${language}&guide-invite=1`)
        await page.locator('#free-estimator-help .mobile-guide-title-toggle').waitFor({ state: 'attached' })
        await rememberTextSizes(page); await resizeText(page, 200)
        await page.locator('#free-estimator-help-trigger').click()
        bounds.push({ language, percent: 200, state: 'help-invitation', issues: await renderedBounds(page) })
        await page.locator('#free-estimator-help .mobile-guide-title-toggle').click()
        bounds.push({ language, percent: 200, state: 'help-invitation-details', issues: await renderedBounds(page) })
        await page.screenshot({ animations: 'disabled', path: `${output}/enlarged-${language}-200percent-help-invitation-synthetic.png`, fullPage: false })
        assert(await page.locator('#free-estimator-help [data-tour-control="take-tour"]').isVisible(), 'Enlarged invitation guide launcher stays discoverable')
        await page.locator('#free-estimator-help-close').click()
        assert(await page.locator('#free-estimator-help-trigger').evaluate(button => button === document.activeElement), 'Enlarged invitation Help Close should return focus')
    }
    await writeFile(`${output}/text-control-bounds.json`, JSON.stringify(bounds, null, 2))
    assert.deepEqual(bounds.filter(item => item.issues.length), [], 'Rendered labels/actions or input unit gutters overlap or clip at enlarged text')
    await page.goto(`${base}/free?language=en`); await fillInputs(page)
    await page.getByRole('tab', { name: 'Detailed', exact: true }).click()
    assert.equal(await page.getByLabel('Fabric quality name', { exact: true }).inputValue(), 'Synthetic mobile costing')
    await page.getByRole('tab', { name: 'Quick', exact: true }).click()
    assert.equal(await page.getByLabel('Fabric quality name', { exact: true }).inputValue(), 'Synthetic mobile costing')
    await page.keyboard.press('Tab')
    assert(await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement !== document.body), 'Tab focus did not enter an element')
    const smallControls = await page.locator('[data-mobile-navigation] a, [data-mobile-navigation] button').evaluateAll(nodes => nodes.filter(node => { const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44) }).map(node => ({ label: node.textContent?.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })))
    assert.deepEqual(smallControls, [], 'Mobile nav touch targets below 44px')
})

await fixture('help-close-focus-and-history-filter-summary', async page => {
    await enter(page)
    const estimatorHelp = page.locator('#free-estimator-help-trigger')
    await estimatorHelp.click(); await page.locator('#free-estimator-help').waitFor({ state: 'visible' })
    assert(await page.getByRole('button', { name: 'Start the Cost Estimator guide', exact: true }).isVisible())
    await page.locator('#free-estimator-help-close').click()
    assert(await page.locator('#free-estimator-help').isHidden())
    assert(await estimatorHelp.evaluate(button => button === document.activeElement), 'Estimator Help Close should return focus')
    await page.goto(`${base}/free/costings`)
    const help = page.locator('#free-history-help-trigger')
    await help.click(); await page.locator('#free-history-help').waitFor({ state: 'visible' })
    await page.locator('#free-history-help').getByRole('button', { name: 'Close', exact: true }).click()
    assert(await help.evaluate(button => button === document.activeElement), 'History Help Close should return focus')
    const filters = page.getByRole('button', { name: 'Filters & sort', exact: true })
    assert(await page.locator('#free-history-filters').isHidden())
    await filters.click()
    await page.getByLabel('Sort by', { exact: true }).selectOption('oldest')
    await page.getByLabel('Margin', { exact: true }).selectOption('10_to_20')
    await filters.click()
    assert(await page.locator('#free-history-filters').isHidden())
    assert(await page.getByRole('status').filter({ hasText: 'Oldest saved · 10–20%' }).isVisible(), 'Collapsed filters should disclose active values')
    await filters.click()
    assert.equal(await page.getByLabel('Sort by', { exact: true }).inputValue(), 'oldest')
    assert.equal(await page.getByLabel('Margin', { exact: true }).inputValue(), '10_to_20')
    await page.screenshot({ animations: 'disabled', path: `${output}/history-filters-help-synthetic.png`, fullPage: false })
    const historyBounds = []
    await page.setViewportSize({ width: 320, height: 568 })
    for (const language of ['en', 'hi', 'gu']) {
        const loaded = page.waitForResponse(response => new URL(response.url()).pathname === '/api/free/costings' && response.ok())
        await page.goto(`${base}/free/costings?language=${language}`)
        await loaded
        await waitFor(async () => await page.getByText('Tour sample', { exact: true }).count() === 2, 'Synthetic saved records did not render before history text checks')
        await rememberTextSizes(page); await resizeText(page, 200)
        historyBounds.push({ language, percent: 200, state: 'initial', issues: await renderedBounds(page) })
        await page.screenshot({ animations: 'disabled', path: `${output}/history-enlarged-${language}-200percent-synthetic.png`, fullPage: false })
        await page.locator('#saved-costings-search').fill('Tour sample')
        const localizedFilters = page.locator('.free-history-filter-toggle')
        await localizedFilters.click()
        await page.locator('#saved-costings-sort').selectOption('oldest')
        await page.locator('#saved-costings-margin').selectOption('10_to_20')
        historyBounds.push({ language, percent: 200, state: 'active-filters', issues: await renderedBounds(page) })
        await localizedFilters.click()
        assert.equal(await page.locator('#saved-costings-search').inputValue(), 'Tour sample', 'History search retained with collapsed filters')
        assert(await page.getByRole('status').filter({ hasText: '10–20%' }).isVisible(), 'Enlarged active filter summary remains visible')
        await localizedFilters.click()
        assert.equal(await page.locator('#saved-costings-sort').inputValue(), 'oldest')
        assert.equal(await page.locator('#saved-costings-margin').inputValue(), '10_to_20')
        await page.locator('#free-history-help-trigger').click()
        historyBounds.push({ language, percent: 200, state: 'help-and-filters', issues: await renderedBounds(page) })
        await page.locator('#free-history-help .mobile-guide-title-toggle').click()
        historyBounds.push({ language, percent: 200, state: 'help-details-and-filters', issues: await renderedBounds(page) })
        await page.screenshot({ animations: 'disabled', path: `${output}/history-enlarged-${language}-200percent-help-filters-synthetic.png`, fullPage: false })
        await page.locator('#free-history-help > button').click()
        assert(await page.locator('#free-history-help-trigger').evaluate(button => button === document.activeElement), 'Enlarged History Help Close should return focus')
        await page.locator('#saved-costings-search').focus()
        assert(await page.locator('#saved-costings-search').evaluate(input => { const rect = input.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight }), 'Enlarged search remains visible when focused')
    }
    await writeFile(`${output}/history-text-control-bounds.json`, JSON.stringify(historyBounds, null, 2))
    assert.deepEqual(historyBounds.filter(item => item.issues.length), [], 'History text, controls or native input lineboxes clip at enlarged text')
})

await fixture('active-guide-help-and-restored-inputs', async page => {
    await enter(page)
    await page.getByLabel('Fabric quality name', { exact: true }).fill('Retained before guide')
    await page.locator('#free-estimator-help-trigger').click()
    const launcher = page.getByRole('button', { name: 'Start the Cost Estimator guide', exact: true })
    await launcher.click()
    await page.getByTestId('guided-tour-panel').waitFor()
    assert(await page.locator('#free-estimator-help').isVisible(), 'Active guide must retain discoverable Help surface')
    assert(await page.locator('#free-estimator-help-trigger').isDisabled())
    await page.locator('[data-tour-control="exit"]').click()
    await page.getByTestId('guided-tour-panel').waitFor({ state: 'hidden' })
    assert.equal(await page.getByLabel('Fabric quality name', { exact: true }).inputValue(), 'Retained before guide')
    await page.locator('#free-estimator-help-close').click()
    assert(await page.locator('#free-estimator-help-trigger').evaluate(button => button === document.activeElement))
})

await fixture('paid-live-calculation-distinction', async page => {
    for (const tier of ['lite', 'base']) {
        await page.goto(`${base}/free/estimator?tier=${tier}`)
        await page.getByRole('heading', { name: 'Cost estimate', exact: true }).waitFor()
        await fillInputs(page)
        assert.equal(await page.getByTestId('free-usage-card').count(), 0)
        await openCost(page)
        const metrics = page.locator('[data-estimator-field="liveCostMetrics"]')
        const before = await metrics.innerText()
        await page.getByRole('button', { name: 'Close', exact: true }).last().click()
        await page.locator('[data-estimator-field="overheadOverridePerM"] input').fill('13')
        await openCost(page)
        assert.notEqual(await metrics.innerText(), before, `${tier} live monetary output must update without a metered Calculate`)
        assert.equal((await calculateRequests(page)).length, 0)
        await page.screenshot({ animations: 'disabled', path: `${output}/${tier}-live-result-synthetic.png`, fullPage: false })
    }
})

await fixture('accessible-labels-and-touch-regions', async page => {
    await enter(page); await openYarnRows(page)
    const unnamedInputs = await page.locator('input').evaluateAll(inputs => inputs.filter(input => input.checkVisibility() && !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby') && !input.labels?.length).map(input => input.outerHTML.slice(0, 180)))
    assert.deepEqual(unnamedInputs, [], 'Visible input needs accessible label')
    const smallControls = await page.locator('button,a,input').evaluateAll(nodes => nodes.filter(node => {
        const rect = node.getBoundingClientRect()
        return node.checkVisibility() && rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
    }).map(node => ({ label: node.getAttribute('aria-label') || node.textContent?.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })))
    await writeFile(`${output}/touch-regions.json`, JSON.stringify(smallControls, null, 2))
    assert.deepEqual(smallControls, [], 'Visible mobile controls need 44px touch regions')
})

await browser.close()
const report = {
    evidenceType: 'Automated Chromium browser emulation; synthetic localhost transport and records only. No installed iOS/Android PWA, authentication, real server outcomes or payment-provider verification.',
    mockBoundaries: ['Next navigation/dynamic/image adapters', 'Server actions replaced by synthetic empty answers', 'Inert Supabase auth subscription', 'Local in-memory Free/billing APIs, original costing engine', 'Synthetic Razorpay callback for dismissal/activation', 'Successful-save navigation held only for hook state checks; normal saved-history handoff tested separately', 'Software keyboard represented by a shrunken visualViewport, not an installed device'],
    base, stage, createdAt: new Date().toISOString(), externalRequestsBlocked: [...new Set(external)], results,
}
const reportPath = `${output}/${only ? `verification-${only.length === 1 ? only[0] : 'selected'}` : 'verification'}.json`
await writeFile(reportPath, JSON.stringify(report, null, 2))
console.info(JSON.stringify({ passed: results.filter(result => result.status === 'passed').length, failed: results.filter(result => result.status === 'failed').length, report: reportPath }))
if (results.some(result => result.status === 'failed')) process.exitCode = 1
