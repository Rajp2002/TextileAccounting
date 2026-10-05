// Browser emulation over actual components and synthetic localhost transports.
// Installed PWA, authentication and hosted transaction guarantees are unrun.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const base = process.argv.find(arg => arg.startsWith('--url='))?.slice(6) ?? 'http://127.0.0.1:4197'
const stage = process.argv.find(arg => arg.startsWith('--stage='))?.slice(8) ?? 'after'
const sourceCommit = process.argv.find(arg => arg.startsWith('--source-commit='))?.slice(16)
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',')
const output = `output/playwright/lite-mobile-redesign/estimator/${stage}`
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = [], external = [], measurements = []
const waitFor = async (predicate, message) => {
    const until = Date.now() + 12000
    while (Date.now() < until) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 100)) }
    throw new Error(message)
}
async function fixture(name, task, options = {}) {
    if (only && !only.includes(name)) return
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: false, ...options })
    await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { external.push(url.origin); return route.abort() }
        return route.continue()
    })
    const page = await context.newPage(), errors = []
    page.setDefaultTimeout(8000)
    page.setDefaultNavigationTimeout(30000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => dialog.dismiss())
    await page.request.get(`${base}/__fixture__/reset`)
    try { await task(page, context); assert.deepEqual(errors, [], 'Uncaught browser errors'); results.push({ name, status: 'passed' }) }
    catch (error) { results.push({ name, status: 'failed', error: error.message, pageErrors: errors }); await page.screenshot({ animations: 'disabled', path: `${output}/failure-${name}.png`, fullPage: true }).catch(() => {}) }
    finally { await context.close() }
    console.info(`${results.at(-1).status}: ${name}${results.at(-1).error ? ` — ${results.at(-1).error}` : ''}`)
}
async function enter(page, query = '') {
    await page.goto(`${base}/owner/estimator${query ? `?${query}` : ''}`)
    await page.locator('input[data-estimator-field="qualityLabel"]').waitFor()
    const language=new URLSearchParams(query).get('language');if(language)await waitFor(async()=>await page.locator('html').getAttribute('lang')===language,'Requested language did not load')
}
async function openRows(page) {
    for (const row of ['warpRows.0', 'weftRows.0']) { const toggle = page.locator(`[data-estimator-row="${row}"] button[aria-expanded="false"]`); if (await toggle.isVisible()) await toggle.click() }
}
async function fillInputs(page, warning = false) {
    await openRows(page)
    await page.locator('input[data-estimator-field="qualityLabel"]').fill('Synthetic Lite costing')
    const fill = async (field, value, index = 0) => page.locator(`[data-estimator-field="${field}"] input`).nth(index).fill(value)
    await fill('calcDenier', '75', 0); await fill('calcDenier', '75', 1)
    await fill('beamEnds', '3200'); await fill('picks', '68')
    await fill('yarnRate', '120', 0); await fill('yarnRate', '112', 1)
    await fill('effectiveCostingWidthCm', warning ? '10' : '44')
    await page.locator('input[data-estimator-field="perPickCostPaisa"]').fill('8')
    await fill('overheadOverridePerM', '3')
    await page.locator('input[data-estimator-field="qualityLabel"]').blur()
}
async function openCost(page) {
    const panel = page.locator('#mobile-live-estimate-panel[data-state="open"]')
    if (await panel.isVisible()) return
    await page.getByTestId('mobile-live-estimate-shortcut').getByRole('button').click()
    await panel.waitFor({ state: 'visible' })
}
// scrollWidth alone misses content cropped by overflow-x:hidden. Inspect the
// actual rendered text ranges, interactive boxes and native-input unit gutters.
async function renderedBounds(page) {
    return page.evaluate(() => {
        const issues = [], texts = [], tolerance = 2
        const paintedAt=(x,y)=>{
            // Radix inherits pointer-events:none into notices outside its
            // modal. Temporarily normalize hit eligibility to inspect visual
            // stack order; restore styles before recording screenshots.
            const toasters=[...document.querySelectorAll('[data-sonner-toaster]')].map(node=>({node,value:node.style.getPropertyValue('pointer-events'),priority:node.style.getPropertyPriority('pointer-events')}))
            for(const {node} of toasters)node.style.setProperty('pointer-events','auto','important')
            const painted=document.elementsFromPoint(x,y).find(node=>node instanceof HTMLElement)
            for(const {node,value,priority}of toasters){if(value)node.style.setProperty('pointer-events',value,priority);else node.style.removeProperty('pointer-events')}
            return painted
        }
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
            const left=Math.max(a.rect.left,b.rect.left),right=Math.min(a.rect.right,b.rect.right),top=Math.max(a.rect.top,b.rect.top),bottom=Math.min(a.rect.bottom,b.rect.bottom)
            if(right-left<=tolerance||bottom-top<=tolerance)continue
            const toastText=a.element.closest('[data-sonner-toast]')?a:b.element.closest('[data-sonner-toast]')?b:null
            const modalText=a.element.closest('[data-slot="dialog-content"],[data-slot="sheet-content"]')?a:b.element.closest('[data-slot="dialog-content"],[data-slot="sheet-content"]')?b:null
            if(toastText&&modalText&&left>=0&&right<=innerWidth&&top>=0&&bottom<=innerHeight){
                // A success notice painted below the modal is intentionally
                // obscured, unlike a notice covering consequential content.
                const painted=paintedAt((left+right)/2,(top+bottom)/2)
                if(painted?.closest('[data-slot="dialog-content"],[data-slot="sheet-content"]'))continue
            }
            issues.push({ kind: 'text-overlap', labels: [a.label, b.label] })
        }
        for (const unit of document.querySelectorAll('span.pointer-events-none')) {
            if (!visible(unit) || getComputedStyle(unit).position !== 'absolute' || !unit.textContent?.trim()) continue
            const input = unit.parentElement.querySelector('input')
            if (!input || !visible(input)) continue
            const rect = input.getBoundingClientRect(), unitRect = unit.getBoundingClientRect(), style = getComputedStyle(input)
            const right = (unitRect.left + unitRect.right) / 2 >= (rect.left + rect.right) / 2
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



async function touchBounds(page) {
    return page.locator('button,a,input,[role="menuitem"]').evaluateAll(nodes=>nodes.filter(node=>node.checkVisibility()&&!node.closest('[inert],[aria-hidden="true"],.sr-only')&&getComputedStyle(node).pointerEvents!=='none').map(node=>{
        const rect=node.getBoundingClientRect()
        let left=rect.left,right=rect.right,top=rect.top,bottom=rect.bottom
        // Transparent pseudo elements can intentionally enlarge an icon's
        // actual clickable region, as Weavly's32px toast close button does.
        for(const pseudo of ['::before','::after']) {
            const style=getComputedStyle(node,pseudo)
            if(style.content==='none'||style.content==='normal'||style.position!=='absolute'||style.pointerEvents==='none')continue
            const x=parseFloat(style.left),y=parseFloat(style.top),width=parseFloat(style.width),height=parseFloat(style.height)
            if([x,y,width,height].every(Number.isFinite)){left=Math.min(left,rect.left+x);right=Math.max(right,rect.left+x+width);top=Math.min(top,rect.top+y);bottom=Math.max(bottom,rect.top+y+height)}
        }
        return {label:node.getAttribute('aria-label')||node.textContent?.trim(),width:right-left,height:bottom-top}
    }).filter(rect=>rect.width>0&&rect.height>0&&(rect.width<43.5||rect.height<43.5)))
}

const draftKey = 'weavly-estimator-draft-synthetic-org-synthetic-owner'
const screenshot = (page,name,fullPage=false) => page.screenshot({animations:'disabled',path:`${output}/${name}-synthetic.png`,fullPage})
const requests = async page => (await page.request.get(`${base}/__fixture__/requests`)).json()
const actions = async (page,name) => (await requests(page)).filter(item=>item.path===`/__fixture__/action/${name}`)
const field = (page,name,index=0) => page.locator(`[data-estimator-field="${name}"] input`).nth(index)
async function openPicker(page) { await page.getByTestId('saved-quality-quick-picker').click(); await page.locator('#saved-qualities-sheet-panel[data-state="open"]').waitFor({state:'visible'}) }
async function closePicker(page) { await page.locator('#saved-qualities-sheet-panel').getByRole('button',{name:'Close',exact:true}).click(); await page.locator('#saved-qualities-sheet-panel[data-state="open"]').waitFor({state:'hidden'}) }
async function applyQuality(page,index=0) { await openPicker(page); await page.locator('[data-saved-quality-card]').nth(index).getByRole('button').first().click() }
async function saveCosting(page) { await openCost(page); await page.getByTestId('save-costing-action').click() }
async function saved(page,version=1) { await page.getByRole('heading',{name:new RegExp(`Saved to factory.*v${version}`)}).waitFor() }
async function assertToastPaintOrder(page) {
    for(const type of ['success','warning','error']) {
        await page.evaluate(type=>window.__fixtureToast(type,'Synthetic consequential notice with a long fabric recipe name that wraps at enlarged text.'),type)
        const notice=page.locator(`[data-sonner-toast][data-type="${type}"]`).first();await notice.waitFor()
        await waitFor(async()=>await page.locator('[data-sonner-toast]').count()===1,'Previous notice exit did not finish')
        await page.evaluate(type=>{
            // The dialog is already200%; scale only this newly created toast.
            const toast=document.querySelector(`[data-sonner-toast][data-type="${type}"]`)
            window.__syntheticTextSizes=[toast,...toast.querySelectorAll('*')].filter(node=>node instanceof HTMLElement).map(node=>{const style=getComputedStyle(node);return{node,fontSize:parseFloat(style.fontSize),lineHeight:parseFloat(style.lineHeight)}})
        },type);await resizeText(page,200)
        const order=await page.evaluate(type=>{
            const toast=document.querySelector(`[data-sonner-toast][data-type="${type}"]`),dialog=document.querySelector('[data-slot="dialog-content"][data-state="open"]')
            const a=toast.getBoundingClientRect(),b=dialog.getBoundingClientRect()
            const left=Math.max(a.left,b.left),right=Math.min(a.right,b.right),top=Math.max(a.top,b.top),bottom=Math.min(a.bottom,b.bottom)
            if(right<=left||bottom<=top)return 'no-intersection'
            const stack=toast.closest('[data-sonner-toaster]'),pointer=getComputedStyle(toast).pointerEvents,original=stack.style.getPropertyValue('pointer-events'),priority=stack.style.getPropertyPriority('pointer-events')
            stack.style.setProperty('pointer-events','auto','important')
            const topElement=document.elementsFromPoint((left+right)/2,(top+bottom)/2)[0]
            if(original)stack.style.setProperty('pointer-events',original,priority);else stack.style.removeProperty('pointer-events')
            return {paint:topElement.closest('[data-slot="dialog-content"]')?'dialog':topElement.closest('[data-sonner-toast]')?'toast':'other',toasterZ:getComputedStyle(stack).zIndex,originalPointer:pointer,point:{x:(left+right)/2,y:(top+bottom)/2}}
        },type)
        await screenshot(page,`notice-${type}-dialog-paint-order-320`)
        await writeFile(`${output}/notice-${type}-paint-order.json`,JSON.stringify(order,null,2))
        assert.equal(order.paint,type==='success'?'dialog':'toast',`${type} notice paint order`)
    }
    await page.evaluate(()=>window.__fixtureToast('success','Synthetic notice cleared'))
}

await fixture('baseline-and-regression-captures', async page => {
    await enter(page)
    for (const [width, height] of [[320, 568], [390, 844], [430, 932], [1440, 900]]) {
        await page.setViewportSize({ width, height }); await page.evaluate(() => scrollTo(0, 0))
        await page.screenshot({ animations: 'disabled', path: `${output}/lite-estimator-${width}x${height}-synthetic.png`, fullPage: false })
        measurements.push({ width, height, state: 'initial', firstInput: await page.locator('input[data-estimator-field="qualityLabel"]').boundingBox() })
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Lite initial reflow${width}`)
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByTestId('saved-quality-quick-picker').click()
    await page.locator('#saved-qualities-sheet-panel[data-state="open"]').waitFor({ state: 'visible' })
    await page.screenshot({ animations: 'disabled', path: `${output}/lite-quality-picker-390x844-synthetic.png`, fullPage: false })
    await page.locator('#saved-qualities-sheet-panel').getByRole('button', { name: 'Close', exact: true }).click()
    await fillInputs(page)
    await waitFor(async () => await page.evaluate(() => localStorage.getItem('weavly-estimator-draft-synthetic-org-synthetic-owner')?.includes('Synthetic Lite costing')), 'Paid draft did not persist before working captures')
    for (const [width, height] of [[390, 844], [1440, 900]]) {
        await page.setViewportSize({ width, height }); await page.evaluate(() => scrollTo(0, 0))
        await page.screenshot({ animations: 'disabled', path: `${output}/lite-working-${width}x${height}-synthetic.png`, fullPage: false })
    }
    for (const tier of ['base', 'free']) {
        await page.goto(`${base}/${tier === 'free' ? 'free' : 'owner/estimator?tier=base&org=synthetic-base-regression'}`)
        await page.locator('input[data-estimator-field="qualityLabel"]').waitFor()
        for (const [width, height] of [[320, 568], [390, 844], [430, 932], [1440, 900]]) {
            await page.setViewportSize({ width, height }); await page.evaluate(() => scrollTo(0, 0))
            await page.screenshot({ animations: 'disabled', path: `${output}/${tier}-estimator-${width}x${height}-synthetic.png`, fullPage: false })
        }
    }
    await writeFile(`${output}/initial-input-measurements.json`, JSON.stringify(measurements, null, 2))
})
await fixture('lite-layout-help-focus', async page => {
    await enter(page)
    await page.locator('[data-lite-costing]').waitFor()
    assert.equal(await page.locator('#lite-estimator-help').isVisible(),false)
    for (const width of [320,390,430]) {
        await page.setViewportSize({width,height:width===320?568:844})
        const input=await page.locator('input[data-estimator-field="qualityLabel"]').boundingBox()
        assert(input.y<500,`Inputs remain behind introduction at${width}: ${input.y}`)
        assert.equal(await page.locator('[data-estimator-field="templateIdentity"]:visible').count(),0)
    }
    await page.locator('#lite-estimator-help-trigger').click()
    await page.locator('#lite-estimator-help').waitFor()
    await screenshot(page,'help-open-430')
    await page.locator('#lite-estimator-help-close').click()
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'lite-estimator-help-trigger')
    await openPicker(page); await closePicker(page)
    await waitFor(async()=>await page.getByTestId('saved-quality-quick-picker').evaluate(node=>node===document.activeElement),'Quality Close must return focus to its launcher')
})
await fixture('live-paid-cost-and-duplicate-save', async page => {
    await enter(page); await fillInputs(page); await openCost(page)
    const value=page.locator('[data-estimator-field="liveCostMetrics"] > div').first().locator('p').last()
    const initial=await value.textContent()
    await page.locator('#mobile-live-estimate-panel').getByRole('button',{name:'Close',exact:true}).click()
    await field(page,'yarnRate').fill('180')
    await openCost(page)
    assert.notEqual(await value.textContent(),initial,'Paid totals must update live without Calculate')
    await page.getByTestId('save-costing-action').evaluate(button=>{button.click();button.click();button.click()})
    await saved(page)
    assert.equal((await actions(page,'saveEstimatorQuoteV3')).length,1,'Repeated taps must submit once')
    assert.equal((await requests(page)).filter(item=>item.path==='/api/free/calculate').length,0,'Paid must not consume Free quota')
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey),null,'Confirmed save clears paid draft')
    await screenshot(page,'saved-version-1')
})
await fixture('paid-draft-recovery-and-scope', async page => {
    await enter(page); await fillInputs(page)
    await waitFor(async()=>await page.evaluate(key=>localStorage.getItem(key)?.includes('Synthetic Lite costing'),draftKey),'Draft autosave did not run')
    const draft=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),draftKey)
    assert.equal(draft.qualityLabel,'Synthetic Lite costing'); assert.equal(draft.state.warpRows[0].beamEnds,3200)
    assert(draft.schemaVersion&&draft.estimatorVersion&&draft.savedAt&&draft.writerId)
    await page.reload(); await page.getByRole('button',{name:'Restore draft'}).waitFor()
    await screenshot(page,'paid-draft-recovery')
    await page.getByRole('button',{name:'Restore draft'}).click(); await openRows(page)
    assert.equal(await field(page,'beamEnds').inputValue(),'3200')
    await enter(page,'org=synthetic-other-org'); assert.equal(await page.getByRole('button',{name:'Restore draft'}).count(),0)
    await enter(page,'user=synthetic-other-user'); assert.equal(await page.getByRole('button',{name:'Restore draft'}).count(),0)
    await enter(page); await page.getByRole('button',{name:'Discard draft'}).click()
    await screenshot(page,'discard-draft-confirmation')
    await page.getByRole('dialog').getByRole('button',{name:'Keep for later',exact:true}).click()
    assert(await page.evaluate(key=>Boolean(localStorage.getItem(key)),draftKey),'Cancel must retain draft')
})
await fixture('fast-navigation-back-forward-draft', async page => {
    await enter(page); await fillInputs(page)
    await field(page,'beamEnds').fill('3400')
    await page.locator('a[href="/owner/quotes"]:visible').first().click()
    await page.locator('[data-synthetic-destination]').waitFor()
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).state.warpRows[0].beamEnds,draftKey),3400,'Unmount flushes paid draft before debounce')
    await page.goBack(); await page.getByRole('button',{name:'Restore draft'}).waitFor(); await page.getByRole('button',{name:'Restore draft'}).click(); await openRows(page)
    assert.equal(await field(page,'beamEnds').inputValue(),'3400')
    await page.goForward(); await page.locator('[data-synthetic-destination]').waitFor()
    await page.goBack(); await page.getByRole('heading',{name:'Cost estimate',exact:true}).waitFor()
})
await fixture('quality-search-dirty-cancel-switch-undo', async page => {
    await enter(page); await fillInputs(page)
    await openPicker(page)
    const search=page.locator('input[aria-label="Search saved qualities"]')
    await search.fill('twill'); assert.equal(await page.locator('[data-saved-quality-card]').count(),1)
    await search.fill('missing synthetic quality'); assert.equal(await page.locator('[data-saved-quality-card]').count(),0)
    await search.fill(''); await page.locator('[data-saved-quality-card]').first().getByRole('button').first().click()
    await page.getByRole('dialog',{name:'Switch quality with unfinished changes?'}).waitFor()
    await screenshot(page,'dirty-quality-switch-confirmation')
    await page.getByRole('button',{name:'Keep working',exact:true}).click()
    assert.equal(await field(page,'beamEnds').inputValue(),'3200')
    await page.locator('[data-saved-quality-card]').first().getByRole('button').first().click()
    await page.getByRole('button',{name:'Switch quality',exact:true}).click()
    await page.locator('#saved-qualities-sheet-panel[data-state="open"]').waitFor({state:'hidden'})
    assert.match(await page.locator('input[data-estimator-field="qualityLabel"]').inputValue(),/Synthetic Quality A/)
    await screenshot(page,'loaded-quality-identity')
    await page.getByRole('button',{name:'Undo quality change',exact:true}).click(); await openRows(page)
    assert.equal(await page.locator('input[data-estimator-field="qualityLabel"]').inputValue(),'Synthetic Lite costing')
    assert.equal(await field(page,'beamEnds').inputValue(),'3200')
})
await fixture('quality-version-save-and-new-reset', async page => {
    await enter(page); await applyQuality(page); await openRows(page)
    await page.getByTestId('mobile-live-estimate-shortcut').getByText('Not saved to factory',{exact:true}).waitFor()
    await field(page,'yarnRate').fill('170')
    await saveCosting(page)
    const review=page.getByRole('dialog',{name:'Save New Costing Version',exact:true})
    await review.waitFor(); await screenshot(page,'quality-version-choice')
    await review.getByRole('button',{name:'Cancel',exact:true}).click()
    assert.equal((await actions(page,'saveEstimatorQuoteV3')).length,0)
    await saveCosting(page); await review.getByRole('button',{name:'Save this version only',exact:true}).click()
    await saved(page)
    assert.equal((await actions(page,'saveEstimatorQuoteV3'))[0].body.args[0].updateSavedQuality,false)
    await openPicker(page); await page.locator('[data-lite-quality-sheet]').getByRole('button',{name:'New quality',exact:true}).click()
    await page.getByRole('dialog',{name:'Start new quality / Reset?'}).waitFor()
    await page.getByRole('button',{name:'Cancel',exact:true}).click()
    assert.match(await page.locator('input[data-estimator-field="qualityLabel"]').inputValue(),/Synthetic Quality A/)
    await openPicker(page); await page.locator('[data-lite-quality-sheet]').getByRole('button',{name:'New quality',exact:true}).click()
    await page.getByRole('button',{name:'Reset & Start',exact:true}).click()
    assert.equal(await page.locator('input[data-estimator-field="qualityLabel"]').inputValue(),'')
    await openPicker(page); assert.equal(await page.locator('[data-saved-quality-card]').count(),2)
})
await fixture('warnings-invalid-and-confirmation', async page => {
    await enter(page); await fillInputs(page)
    await field(page,'calcDenier').fill('0'); await openCost(page)
    assert.equal(await page.getByTestId('save-costing-action').isDisabled(),true)
    assert.equal((await actions(page,'saveEstimatorQuoteV3')).length,0)
    await page.locator('#mobile-live-estimate-panel').getByRole('button',{name:'Close',exact:true}).click()
    await field(page,'calcDenier').fill('75'); await field(page,'effectiveCostingWidthCm').fill('10')
    await openCost(page); await page.getByRole('button',{name:'Review highlighted inputs',exact:false}).click()
    await page.getByRole('button',{name:'Review',exact:true}).click()
    const warning=page.getByRole('dialog',{name:'Review unusual values'})
    await warning.waitFor(); await screenshot(page,'warning-before-confirmation')
    await warning.getByRole('button',{name:'Go back',exact:true}).click()
    assert.equal((await actions(page,'saveEstimatorQuoteV3')).length,0)
    await page.getByRole('button',{name:'Review',exact:true}).click(); await warning.getByRole('button',{name:'I reviewed these values',exact:true}).click(); await saveCosting(page)
    await saved(page)
    assert.equal((await actions(page,'saveEstimatorQuoteV3')).length,1)
})
await fixture('definite-failure-retains-working-inputs', async page => {
    await enter(page,'scenario=rejected'); await fillInputs(page); await saveCosting(page)
    await waitFor(async()=> (await actions(page,'saveEstimatorQuoteV3')).length===1,'Save not submitted')
    await page.getByText('Synthetic definite rejection',{exact:true}).waitFor()
    assert.equal(await field(page,'beamEnds').isEnabled(),true)
    assert.equal(await field(page,'beamEnds').inputValue(),'3200')
    assert(await page.evaluate(key=>Boolean(localStorage.getItem(key)),draftKey))
    await screenshot(page,'definite-save-rejection')
})
await fixture('unknown-save-exact-retry-after-reload', async page => {
    await enter(page,'scenario=unknown-retry'); await fillInputs(page); await saveCosting(page)
    await page.getByRole('heading',{name:'Save not yet confirmed'}).waitFor()
    const submitted=(await actions(page,'saveEstimatorQuoteV3'))[0].body.args[0]
    assert.equal(await field(page,'beamEnds').isEnabled(),false)
    const draft=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),draftKey)
    assert.deepEqual(draft.pendingSaveRequest,submitted); assert.equal(draft.clientRequestId,submitted.clientRequestId)
    await screenshot(page,'unknown-save-frozen')
    await page.reload(); await page.getByRole('button',{name:'Restore draft'}).waitFor(); await page.getByRole('button',{name:'Restore draft'}).click()
    await page.getByRole('heading',{name:'Save not yet confirmed'}).waitFor()
    await page.getByRole('button',{name:'Retry original save',exact:true}).click(); await saved(page)
    const attempts=await actions(page,'saveEstimatorQuoteV3')
    assert.equal(attempts.length,2); assert.deepEqual(attempts[1].body,attempts[0].body,'Retry must preserve original UUID and payload')
    await screenshot(page,'unknown-retry-confirmed')
})
await fixture('lost-save-response-receipt-reconciliation', async page => {
    await enter(page,'scenario=unknown-reconciled'); await fillInputs(page); await saveCosting(page); await saved(page)
    assert.equal((await actions(page,'saveEstimatorQuoteV3')).length,1)
    assert.equal((await actions(page,'getCostingSaveReceipt')).length,1)
})
await fixture('saved-export-source-and-unsaved-values', async page => {
    await enter(page); await fillInputs(page); await saveCosting(page); await saved(page)
    await page.getByRole('button',{name:'Create customer quotation',exact:true}).click()
    const source=page.locator('[data-document-source]')
    await source.waitFor(); assert.match(await source.textContent(),/Synthetic Lite costing.*v1/)
    await screenshot(page,'saved-export-source-v1')
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).first().click()
    assert.equal(await field(page,'yarnRate').inputValue(),'120','Closing saved export retains inputs'); await field(page,'yarnRate').fill('180')
})
await fixture('quality-rate-unknown-reconciliation', async page => {
    await enter(page,'scenario=rate-unknown-applied'); await openPicker(page)
    await page.locator('[data-saved-quality-card]').first().getByRole('button').nth(1).click()
    const proposal=page.getByRole('spinbutton',{name:'Proposed warp rate 1 (₹/kg)',exact:true})
    await proposal.waitFor(); await proposal.fill('177')
    const save=page.getByRole('button',{name:'Save Rates & Apply',exact:true})
    await save.evaluate(button=>{button.click();button.click()})
    await page.locator('[data-lite-rate-unknown]').waitFor()
    assert.equal(await save.isDisabled(),true); await proposal.fill('188')
    await screenshot(page,'quality-rate-unknown')
    await page.getByRole('button',{name:'Check saved rates',exact:true}).click()
    await waitFor(async()=>await page.locator('[data-lite-rate-unknown]').count()===0,'Rate reconciliation did not clear unknown')
    await openRows(page); assert.equal(await field(page,'yarnRate').inputValue(),'177')
    assert.equal((await actions(page,'updateTemplateRates')).length,1,'Reconciliation must not blindly resubmit rates')
})
await fixture('keyboard-and-measured-action-clearance', async page => {
    await page.addInitScript(()=>{
        const viewport=new EventTarget(); Object.assign(viewport,{height:844,width:390,offsetTop:0,scale:1})
        Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true})
        window.__syntheticViewport=viewport
    })
    await enter(page); await fillInputs(page)
    const input=field(page,'overheadOverridePerM'); await input.focus()
    await page.evaluate(()=>{window.__syntheticViewport.height=500;window.__syntheticViewport.dispatchEvent(new Event('resize'))})
    await waitFor(async()=>await page.locator('html[data-mobile-keyboard]').count()===1,'Emulated keyboard state not detected')
    assert.equal(await page.getByTestId('mobile-live-estimate-shortcut').isVisible(),false,'Dock yields to keyboard accessory')
    await page.locator('[data-mobile-input-accessory]').waitFor()
    await waitFor(async()=>{const rect=await input.boundingBox();return rect.y>=70&&rect.y+rect.height<=422},'Focused input must clear emulated keyboard accessory')
    assert.equal(await page.locator('[data-mobile-navigation]').isVisible(),false,'Bottom navigation yields while typing')
    await screenshot(page,'simulated-keyboard-open')
    await input.blur(); await page.evaluate(()=>{window.__syntheticViewport.height=844;window.__syntheticViewport.dispatchEvent(new Event('resize'))})
    await waitFor(async()=>await page.locator('html[data-mobile-keyboard]').count()===0,'Keyboard state did not clear')
    assert.equal(await page.getByTestId('mobile-live-estimate-shortcut').isVisible(),true)
    const dock=await page.locator('[data-lite-mobile-action]').boundingBox()
    const reserve=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lite-mobile-action-height')))
    assert(Math.abs(dock.height-reserve)<3,`Measured action reserve${reserve} does not match${dock.height}`)
    await screenshot(page,'simulated-keyboard-closed')
},{hasTouch:true})
await fixture('strong-text-reflow-modes-and-help', async page => {
    const bounds=[]
    for(const language of ['en','hi','gu']) {
        await enter(page,`language=${language}&org=text-${language}`); await page.setViewportSize({width:320,height:568})
        await fillInputs(page); await rememberTextSizes(page)
        for(const percent of [150,200]) { await resizeText(page,percent); bounds.push({language,percent,state:'quick',issues:await renderedBounds(page)}); await screenshot(page,`${language}-text${percent}-quick-320`,true) }
        await page.locator('#lite-estimator-help-trigger').click()
        bounds.push({language,percent:200,state:'help',issues:await renderedBounds(page)})
        await screenshot(page,`${language}-text200-help-320`,true)
        await page.locator('#lite-estimator-help-close').click()
    }
    await writeFile(`${output}/text-bounds.json`,JSON.stringify(bounds,null,2))
    assert.equal(bounds.filter(check=>check.issues.length).length,0,'Rendered text/input clipping: see text-bounds.json')
})

await fixture('detailed-modes-manual-zero-and-units', async page => {
    await enter(page); await fillInputs(page)
    await page.getByRole('tab',{name:'Detailed',exact:true}).click()
    assert.equal(await page.locator('input[data-estimator-field="qualityLabel"]').inputValue(),'Synthetic Lite costing')
    await openRows(page)
    for(const [row,value] of [['warpRows.0','3.25'],['weftRows.0','2.75']]) {
        await page.locator(`[data-estimator-row="${row}"] [data-estimator-field="calculationMode"] [role="radio"]`).nth(1).click()
        await page.locator(`[data-estimator-row="${row}"] [data-estimator-field="manualKgPer100m"] input`).fill(value)
    }
    await field(page,'transportPerM').fill('0'); await field(page,'commissionPct').fill('0')
    await page.getByRole('tab',{name:'Quick',exact:true}).click(); await openRows(page)
    assert.equal(await field(page,'manualKgPer100m',0).inputValue(),'3.25')
    await page.locator('[data-estimator-field="weavingRateMode"] [role="radio"]').nth(1).click()
    assert.equal(await page.locator('input[data-estimator-field="perPickCostPaisa"]').inputValue(),'11.76')
    await page.locator('[data-estimator-field="weavingRateMode"] [role="radio"]').first().click()
    assert.match(await page.locator('input[data-estimator-field="perPickCostPaisa"]').getAttribute('placeholder'),/8\.00/)
    await saveCosting(page); await saved(page)
    const estimate=(await actions(page,'saveEstimatorQuoteV3'))[0].body.args[0].estimate
    assert.equal(estimate.warpRows[0].calculationMode,'manual'); assert.equal(estimate.weftRows[0].calculationMode,'manual')
    assert.equal(estimate.transportPerM,0); assert.equal(estimate.commissionPct,0)
})
await fixture('offline-paid-draft-without-server-save', async (page,context) => {
    await enter(page); await fillInputs(page)
    await context.setOffline(true)
    await saveCosting(page)
    await page.getByText('Reconnect before saving',{exact:true}).waitFor()
    assert.equal((await actions(page,'saveEstimatorQuoteV3')).length,0)
    assert(await page.evaluate(key=>Boolean(localStorage.getItem(key)),draftKey))
    await screenshot(page,'offline-local-draft-only')
    await context.setOffline(false); await saveCosting(page); await saved(page)
})
await fixture('cross-tab-draft-conflict-preserves-current-work', async (page,context) => {
    await enter(page); await fillInputs(page)
    await waitFor(async()=>await page.evaluate(key=>Boolean(localStorage.getItem(key)),draftKey),'First tab draft not saved')
    const other=await context.newPage(); await enter(other)
    await other.getByRole('button',{name:'Restore draft'}).click(); await openRows(other); await field(other,'beamEnds').fill('3500')
    await page.getByText('A newer draft was written in another tab. Your current tab has not been replaced.',{exact:true}).waitFor()
    assert.equal(await field(page,'beamEnds').inputValue(),'3200')
    assert.equal(await field(other,'beamEnds').inputValue(),'3500')
    await screenshot(page,'cross-tab-draft-conflict')
    await other.close()
})
await fixture('expired-draft-and-unavailable-storage', async (page,context) => {
    await enter(page); await fillInputs(page)
    await waitFor(async()=>await page.evaluate(key=>Boolean(localStorage.getItem(key)),draftKey),'Draft not saved')
    await page.addInitScript(key=>{const value=JSON.parse(localStorage.getItem(key));if(value){value.savedAt=Date.now()-8*86400000;value.createdAt=value.savedAt;localStorage.setItem(key,JSON.stringify(value))}},draftKey)
    await page.reload(); assert.equal(await page.getByRole('button',{name:'Restore draft'}).count(),0)
    const denied=await context.newPage()
    await denied.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key.startsWith('weavly-estimator-draft'))throw new DOMException('Synthetic storage denied','SecurityError');return get.call(this,key)};Storage.prototype.setItem=function(key,value){if(key.startsWith('weavly-estimator-draft'))throw new DOMException('Synthetic storage denied','SecurityError');return set.call(this,key,value)}})
    await enter(denied,'org=storage-denied')
    await denied.getByText(/Draft recovery is unavailable on this device/).waitFor()
    await fillInputs(denied); assert.equal(await field(denied,'beamEnds').inputValue(),'3200')
    await screenshot(denied,'draft-storage-unavailable'); await denied.close()
})
await fixture('quality-loading-empty-failed-retry', async page => {
    await enter(page,'qualities-loading=1&scenario=qualities-loading'); await openPicker(page)
    await page.getByText('Loading saved qualities…',{exact:true}).first().waitFor()
    await screenshot(page,'qualities-loading')
    await waitFor(async()=>await page.locator('[data-saved-quality-card]').count()===2,'Quality loading did not resolve')
    await enter(page,'scenario=qualities-empty'); await openPicker(page)
    assert.equal(await page.locator('[data-saved-quality-card]').count(),0)
    await screenshot(page,'qualities-empty')
    await page.request.get(`${base}/__fixture__/reset`); await enter(page,'qualities-loading=1&scenario=qualities-failed'); await openPicker(page)
    await page.getByText('Saved quality details are temporarily unavailable. The Cost Estimate remains ready to use.',{exact:true}).waitFor()
    await screenshot(page,'qualities-failed')
    await page.reload(); await openPicker(page)
    await waitFor(async()=>await page.locator('[data-saved-quality-card]').count()===2,'Reload retry did not load saved qualities')
})
await fixture('base-live-and-free-metering-regression', async page => {
    await enter(page,'tier=base'); await fillInputs(page); await openCost(page)
    const value=page.locator('[data-estimator-field="liveCostMetrics"] > div').first().locator('p').last()
    const original=await value.textContent()
    await page.locator('#mobile-live-estimate-panel').getByRole('button',{name:'Close',exact:true}).click()
    await field(page,'yarnRate').fill('200'); await openCost(page)
    assert.notEqual(await value.textContent(),original); assert.equal((await requests(page)).filter(request=>request.path==='/api/free/calculate').length,0)
    await page.goto(`${base}/free?org=free-regression&user=free-user`); await fillInputs(page)
    assert.equal(await page.getByTestId('saved-quality-quick-picker').isVisible(),false)
    assert.equal((await requests(page)).filter(request=>request.path==='/api/free/calculate').length,0)
    await openCost(page); await page.getByTestId('save-costing-action').click()
    await waitFor(async()=> (await requests(page)).filter(request=>request.path==='/api/free/calculate').length===1,'Free must calculate only on metered action')
    assert.equal(await page.evaluate(key=>Boolean(localStorage.getItem(key)),'weavly-estimator-draft-free-regression-free-user'),false,'Free must not write paid draft')
})
await fixture('strong-text-additional-panels-and-touch', async page => {
    const bounds=[],touch=[]
    const check=async(language,state)=>{
        await rememberTextSizes(page); await resizeText(page,200)
        bounds.push({language,percent:200,state,issues:await renderedBounds(page)})
        touch.push({language,state,small:await touchBounds(page)})
        await screenshot(page,`${language}-text200-${state}-320`,true)
    }
    for(const language of ['en','hi','gu']) {
        await page.setViewportSize({width:320,height:568})
        await enter(page,`language=${language}&org=extra-${language}-manual`); await fillInputs(page)
        await page.locator('[data-estimator-field="entryMode"] [role="tab"]').nth(1).click(); await openRows(page)
        for(const [row,value]of[['warpRows.0','3.25'],['weftRows.0','2.75']]){await page.locator(`[data-estimator-row="${row}"] [data-estimator-field="calculationMode"] [role="radio"]`).nth(1).click();await page.locator(`[data-estimator-row="${row}"] [data-estimator-field="manualKgPer100m"] input`).fill(value)}
        await page.locator('[data-estimator-field="weavingRateMode"] [role="radio"]').nth(1).click(); await check(language,'detailed-manual-paise')
        const last=field(page,'orderQuantityM'); await last.focus(); await last.scrollIntoViewIfNeeded(); assert(await last.evaluate(node=>node===document.activeElement))
        const lastBounds=await last.boundingBox(),dock=await page.locator('[data-lite-mobile-action]').boundingBox(),nav=await page.locator('[data-mobile-navigation]').boundingBox()
        assert(lastBounds.y>=0&&lastBounds.y+lastBounds.height<=Math.min(568,dock?.y??568,nav?.y??568)+2,`${language} enlarged last field must remain above dock/navigation`)
        await enter(page,`language=${language}&org=extra-${language}-result`); await fillInputs(page); await openCost(page); await check(language,'result')
        await enter(page,`language=${language}&org=extra-${language}-picker`); await openPicker(page)
        await page.locator('#saved-qualities-sheet-panel input').fill('Synthetic'); await check(language,'quality-picker')
        await enter(page,`language=${language}&org=extra-${language}-rates`); await openPicker(page); await page.locator('[data-saved-quality-card]').first().getByRole('button').nth(1).click()
        await page.locator('[role="dialog"] input[type="number"]').first().fill('177'); await check(language,'quality-rates')
    }
    await writeFile(`${output}/additional-text-bounds.json`,JSON.stringify(bounds,null,2)); await writeFile(`${output}/touch-regions.json`,JSON.stringify(touch,null,2))
    assert.equal(bounds.filter(check=>check.issues.length).length,0,'Detailed/result/picker/rate clipping: see additional-text-bounds.json')
    assert.equal(touch.filter(check=>check.small.length).length,0,'Controls below44px: see touch-regions.json')
})


await fixture('strong-text-paid-dialogs', async page => {
    const bounds=[],touch=[]
    const check=async(language,state)=>{
        await page.locator('[data-slot="dialog-content"][data-state="open"]').last().waitFor()
        await waitFor(async()=>await page.locator('[data-slot="sheet-content"][data-state="closed"],[data-slot="dialog-content"][data-state="closed"]').count()===0,'Previous modal exit did not finish')
        await rememberTextSizes(page); await resizeText(page,200)
        bounds.push({language,percent:200,state,issues:await renderedBounds(page)})
        touch.push({language,state,small:await touchBounds(page)})
        await screenshot(page,`${language}-text200-dialog-${state}-320`,true)
        // Fixed portals are not reliably represented by full-document capture.
        // Keep the actual viewport beside the full-page layout evidence.
        await screenshot(page,`${language}-text200-dialog-${state}-320-viewport`)
        await writeFile(`${output}/dialog-text-bounds.json`,JSON.stringify(bounds,null,2));await writeFile(`${output}/dialog-touch-regions.json`,JSON.stringify(touch,null,2))
    }
    for(const language of ['en','hi','gu']) {
        await page.setViewportSize({width:320,height:568})
        await enter(page,`language=${language}&org=dialog-${language}-version`); await applyQuality(page); await openRows(page); await field(page,'yarnRate').fill('177'); await saveCosting(page); await check(language,'version')
        if(language==='en')await assertToastPaintOrder(page)
        await enter(page,`language=${language}&org=dialog-${language}-save-quality`); await fillInputs(page); await openCost(page); await page.getByTestId('save-as-new-quality').click(); await page.locator('#save-quality-name').fill('Synthetic saved recipe'); await check(language,'save-quality')
        await enter(page,`language=${language}&org=dialog-${language}-new`); await fillInputs(page); await openPicker(page); await page.locator('[data-lite-quality-sheet] button.lite-mobile-only').click(); await check(language,'new-quality')
        await enter(page,`language=${language}&org=dialog-${language}-rename`); await openPicker(page); await page.locator('[data-saved-quality-card]').first().getByRole('button').last().click(); await page.getByRole('menuitem').first().click(); await page.locator('#rename-quality-name').fill('Synthetic recipe renamed'); await check(language,'rename-quality')
        await enter(page,`language=${language}&org=dialog-${language}-discard`); await fillInputs(page); await waitFor(async()=>await page.evaluate(key=>Boolean(localStorage.getItem(key)),`weavly-estimator-draft-dialog-${language}-discard-synthetic-owner`),'Discard scenario draft not saved'); await page.reload(); await page.locator('[data-lite-costing] div[role="region"] button').last().click()
        await check(language,'discard-draft')
    }
    assert.equal(bounds.filter(check=>check.issues.length).length,0,'Paid dialog clipping: see dialog-text-bounds.json')
    assert.equal(touch.filter(check=>check.small.length).length,0,'Paid dialog controls below44px: see dialog-touch-regions.json')
})


await fixture('immutable-version-source-and-no-change-save', async page => {
    await enter(page); await fillInputs(page); await saveCosting(page); await saved(page)
    const first=(await actions(page,'saveEstimatorQuoteV3'))[0].body.args[0]
    await saveCosting(page); await saved(page)
    const second=(await actions(page,'saveEstimatorQuoteV3'))[1].body.args[0]
    assert(second.sourceQuoteId); assert(second.expectedSourceUpdatedAt); assert.match(await page.locator('#active-quality').textContent(),/v1/)
    assert.deepEqual(second.estimate,first.estimate)
    await field(page,'yarnRate').fill('180'); await saveCosting(page); await saved(page,2)
    const third=(await actions(page,'saveEstimatorQuoteV3'))[2].body.args[0]
    assert.equal(third.sourceQuoteId,second.sourceQuoteId); assert.equal(third.expectedSourceUpdatedAt,second.expectedSourceUpdatedAt)
    assert.notDeepEqual(third.estimate,first.estimate)
    await screenshot(page,'saved-new-version-v2')
})

await browser.close()
const report = { evidenceType: 'Automated Chromium emulation; actual Lite estimator/navigation/paid autosave over synthetic localhost actions. No installed PWA or remote data/provider verification.', base, stage, applicationSourceCommit: sourceCommit, createdAt: new Date().toISOString(), externalRequestsBlocked: [...new Set(external)], results }
await writeFile(`${output}/${only ? 'partial-verification' : 'verification'}.json`, JSON.stringify(report, null, 2))
console.info(JSON.stringify({ passed: results.filter(result => result.status === 'passed').length, failed: results.filter(result => result.status === 'failed').length }))
if (results.some(result => result.status === 'failed')) process.exitCode = 1
