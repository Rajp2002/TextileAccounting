// Classifies a run-matrix results folder. A raw exit code is never acceptance evidence: every run is split into
// application findings, the documented baseline mount request, or harness failures.
//
//   node qa-artifacts/guided-tours/2026-09-30-bv01-bv02-fixes/classify.mjs <results-folder> [--json out.json]
//
// Classes:
//   PASS                     no runner issue, only the baseline mount request(s) blocked by the guard
//   BASELINE_ANALYTICS_ONLY  the only runner issue is "navigation/API request", caused by that baseline request
//   FAIL                     any other runner issue, a missing record, an unexpected/duplicated API request, a page error
//   HARNESS_FAILURE          no record or a launch/connection failure (never counted as a pass)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [folder, flag, jsonOut] = process.argv.slice(2);
if (!folder) { console.error('Usage: classify.mjs <results-folder> [--json out.json]'); process.exit(2); }
const results = JSON.parse(readFileSync(path.join(folder, 'results.json'), 'utf8'));

// Requests the application makes on mount, unrelated to any tour step. The guard blocks them; they are retained.
const BASELINE = [
  { name: 'estimator_opened', match: r => r.method === 'POST' && r.path === '/api/analytics/plan-events' && /"eventName":"estimator_opened"/.test(r.body || '') },
  { name: 'production_viewed', match: r => r.method === 'POST' && r.path === '/api/analytics/plan-events' && /"eventName":"production_viewed"/.test(r.body || '') },
  { name: 'rate_book_viewed', match: r => r.method === 'POST' && r.path === '/api/analytics/plan-events' && /"eventName":"rate_book_viewed"/.test(r.body || '') },
  { name: 'free_status', match: r => r.method === 'GET' && r.path === '/api/free/status' },
  // Not analytics: the Free Saved Costings page lists its costings on mount and the runner stubs that read with an empty list.
  { name: 'free_costings_list_stub', match: r => r.method === 'GET' && r.path === '/api/free/costings' },
];
const findRecord = dir => readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(dir, d.name, 'record.json')).find(existsSync);

const rows = results.cases.map(run => {
  const dir = run.output;
  const problems = []; const notes = [];
  const recordPath = findRecord(dir);
  const record = recordPath ? JSON.parse(readFileSync(recordPath, 'utf8')) : null;
  const network = existsSync(path.join(dir, 'network.json')) ? JSON.parse(readFileSync(path.join(dir, 'network.json'), 'utf8')) : [];
  const api = network.filter(e => e.type === 'request' && new URL(e.url).pathname.startsWith('/api/')).map(e => ({ method: e.method, path: new URL(e.url).pathname, body: e.body }));
  const external = network.filter(e => e.type === 'blocked-external');
  const baseline = []; const unexpected = [];
  for (const request of api) {
    const known = BASELINE.find(b => b.match(request));
    if (known) baseline.push(known.name); else unexpected.push(`${request.method} ${request.path}`);
  }
  const duplicates = [...new Set(baseline.filter((name, i) => baseline.indexOf(name) !== i))];
  const issues = record?.issues ?? [];
  const otherIssues = issues.filter(issue => issue !== 'navigation/API request');
  const pageErrors = (record?.logs ?? []).filter(line => line.startsWith('pageerror:'));
  let cls;
  if (!record || record.error || run.error || run.signal) cls = 'HARNESS_FAILURE';
  else if (otherIssues.length || unexpected.length || duplicates.length || external.length || pageErrors.length) cls = 'FAIL';
  else if (issues.includes('navigation/API request')) cls = baseline.length ? 'BASELINE_ANALYTICS_ONLY' : 'FAIL';
  else cls = 'PASS';
  if (run.exitCode !== 0 && cls === 'PASS') problems.push('exit code non-zero without runner issue');
  if (!record) problems.push('no record.json');
  for (const issue of otherIssues) problems.push(issue);
  for (const request of unexpected) problems.push(`unexpected API request ${request}`);
  for (const name of duplicates) problems.push(`baseline request repeated: ${name}`);
  for (const event of external) problems.push(`external request blocked: ${event.url}`);
  for (const line of pageErrors) problems.push(line);
  if (baseline.length) notes.push(`baseline mount request blocked: ${baseline.join(', ')}`);
  const steps = record?.steps ?? [];
  const screenshots = existsSync(dir) ? readdirSync(dir, { recursive: true }).filter(f => String(f).endsWith('.png')).length : 0;
  return { id: run.id ?? run.originalCase, set: run.set ?? results.finding ?? '', scenario: run.scenario, language: run.language, size: run.size, env: run.env, exitCode: run.exitCode, class: cls,
    steps: steps.length, statuses: steps.map(s => s.status).join(','), maxPanelOutlineOverlap: Math.max(0, ...steps.map(s => s.overlapArea ?? 0)),
    screenshots, problems, notes, runnerIssues: issues, apiRequests: api.length, baselineRequests: baseline };
});
const totals = rows.reduce((t, r) => ({ ...t, [r.class]: (t[r.class] ?? 0) + 1 }), {});
for (const r of rows) console.log(`${r.class.padEnd(24)} exit=${String(r.exitCode).padEnd(4)} ${r.id.padEnd(46)} ${r.language} ${r.size.padEnd(9)} steps=${r.steps} maxOverlap=${r.maxPanelOutlineOverlap} shots=${r.screenshots}${r.problems.length ? '  PROBLEMS: ' + r.problems.join(' | ') : ''}`);
console.log(`\n${rows.length} runs, ${rows.reduce((n, r) => n + r.steps, 0)} captured steps: ${JSON.stringify(totals)}`);
if (flag === '--json' && jsonOut) writeFileSync(jsonOut, JSON.stringify({ folder, head: results.head, workingTreeDiffSha256: results.workingTreeDiffSha256, runnerSha256: results.runnerSha256, totals, runs: rows }, null, 2));
if (rows.some(r => r.class === 'FAIL' || r.class === 'HARNESS_FAILURE')) process.exitCode = 1;
