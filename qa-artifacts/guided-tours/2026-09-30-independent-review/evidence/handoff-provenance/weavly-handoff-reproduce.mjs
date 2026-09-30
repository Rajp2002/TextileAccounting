import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const bundle = import.meta.dirname;
const root = path.resolve(bundle, '../../..');
const harness = path.join(root, 'scratch/tour-fix-review');
const wrapper = path.join(root, 'scripts/performance/isolated-command.mjs');
const action = process.argv[2];
if (!['prepare', 'BV-01', 'BV-02'].includes(action)) {
  console.error('Usage: reproduce.mjs prepare|BV-01|BV-02 [original-run-id]');
  process.exit(2);
}
if (action === 'prepare') {
  if (existsSync(harness)) throw new Error('scratch/tour-fix-review already exists; preserve it or choose a separate scratch directory.');
  mkdirSync(path.dirname(harness), { recursive: true });
  cpSync(path.join(root, 'docs/guided-tours/harness'), harness, { recursive: true });
  console.log(`Prepared ${harness}`);
  process.exit(0);
}
if (!existsSync(harness)) throw new Error('Run prepare first.');
if (!process.env.PLAYWRIGHT_ROOT || process.env.CHROMIUM_PATH === undefined) {
  throw new Error('Supply PLAYWRIGHT_ROOT and CHROMIUM_PATH after the isolation wrapper, as documented in README.md.');
}
const runner = path.join(harness, 'run-tour.mjs');
const tracked = path.join(root, 'docs/guided-tours/harness/run-tour.mjs');
if (!readFileSync(runner).equals(readFileSync(tracked))) throw new Error('Scratch runner differs from the tracked runner; use a fresh harness.');
const group = action === 'BV-01' ? 'gt05' : 'gt15';
const jobs = JSON.parse(readFileSync(path.join(bundle, `evidence/${group}-jobs.json`), 'utf8'));
const requested = process.argv[3];
const selected = jobs.filter(job => requested ? job.id === requested : action === 'BV-01'
  ? job.language === 'gu' && job.size === '390x844'
  : job.size === '1024x768' || job.size === '1280x800');
if (!selected.length) throw new Error('No matching archived case.');
const runRoot = path.join(root, 'scratch/tour-fix-review-results', `${action}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(runRoot, { recursive: true });
const results = [];
for (const job of selected) {
  const dest = path.join(runRoot, job.id);
  mkdirSync(dest);
  const args = [wrapper, 'env', `PLAYWRIGHT_ROOT=${process.env.PLAYWRIGHT_ROOT}`, `CHROMIUM_PATH=${process.env.CHROMIUM_PATH}`, `NETWORK_LOG=${path.join(dest, 'network.json')}`,
    ...Object.entries(job.env || {}).map(([key, value]) => `${key}=${value}`),
    'node', '--import', path.join(bundle, 'network-guard.mjs'), runner, job.scenario, job.language, job.size, dest];
  const result = spawnSync(process.execPath, args, { cwd: harness, timeout: 170000, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(path.join(dest, 'command.log'), `${result.stdout || ''}${result.stderr || ''}${result.error ? '\n' + result.error : ''}`);
  results.push({ originalCase: job.id, scenario: job.scenario, language: job.language, size: job.size, env: job.env || {}, exitCode: result.status, signal: result.signal, error: result.error?.message, output: dest });
  console.log(JSON.stringify(results.at(-1)));
}
writeFileSync(path.join(runRoot, 'results.json'), JSON.stringify({ finding: action, runnerSha256: createHash('sha256').update(readFileSync(runner)).digest('hex'), cases: results }, null, 2));
console.log(`Preserved new evidence at ${runRoot}. Raw API guard failures remain unsuppressed; inspect records and screenshots.`);
if (results.some(result => result.exitCode !== 0)) process.exitCode = 1;
