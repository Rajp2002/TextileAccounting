#!/usr/bin/env python3
"""Compares two run-matrix result folders job by job: the harness "summary unchanged" check.

    python3 compare-runs.py <baseline-folder> <candidate-folder> [--common] [--json out.json]

--common compares only jobs present in both folders (for a baseline that was stopped early).

Compared exactly (any difference is reported as a MISMATCH): exit code, step sequence, per-step status, whether the
panel/outline overlap is zero, the runner's issue list, the number of /api/ requests and their method+path.
Geometry (outline and panel rectangles) is compared with a tolerance and reported as information only, because
samples are taken at a fixed 900 ms and can differ by a few pixels between identical runs.
"""
import glob
import json
import os
import sys

base_dir, cand_dir = sys.argv[1], sys.argv[2]
common = '--common' in sys.argv
out = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None


def load(folder):
    results = json.load(open(os.path.join(folder, 'results.json')))
    jobs = {}
    for case in results['cases']:
        job = case.get('id') or case.get('originalCase')
        records = glob.glob(os.path.join(case['output'] if os.path.isabs(case['output']) else os.path.join(folder, job), '*', 'record.json'))
        record = json.load(open(records[0])) if records else None
        net_path = os.path.join(folder, job, 'network.json')
        api = []
        if os.path.exists(net_path):
            for e in json.load(open(net_path)):
                if e.get('type') == 'request' and '/api/' in e['url']:
                    api.append(f"{e['method']} {e['url'].split('5199')[-1]}")
        jobs[job] = {'exit': case.get('exitCode'), 'record': record, 'api': sorted(api)}
    return jobs


def rect_delta(a, b):
    if not a or not b:
        return 0 if a == b else 9999
    return max(abs(a[k] - b[k]) for k in ('x', 'y', 'w', 'h'))


base, cand = load(base_dir), load(cand_dir)
rows, mismatches = [], []
for job in sorted(set(base) | set(cand)):
    b, c = base.get(job), cand.get(job)
    if not b or not c:
        if not common:
            mismatches.append((job, 'present in only one folder'))
        continue
    problems = []
    if b['exit'] != c['exit']:
        problems.append(f"exit {b['exit']} -> {c['exit']}")
    br, cr = b['record'], c['record']
    if (br is None) != (cr is None):
        problems.append('record missing on one side')
    elif br and cr:
        bs, cs = br.get('steps', []), cr.get('steps', [])
        if [s.get('step') for s in bs] != [s.get('step') for s in cs]:
            problems.append('step sequence differs')
        else:
            for x, y in zip(bs, cs):
                if x.get('status') != y.get('status'):
                    problems.append(f"{x.get('step')}: status {x.get('status')} -> {y.get('status')}")
                if bool(x.get('overlapArea')) != bool(y.get('overlapArea')):
                    problems.append(f"{x.get('step')}: overlap {x.get('overlapArea')} -> {y.get('overlapArea')}")
        if sorted(br.get('issues', [])) != sorted(cr.get('issues', [])):
            problems.append(f"issues {br.get('issues')} -> {cr.get('issues')}")
    if b['api'] != c['api']:
        problems.append(f"api {b['api']} -> {c['api']}")
    drift = 0
    if br and cr and len(br.get('steps', [])) == len(cr.get('steps', [])):
        for x, y in zip(br['steps'], cr['steps']):
            drift = max(drift, rect_delta(x.get('highlight'), y.get('highlight')), rect_delta(x.get('panel'), y.get('panel')))
    rows.append({'job': job, 'steps': len(cr['steps']) if cr else 0, 'geometryDriftPx': drift, 'problems': problems})
    if problems:
        mismatches.append((job, '; '.join(problems)))

same = [r for r in rows if not r['problems']]
print(f"{len(rows)} jobs compared: {len(same)} identical on every exact signal, {len(mismatches)} mismatched")
for job, why in mismatches:
    print('MISMATCH', job, '|', why)
drifted = [r for r in rows if r['geometryDriftPx'] > 2]
print(f"geometry (informational): {len(rows) - len(drifted)} jobs within 2 px on every rectangle; {len(drifted)} differ by more (max {max([r['geometryDriftPx'] for r in rows] or [0])} px)")
for r in drifted[:12]:
    print('  drift', r['job'], r['geometryDriftPx'], 'px')
if out:
    json.dump({'baseline': base_dir, 'candidate': cand_dir, 'compared': len(rows), 'identical': len(same), 'mismatches': mismatches, 'rows': rows}, open(out, 'w'), indent=2)
sys.exit(1 if mismatches else 0)
