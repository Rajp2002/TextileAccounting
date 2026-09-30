import pathlib, json, sys, collections, re

root = pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out = root / 'scratch/browser-verification'
group, note = sys.argv[1:3]
rows = json.loads((out / f'{group}-results.json').read_text())
jobs = json.loads((out / f'{group}-jobs.json').read_text())
assert len(rows) == len(jobs), (len(rows), len(jobs))
records = [(row, json.loads(pathlib.Path(row['record']).read_text()) if row.get('record') else {}) for row in rows]
failures = [dict(id=row['id'], exitCode=row['exitCode'], error=row.get('error'), issues=record.get('issues', []), blockedNetwork=row.get('blockedNetwork', [])) for row, record in records if row['classification'] != 'AUTOMATED_PASS' or record.get('issues')]
summary = dict(task='GT-' + group[2:], runs=len(rows), steps=sum(row['steps'] for row in rows), classifications=dict(collections.Counter(row['classification'] for row in rows)), failures=failures, reviewNotes=note, status='IN_PROGRESS', humanGates='UNVERIFIED', visualReview='Every captured English 1440x900 and Gujarati 390x844 step inspected', evidence=f'{group}-results.json')
retry_path = out / f'{group}-retry-results.json'
retry_rows = json.loads(retry_path.read_text()) if retry_path.exists() else []
if retry_rows:
    summary['supplementalRetries'] = retry_rows
paint_path = out / f'{group}-paint-results.json'
paint_rows = json.loads(paint_path.read_text()) if paint_path.exists() else []
if paint_rows:
    summary['supplementalPaintDiagnostics'] = paint_rows
transition_path = out / f'{group}-transition-results.json'
transition_rows = json.loads(transition_path.read_text()) if transition_path.exists() else []
if transition_rows:
    summary['supplementalTransitionDiagnostics'] = transition_rows
(out / f'{group}-review.json').write_text(json.dumps(summary, indent=2))
report = json.loads((out / 'report.json').read_text())
report.setdefault('taskReviews', {})[summary['task']] = summary
for row in rows + retry_rows + paint_rows + transition_rows:
    if row.get('steps', 0) and (row.get('language'), row.get('size')) in [('en','1440x900'), ('gu','390x844')]:
        item = row['id'] + ':all'
        if item not in report['visualReviewed']:
            report['visualReviewed'].append(item)
report['remaining'] = 'Continue independent review of the remaining already integrated tasks; required human/live evidence remains UNVERIFIED'
report['taskStatus'][summary['task']] = summary['status']
report['nextCommand'] = 'gt' + str(int(group[2:]) + 1).zfill(2) if int(group[2:]) < 15 else 'final review and source integrity closeout'
(out / 'report.json').write_text(json.dumps(report, indent=2))
ledger = root / 'docs/guided-tours/EXECUTION_STATUS.md'
marker = f'### Independent reviewer matrix — {summary["task"]} — 2026-09-30'
current = ledger.read_text()
assert marker not in current, 'Do not duplicate checkpoint'
lines = current.splitlines()
for index, line in enumerate(lines):
    cells = line.split('|')
    if len(cells) == 8 and cells[2].strip().startswith(summary['task'] + ' '):
        cells[3] = ' IN_PROGRESS '
        cells[5] = ' 2026-09-30 '
        cells[6] = ' Independent matrix complete; human gates UNVERIFIED below '
        lines[index] = '|'.join(cells)
current = '\n'.join(lines) + '\n'
next_task = 'GT-' + str(int(group[2:]) + 1).zfill(2) if int(group[2:]) < 15 else 'final independent-review closeout'
current = re.sub(r'^\*\*Exact next action:\*\*.*$', f'**Exact next action:** Continue independent synthetic-browser review at {next_task}, in queue order through the already integrated GT-15. GT-05 is FAILED (BV-01); G1 has a reviewer verdict of PASS WITH CONDITIONS, with required human evidence still UNVERIFIED. No application fixes or new implementation waves; GT-16/GT-17 have not started.', current, count=1, flags=re.M)
entry = f'\n\n{marker}\n\n- {len(rows)} runs / {summary["steps"]} captured steps. Raw classifications: {summary["classifications"]}. All captured English desktop/Gujarati phone steps visually inspected.\n- {note}\n- Evidence: `scratch/browser-verification/{group}-results.json`, `{group}-review.json`, per-run records/network logs/screenshots, and `{group}-contact-manifest.json`. Any raw failed result is preserved; reviewer adjudication must distinguish application defects from invalid probes.\n- {summary["task"]} remains **IN_PROGRESS** pending explicit finding adjudication and required prerequisites/human gates; independent case passes do not promote the task. Owner/native-language/screen-reader/real-device/live persistence checks remain **UNVERIFIED**. No application code change or new implementation wave.\n'
ledger.write_text(current + entry)
print(json.dumps({key:summary[key] for key in ['task','runs','steps','classifications','status']}))
