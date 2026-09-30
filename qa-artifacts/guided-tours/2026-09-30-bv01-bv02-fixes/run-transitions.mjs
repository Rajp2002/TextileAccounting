// Runs transition-probe.mjs for the BV-01/BV-02 steps through the isolation wrapper and the review's network guard.
//   node scripts/performance/isolated-command.mjs env PLAYWRIGHT_ROOT=... CHROMIUM_PATH=... \
//     node qa-artifacts/guided-tours/2026-09-30-bv01-bv02-fixes/run-transitions.mjs <label> [id-regex]
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const bundle = import.meta.dirname;
const root = path.resolve(bundle, '../../..');
const review = path.join(root, 'qa-artifacts/guided-tours/2026-09-30-independent-review');
const wrapper = path.join(root, 'scripts/performance/isolated-command.mjs');
const [label, filter] = process.argv.slice(2);
if (!label) { console.error('Usage: run-transitions.mjs <label> [id-regex]'); process.exit(2); }
if (!process.env.PLAYWRIGHT_ROOT || process.env.CHROMIUM_PATH === undefined) throw new Error('Supply PLAYWRIGHT_ROOT and CHROMIUM_PATH after the isolation wrapper.');

const pop = 'assignments?populated=1';
const jobs = [
  ...[['base', 'estimator'], ['lite', 'estimator?tier=lite'], ['free', 'free-estimator']].flatMap(([plan, scenario]) => [
    { id: `tr05-${plan}-gu-390x844`, scenario, language: 'gu', size: '390x844', kind: 'estimator' },
    { id: `tr05-${plan}-en-390x844`, scenario, language: 'en', size: '390x844', kind: 'estimator' },
  ]),
  { id: 'tr05-base-gu-360x640', scenario: 'estimator', language: 'gu', size: '360x640', kind: 'estimator' },
  { id: 'tr05-base-gu-390x844-reduced', scenario: 'estimator', language: 'gu', size: '390x844', kind: 'estimator', env: { REDUCED_MOTION: '1' } },
  { id: 'tr05-base-en-1024x768', scenario: 'estimator', language: 'en', size: '1024x768', kind: 'estimator' },
  { id: 'tr05-base-en-1440x900', scenario: 'estimator', language: 'en', size: '1440x900', kind: 'estimator' },
  // Landscape phone: compact layout is chosen by (max-height: 500px) and (pointer: coarse), not by width.
  { id: 'tr05-base-en-844x390-landscape-touch', scenario: 'estimator', language: 'en', size: '844x390', kind: 'estimator', env: { COMPACT_TOUCH: '1' } },
  // Tablet portrait and large-tablet widths (round 2: GT-05 at 768x1024).
  ...['768x1024', '820x1180', '1024x1366'].flatMap(size => [['base', 'estimator'], ['free', 'free-estimator']].flatMap(([plan, scenario]) => [
    { id: `tr05-${plan}-en-${size}`, scenario, language: 'en', size, kind: 'estimator' },
    { id: `tr05-${plan}-gu-${size}`, scenario, language: 'gu', size, kind: 'estimator' },
  ])),
  { id: 'tr05-base-en-768x600', scenario: 'estimator', language: 'en', size: '768x600', kind: 'estimator' },
  { id: 'tr05-lite-hi-768x1024', scenario: 'estimator?tier=lite', language: 'hi', size: '768x1024', kind: 'estimator' },
  { id: 'tr15-pop-en-1024x768', scenario: pop, language: 'en', size: '1024x768', kind: 'assignments' },
  { id: 'tr15-pop-hi-1280x800', scenario: pop, language: 'hi', size: '1280x800', kind: 'assignments' },
  { id: 'tr15-pop-en-1440x900', scenario: pop, language: 'en', size: '1440x900', kind: 'assignments' },
  { id: 'tr15-pop-gu-390x844', scenario: pop, language: 'gu', size: '390x844', kind: 'assignments' },
  { id: 'tr15-pop-gu-1024x768', scenario: pop, language: 'gu', size: '1024x768', kind: 'assignments' },
  { id: 'tr15-pop-en-1024x768-reduced', scenario: pop, language: 'en', size: '1024x768', kind: 'assignments', env: { REDUCED_MOTION: '1' } },
  { id: 'tr15-empty-en-1024x768', scenario: 'assignments', language: 'en', size: '1024x768', kind: 'assignments' },
].filter(job => !filter || new RegExp(filter).test(job.id));

const runRoot = path.join(root, 'scratch/tour-fix-review-results', `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(runRoot, { recursive: true });
const results = [];
for (const job of jobs) {
  const dest = path.join(runRoot, job.id);
  mkdirSync(dest);
  const args = [wrapper, 'env', `PLAYWRIGHT_ROOT=${process.env.PLAYWRIGHT_ROOT}`, `CHROMIUM_PATH=${process.env.CHROMIUM_PATH}`, `NETWORK_LOG=${path.join(dest, 'network.json')}`,
    ...Object.entries(job.env || {}).map(([key, value]) => `${key}=${value}`),
    'node', '--import', path.join(review, 'network-guard.mjs'), path.join(bundle, 'transition-probe.mjs'), job.scenario, job.language, job.size, dest, job.kind];
  const result = spawnSync(process.execPath, args, { cwd: path.join(root, 'scratch/tour-fix-review'), timeout: 240000, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(path.join(dest, 'command.log'), `${result.stdout || ''}${result.stderr || ''}${result.error ? '\n' + result.error : ''}`);
  let summary = {};
  try { summary = JSON.parse((result.stdout || '').trim().split('\n').filter(l => l.startsWith('{')).at(-1)); } catch { /* keep raw log */ }
  results.push({ id: job.id, kind: job.kind, language: job.language, size: job.size, env: job.env || {}, exitCode: result.status, signal: result.signal, frames: summary.frames, issues: summary.issues, error: summary.error ?? result.error?.message, output: dest });
  console.log(JSON.stringify(results.at(-1)));
  writeFileSync(path.join(runRoot, 'results.json'), JSON.stringify({ label, cases: results }, null, 2));
}
console.log(`Done: ${runRoot}`);
if (results.some(r => r.exitCode !== 0 || (r.issues && r.issues.length) || r.error)) process.exitCode = 1;
