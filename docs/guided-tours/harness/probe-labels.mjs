import { createRequire } from 'node:module'
import { writeFileSync, readFileSync } from 'node:fs'
const require = createRequire(process.env.PLAYWRIGHT_ROOT ?? '/opt/node22/lib/node_modules/')
const { chromium } = require('playwright')
const paths = Object.keys(JSON.parse(readFileSync('labels.json', 'utf8')))
const browser = await chromium.launch(process.env.CHROMIUM_PATH === '' ? {} : { executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const result = {}
for (const lang of ['gu', 'hi']) for (const path of paths) {
  const page = await (await browser.newContext()).newPage()
  await page.goto(`http://localhost:5199/?s=labels&lang=${lang}&path=${encodeURIComponent(path)}`)
  await page.waitForFunction(() => window.__labels, null, { timeout: 60000 })
  result[`${lang} ${path}`] = await page.evaluate(() => window.__labels)
  await page.close()
}
writeFileSync('labels-out.json', JSON.stringify(result, null, 1))
await browser.close()
console.log('ok', Object.keys(result).length)
