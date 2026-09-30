import pathlib, json, collections

root = pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out = root / 'scratch/browser-verification'
report = json.loads((out / 'report.json').read_text())
groups = ['g1'] + [f'gt{number:02d}' for number in range(5,16)]
lines = ['# Independent guided-tour review', '', f'Checkout: `{root}`', f'Branch `{report["source"]["branch"]}` at `{report["source"]["head"]}`. Synthetic isolated browser fixtures only; no live/QA/production access.', '', f'Current phase: **{report["phase"]}**. Next: `{report.get("nextCommand", "see checkpoint")}`.', '', 'G1 reviewer verdict: **PASS WITH CONDITIONS**. GT-04 remains IN_PROGRESS; this does not pass owner QA or authorize an implementation wave.', '', '| Scope | Runs | Captured steps | Runner failures | Non-network failures | Raw classifications | Evidence |', '| --- | ---: | ---: | ---: | ---: | --- | --- |']
total_runs = total_steps = 0
if report.get('integratedReviewVerdict'):
    lines[6:6] = [f'Integrated independent-review verdict: **{report["integratedReviewVerdict"]}**. Required acceptance gates remain unfulfilled.', '']
for group in groups:
    path = out / f'{group}-results.json'
    if not path.exists():
        lines.append(f'| {group.upper()} | 0 | 0 | UNVERIFIED | UNVERIFIED | Not run yet | — |')
        continue
    rows = json.loads(path.read_text())
    failures = non_network = 0
    for row in rows:
        record = json.loads(pathlib.Path(row['record']).read_text()) if row.get('record') else {}
        if row.get('exitCode') or record.get('error') or record.get('issues') or not row.get('record'):
            failures += 1
        if record.get('error') or not row.get('record') or any(issue != 'navigation/API request' for issue in record.get('issues', [])):
            non_network += 1
    steps = sum(row['steps'] for row in rows)
    classes = ', '.join(f'{key}: {value}' for key,value in collections.Counter(row['classification'] for row in rows).items())
    lines.append(f'| {group.upper()} | {len(rows)} | {steps} | {failures} | {non_network} | {classes} | [{path.name}]({path.name}) |')
    total_runs += len(rows)
    total_steps += steps
lines += ['', f'Completed main matrix runs: **{total_runs}**; captured steps: **{total_steps}**. Supplemental probes and keyboard evidence are separate.', '', 'Runner failures retain every raw exit/error/assertion. Non-network failures exclude only the API guard assertion; numeric rail flags and the original launch timeout remain counted and are adjudicated in the per-task notes.', '', '## Supplemental evidence', '', '| Script group | Runs | Captured steps or frames | Evidence |', '| --- | ---: | ---: | --- |']
for group in ['g1-supplemental','gt09-retry','gt10-paint','gt11-paint','gt13-transition','gt14-transition','gt15-retry','gt15-transition']:
    path=out/f'{group}-results.json'
    if path.exists():
        rows=json.loads(path.read_text())
        lines.append(f'| {group} | {len(rows)} | {sum(row.get("steps",0) for row in rows)} | [{path.name}]({path.name}) |')
lines += ['', 'Original failures and screenshots remain preserved. Supplemental retries or diagnostic frames do not replace main results. G1 keyboard-only evidence is separately recorded (four paths, 21 steps).', '', '## Findings and review limits', '']
for finding in report.get('findings', []):
    lines.append(f'- **{finding["id"]} {finding["severity"]} — {finding["owner"]} {finding["status"]}:** {finding.get("reason", "see finding record")}. [{finding.get("evidence", "report.json")}]({finding.get("evidence", "report.json")}).')
if report.get('fixtureIncident'):
    lines += ['', 'The owned fixture server exhausted Node heap memory before the final two original GT-15 runs loaded. Both connection-refused failures remain intact; two unchanged retries after restarting the identical fixture recovered 14 steps and are separately listed above. [Fixture incident](gt15-fixture-oom.json).']
lines += ['', 'GT-05 raw failures include the intercepted baseline Estimator analytics mount request. Three Gujarati phone runs also reproduce BV-01, an application defect. GT-06 raw guard classifications remain FAIL for the intercepted baseline Rate Book mount analytics; all 22 UI assertion sets passed. BaseProduction fixtures also emit the unchanged baseline production_viewed mount event. Those blocked requests are preserved and are not described as network-clean runs. GT-10 numeric rail flags are retained and separately adjudicated using unchanged-runner screenshots and computed paint geometry; see its task note.', '', 'Owner QA, native Gujarati/Hindi review, screen reader, real devices, authenticated shell and live preference metadata persistence remain **UNVERIFIED**. Synthetic checks do not substitute for them. GT-16/GT-17 are NOT_STARTED; GT-B1 is BLOCKED by PI-06/PI-07. PI-04 remains the separately tracked owner-approved Daily Sheet deferral, with U-06 copy and navigation unchanged.', '', '## Reviewer checks and evidence', '', '- Typecheck PASS; lint PASS with zero warnings; full Vitest 236 files / 1,995 tests / one existing live-only skip; tour subset 52 files / 661 tests PASS. [Commands](commands/results.json).', '- Initial subset import failures from duplicated evidence copies were retained, and those copies were preserved outside test discovery before the unchanged retry.', '- Exact source copy audit: 849 matches, zero mismatches, zero unmatched; native review remains pending.', '- [G1 reviewer verdict](g1-review.md); [final keyboard evidence](g1-keyboard-final/record.json). Two prior invalid reviewer probes remain preserved and explained.', '- Per-run command logs, traffic, records, screenshots and derived contact sheets remain under this directory. No mandatory test, assertion, timeout, discovery configuration or application source was changed.', '', '## Completed per-task adjudication', '']
for task, review in report.get('taskReviews', {}).items():
    lines += [f'**{task}: {review["status"]}.** {review["reviewNotes"]}', '']
if report.get('sourceIntegrity'):
    lines += ['## Source integrity', '', f'Application unchanged: **{report["sourceIntegrity"]["applicationUnchanged"]}**. HEAD/branch unchanged; only the authorized execution ledger differs from the initial source manifest. [Integrity proof](source-integrity.json).', '']
if report.get('integrityRepair'):
    lines += ['The first final comparator omitted the starting manifest tombstones for eleven preexisting deleted files. That false change report and its helper are preserved; the final proof uses the identical starting schema. [Original comparison](integrity-first-attempt/source-integrity.json); [corrected helper provenance](provenance-integrity-repair/manifest.json).', '']
if report.get('ownedServer'):
    lines += [f'Owned synthetic Vite harness stopped: **{report["ownedServer"]["stopped"]}**. [Shutdown evidence](owned-server-stop.json).', '']
(out / 'report.md').write_text('\n'.join(lines) + '\n')
print(json.dumps(dict(phase=report['phase'], runs=total_runs, steps=total_steps, artifact=str(out/'report.md'))))
