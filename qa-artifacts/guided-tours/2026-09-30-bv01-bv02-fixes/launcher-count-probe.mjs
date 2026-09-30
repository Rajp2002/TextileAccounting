// GT-17 "one guide per page": opens each scenario in the isolated fixture and counts visible guide launchers
// (the invitation card's Start guide button or the compact replay launcher). Read-only; same guard as the matrix.
//
//   node ... --import <network-guard> launcher-count-probe.mjs <out.json> <scenario> [<scenario> ...]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(process.env.PLAYWRIGHT_ROOT);
const { chromium } = require('playwright');
const [out, ...scenarios] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
for (const scenario of scenarios) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const [name, query = ''] = scenario.split('?');
  await page.goto(`http://localhost:5199/?s=${encodeURIComponent(name)}${query ? '&' + query : ''}&lang=en&fresh=1`);
  await page.waitForFunction(() => window.__harnessReady || window.__harnessError, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    const launchers = [...document.querySelectorAll('[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]')].filter(visible);
    return { launchers: launchers.length, kinds: launchers.map(element => element.getAttribute('data-tour-control')), invitations: [...document.querySelectorAll('[data-tour-invitation]')].filter(visible).length };
  });
  results.push({ scenario, ...info, ok: info.launchers === 1 });
  await context.close();
}
await browser.close();
writeFileSync(out, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map(r => `${r.ok ? 'ONE ' : 'BAD '} ${r.scenario} launchers=${r.launchers} (${r.kinds.join(',')})`), null, 1));
if (results.some(r => !r.ok)) process.exitCode = 1;
