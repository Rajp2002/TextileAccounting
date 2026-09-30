// Read-only Back/Next transition probe for the two changed steps. It uses the same synthetic fixture, unchanged
// runner-independent selectors and the review's network guard. For every Next and every Back it records the
// panel, outline and the real target element at 0, 500 and 2000 ms after the step reports ready, plus a
// screenshot per frame, so animation-in-progress frames are kept separate from settled frames.
//
//   node ... --import <network-guard> transition-probe.mjs <scenario> <lang> <WxH> <dest-dir> <estimator|assignments>
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(process.env.PLAYWRIGHT_ROOT);
const { chromium } = require('playwright');
const [scenario, lang, size, dest, kind] = process.argv.slice(2);
const [width, height] = size.split('x').map(Number);
const compactPhone = process.env.COMPACT_TOUCH === '1' || width < 768;
const out = `${dest}/transition`;
mkdirSync(out, { recursive: true });

const KINDS = {
  estimator: { ids: ['est-purpose', 'est-warp', 'est-weft', 'est-weaving', 'est-warping', 'est-overhead', 'est-pricing', 'est-live', 'est-save', 'est-handoff'],
    focus: ['est-live', 'est-save'],
    target: { 'est-live': '[data-estimator-field="liveCostMetrics"]', 'est-save': '[data-estimator-field="liveCostActions"]' } },
  assignments: { ids: ['ma-purpose', 'ma-shift', 'ma-job', 'ma-assign', 'ma-choose', 'ma-linked', 'ma-handoff'],
    focus: ['ma-purpose', 'ma-shift'],
    target: { 'ma-purpose': '[data-tour-anchor="assignments.columns"]', 'ma-shift': '[data-configuration-tour="shift"]' } },
};
const spec = KINDS[kind];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const context = await browser.newContext({ viewport: { width, height }, isMobile: compactPhone, hasTouch: compactPhone, deviceScaleFactor: 1, reducedMotion: process.env.REDUCED_MOTION === '1' ? 'reduce' : 'no-preference' });
const page = await context.newPage();
const [name, query = ''] = scenario.split('?');
const record = { scenario, lang, size, kind, compactPhone, frames: [], issues: [], notes: [], purpose: 'Read-only Back/Next settle diagnosis for the BV-01/BV-02 steps' };

const frame = (id, via, delay) => page.evaluate(({ id, via, delay, selector }) => {
  const visible = e => e.isConnected && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'
  const box = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } };
  const inter = (a, b) => a && b ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0;
  const panel = document.querySelector('.guided-tour-panel'), highlight = document.querySelector('.guided-tour-highlight');
  const target = selector ? Array.from(document.querySelectorAll(selector)).find(visible) : null;
  const p = box(panel), h = box(highlight), t = box(target);
  const off = b => !b || b.x < 0 || b.y < 0 || b.x + b.w > innerWidth || b.y + b.h > innerHeight;
  return { id, via, delayMs: delay, step: panel?.getAttribute('data-tour-step'), status: panel?.getAttribute('data-tour-status'), panel: p, highlight: h, target: t,
    panelOutlineOverlap: inter(p, h), panelTargetOverlap: inter(p, t), panelOffscreen: off(p), highlightOffscreen: off(h),
    highlightTracksTarget: Boolean(h && t && Math.abs(h.x - t.x) <= 10 && Math.abs(h.y - t.y) <= 10),
    // The outline is the target expanded by 6px on every side and clipped to the safe band. A target taller than the
    // band (a full-height board card, or a 261px Save block on a 390px-high landscape phone) is clipped by design
    // (TC-4), so part of it necessarily lies under the docked panel; the outline is the measure that must be clear.
    // Only vertical clipping counts: a full-width target is also trimmed at the screen edges, which is unrelated to
    // the panel covering it, and must not exempt the target from the actual-target overlap check.
    targetClipped: Boolean(h && t && h.h < t.h + 12 - 3),
    focusInPanel: Boolean(panel?.contains(document.activeElement)), animations: document.querySelector('.guided-tour-portal')?.getAnimations({ subtree: true }).map(a => a.playState) };
}, { id, via, delay, selector: spec.target[id] ?? null });

const settle = async (id, via) => {
  await page.locator(`[data-tour-step="${id}"][data-tour-status="ready"]`).waitFor({ timeout: 15000 });
  let elapsed = 0;
  for (const delay of [0, 500, 2000]) {
    if (delay - elapsed > 0) await page.waitForTimeout(delay - elapsed);
    elapsed = delay;
    const state = await frame(id, via, delay);
    record.frames.push(state);
    await page.screenshot({ path: `${out}/${String(record.frames.length).padStart(2, '0')}-${id}-${via}-${delay}ms.png` });
  }
};
try {
  await page.goto(`http://localhost:5199/?s=${encodeURIComponent(name)}${query ? '&' + query : ''}&lang=${lang}&fresh=1`);
  await page.waitForFunction(() => window.__harnessReady || window.__harnessError, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.locator('[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]').filter({ visible: true }).first().click();
  // Forward through every step, then Back one step at a time to the start, then Next again to the end.
  for (const [i, id] of spec.ids.entries()) {
    await settle(id, i === 0 ? 'start' : 'next');
    if (i < spec.ids.length - 1) await page.locator('[data-tour-control="next"]').click();
  }
  for (let i = spec.ids.length - 2; i >= 0; i--) {
    await page.locator('[data-tour-control="back"]').click();
    await settle(spec.ids[i], 'back');
  }
  for (let i = 1; i < spec.ids.length; i++) {
    await page.locator('[data-tour-control="next"]').click();
    await settle(spec.ids[i], 'next-again');
  }
  // Focus steps: every settled frame (500 ms and later) must be ready, on screen, aligned and unobstructed.
  for (const f of record.frames.filter(f => spec.focus.includes(f.id))) {
    const tag = `${f.id}/${f.via}@${f.delayMs}ms`;
    if (f.status !== 'ready') record.issues.push(`${tag}: ${f.status}`);
    if (f.panelOffscreen || !f.focusInPanel) record.issues.push(`${tag}: panel bounds/focus`);
    if (f.delayMs >= 500) {
      if (f.panelOutlineOverlap) record.issues.push(`${tag}: panel/outline overlap ${f.panelOutlineOverlap}`);
      if (f.targetClipped) {
        record.notes.push(`${tag}: target taller than the safe band, outline clipped by design (outline ${f.highlight?.w}x${f.highlight?.h}, target ${f.target?.w}x${f.target?.h})`);
        if (!f.highlight || f.highlight.h < 40) record.issues.push(`${tag}: clipped outline too small to be discoverable`);
      } else if (f.panelTargetOverlap) record.issues.push(`${tag}: panel/actual-target overlap ${f.panelTargetOverlap}`);
      if (f.highlightOffscreen) record.issues.push(`${tag}: outline off screen`);
      if (!f.highlightTracksTarget) record.issues.push(`${tag}: outline does not track target`);
    }
  }
  // Every other step must also settle ready with no panel/outline overlap.
  for (const f of record.frames.filter(f => !spec.focus.includes(f.id) && f.delayMs === 2000)) {
    if (f.status !== 'ready' || f.panelOutlineOverlap || f.highlightOffscreen) record.issues.push(`${f.id}/${f.via}@2000ms: status ${f.status}, overlap ${f.panelOutlineOverlap}, outline offscreen ${f.highlightOffscreen}`);
  }
  await page.keyboard.press('Escape');
  await page.locator('.guided-tour-panel').waitFor({ state: 'detached' });
  record.after = await page.evaluate(() => ({ calls: (window.__serverCalls || []).map(c => c.fn), activeControl: document.activeElement?.getAttribute('data-tour-control'),
    sheetOpen: Boolean(document.querySelector('#mobile-live-estimate-panel')), inertBody: [...document.body.children].some(e => e.inert),
    prefs: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('weavly:tour'))) }));
  if (record.after.calls.some(fn => fn !== 'recordTourEventAction' && fn !== 'getEstimatorSecondaryData')) record.issues.push(`business handler called: ${record.after.calls.join(',')}`);
  if (record.after.inertBody) record.issues.push('page left inert after Exit');
  if (Object.values(record.after.prefs).some(v => v.includes('"completed":true'))) record.issues.push('Exit recorded completion');
} catch (error) { record.error = String(error); process.exitCode = 1; }
writeFileSync(`${out}/record.json`, JSON.stringify(record, null, 2));
console.log(JSON.stringify({ scenario, lang, size, frames: record.frames.length, issues: record.issues, error: record.error }));
if (record.issues.length) process.exitCode = 1;
await browser.close();
