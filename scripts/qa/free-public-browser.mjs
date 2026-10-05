// Read-only local production-build smoke checks. Never send form/API mutations.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const base = new URL(process.argv[2] ?? 'http://127.0.0.1:4193')
assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Local build only')
const output = 'output/playwright/free-mobile-redesign/public-build'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 320, height: 740 } })
const blocked = []
await context.route('**/*', route => {
  const request = route.request()
  const url = new URL(request.url())
  if (url.origin === base.origin && request.method() === 'GET') return route.continue()
  blocked.push({ url: url.origin + url.pathname, method: request.method() })
  return route.abort()
})
const page = await context.newPage()
const results = []
try {
  for (const path of ['/install', '/offline', '/privacy', '/terms', '/refund-policy', '/privacy-request', '/security-incident']) {
    try {
      const response = await page.goto(new URL(path, base).href)
      assert(response?.ok(), `${path}: HTTP ${response?.status()}`)
      await page.locator('main').waitFor()
      await page.waitForFunction(() => document.fonts.status === 'loaded')
      for (const width of [320, 430, 1440]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 740 })
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path}: overflow at ${width}`)
      }
      await page.setViewportSize({ width: 320, height: 740 })
      await page.screenshot({ animations: 'disabled', path: `${output}/${path.slice(1)}-320.png` })
      await page.evaluate(() => {
        const text = [...document.querySelectorAll('main, main *')].map(node => {
          const style = getComputedStyle(node)
          return { node, font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) }
        })
        for (const { node, font, line } of text) {
          node.style.fontSize = `${font * 2}px`
          if (Number.isFinite(line)) node.style.lineHeight = `${line * 2}px`
        }
      })
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path}: overflow at 320 / 200% text`)
      await page.screenshot({ animations: 'disabled', path: `${output}/${path.slice(1)}-320-text200.png` })
      results.push({ path, status: 'passed', checks: 'HTTP, 320/430/1440 reflow, 320 computed text 200%' })
    } catch (error) {
      results.push({ path, status: 'failed', error: error.message })
    }
  }
} finally {
  await browser.close()
  await writeFile(`${output}/verification.json`, JSON.stringify({ evidence: 'Local Next production build; unauthenticated read-only Chromium emulation, no installed device/auth/provider verification', results, blocked }, null, 2) + '\n')
}
console.log(JSON.stringify(results))
if (results.some(result => result.status !== 'passed')) process.exitCode = 1
