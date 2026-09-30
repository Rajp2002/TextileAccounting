// Runs archived and extra guided-tour cases through the UNCHANGED tracked runner, the review's network guard and
// the isolation wrapper, into a new results folder. It never edits the runner and never adjudicates: run
// classify.mjs on the output and inspect the screenshots.
//
//   node scripts/performance/isolated-command.mjs env PLAYWRIGHT_ROOT=... CHROMIUM_PATH=... \
//     node qa-artifacts/guided-tours/2026-09-30-bv01-bv02-fixes/run-matrix.mjs <label> <sets> [id-regex]
//
// <sets> is a comma list of: gt05, gt15 (archived review jobs) and extra (extra-jobs.json in this folder).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const bundle = import.meta.dirname;
const root = path.resolve(bundle, '../../..');
const review = path.join(root, 'qa-artifacts/guided-tours/2026-09-30-independent-review');
const harness = path.join(root, 'scratch/tour-fix-review');
const wrapper = path.join(root, 'scripts/performance/isolated-command.mjs');
const [label, sets = '', filter] = process.argv.slice(2);
if (!label || !sets) { console.error('Usage: run-matrix.mjs <label> <gt05|gt15|extra[,..]> [id-regex]'); process.exit(2); }
if (!process.env.PLAYWRIGHT_ROOT || process.env.CHROMIUM_PATH === undefined) throw new Error('Supply PLAYWRIGHT_ROOT and CHROMIUM_PATH after the isolation wrapper.');

const runner = path.join(harness, 'run-tour.mjs');
if (!readFileSync(runner).equals(readFileSync(path.join(root, 'docs/guided-tours/harness/run-tour.mjs')))) {
  throw new Error('Scratch runner differs from the tracked runner; use a fresh harness copy. Assertions must not be edited.');
}
// gt05, gt06 ... gt15 and g1 are the reviewer's archived main-matrix job files; extra is this bundle's own list.
const sources = new Proxy({ extra: path.join(bundle, 'extra-jobs.json'), batch: path.join(bundle, 'batch-jobs.json') }, {
  get: (target, set) => target[set] ?? (/^(gt(0[3-9]|1[0-5])|g1)$/.test(String(set)) ? path.join(review, `evidence/${String(set)}-jobs.json`) : undefined),
});
const jobs = sets.split(',').flatMap(set => {
  if (!sources[set]) throw new Error(`Unknown set ${set}`);
  return JSON.parse(readFileSync(sources[set], 'utf8')).map(job => ({ ...job, set }));
}).filter(job => !filter || new RegExp(filter).test(job.id));
if (!jobs.length) throw new Error('No matching jobs.');

const runRoot = path.join(root, 'scratch/tour-fix-review-results', `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(runRoot, { recursive: true });
const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();
const results = [];
for (const job of jobs) {
  const dest = path.join(runRoot, job.id);
  mkdirSync(dest);
  const args = [wrapper, 'env', `PLAYWRIGHT_ROOT=${process.env.PLAYWRIGHT_ROOT}`, `CHROMIUM_PATH=${process.env.CHROMIUM_PATH}`, `NETWORK_LOG=${path.join(dest, 'network.json')}`,
    ...Object.entries(job.env || {}).map(([key, value]) => `${key}=${value}`),
    'node', '--import', path.join(review, 'network-guard.mjs'), runner, job.scenario, job.language, job.size, dest];
  const started = Date.now();
  const result = spawnSync(process.execPath, args, { cwd: harness, timeout: 170000, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(path.join(dest, 'command.log'), `${result.stdout || ''}${result.stderr || ''}${result.error ? '\n' + result.error : ''}`);
  results.push({ id: job.id, set: job.set, scenario: job.scenario, language: job.language, size: job.size, env: job.env || {}, exitCode: result.status, signal: result.signal, error: result.error?.message, seconds: Math.round((Date.now() - started) / 1000), output: dest });
  console.log(JSON.stringify(results.at(-1)));
  writeFileSync(path.join(runRoot, 'results.json'), JSON.stringify({ label, sets, filter: filter ?? null, head: git(['rev-parse', 'HEAD']), workingTreeDiffSha256: createHash('sha256').update(git(['diff', 'HEAD', '--', 'app', 'components', 'lib', '__tests__'])).digest('hex'),
    runnerSha256: createHash('sha256').update(readFileSync(runner)).digest('hex'), cases: results }, null, 2));
}
console.log(`Done: ${runRoot}`);
