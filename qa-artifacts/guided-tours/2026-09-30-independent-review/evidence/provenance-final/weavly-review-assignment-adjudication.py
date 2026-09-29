import pathlib,json,re
root=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out=root/'scratch/browser-verification'
rows=json.loads((out/'gt15-results.json').read_text())
jobs=json.loads((out/'gt15-jobs.json').read_text())
assert len(rows)==len(jobs)==16
report=json.loads((out/'report.json').read_text())
assert 'GT-15' in report['taskReviews']
assert not any(f['id']=='BV-02' for f in report['findings'])
retry=json.loads((out/'gt15-retry-results.json').read_text())
assert len(retry)==2 and all(r['steps']==7 and r['record'] for r in retry)
cases=[];mount=[]
for row in rows+retry:
    if not row['record']:
        assert row['steps']==0 and 'net::ERR_CONNECTION_REFUSED' in (out/'runs'/row['id']/'command.log').read_text()
        continue
    record=json.loads(pathlib.Path(row['record']).read_text())
    assert row['steps']==(5 if row.get('env',{}).get('EXIT_AT') else 7)
    if (row['language'],row['size']) in [('en','1440x900'),('gu','390x844')]:
        assert row['id']+':all' in report['visualReviewed']
    step=record['steps'][0]
    if step['overlapArea']>0:
        cases.append(dict(id=row['id'],origin='unchanged retry' if row in retry else 'original main',language=row['language'],size=row['size'],step=step['step'],overlapArea=step['overlapArea'],panel=step['panel'],highlight=step['highlight'],screenshot=str(pathlib.Path(row['record']).parent/'01.png'),record=row['record']))
    network=json.loads((pathlib.Path(row['record']).parents[1]/'network.json').read_text())
    apis=[e for e in network if e['type']=='request' and '/api/' in e['url']]
    assert len(apis)==1 and json.loads(apis[0]['body'])=={'eventName':'production_viewed','properties':{'surface':'base_production_core'}},apis
    assert all(c['fn']=='recordTourEventAction' for c in record['after']['serverCalls'])
    mount.append(dict(id=row['id'],apiRequests=apis,blocked=row['blockedNetwork'],issues=record['issues']))
assert cases and any(c['size']=='1024x768' for c in cases)
finding=dict(id='BV-02',severity='Major',owner='GT-15',step='ma-purpose',case='Assignments / English 1024x768 and Hindi 1280x800 / empty, populated and Night/focus; standard and reduced motion',status='FAILED',evidence='runs/gt15-0-en-1024x768/assignments-en-1024x768/01.png',reason='Step-1 panel overlaps the board; the required MA-1 no-overlap condition remains unmet and the conditional fallback was not selected',source='lib/configuration-tour.ts:52',requirement='docs/guided-tours/pages/machine-assignments.md §E and GT-15 packet',cases=cases)
(out/'gt15-finding-bv02.json').write_text(json.dumps(finding,indent=2))
(out/'gt15-mount-analytics-adjudication.json').write_text(json.dumps(dict(observation='One unchanged BaseProduction mount production_viewed event per main run, blocked by the safety guard. Original raw FAIL and API assertions are retained. Tour-added server calls are preference events only.',source='app/(dashboard)/owner/production/BaseProductionClient.tsx:287',cases=mount),indent=2))
report['findings'].append(finding)
report['taskStatus']['GT-15']='FAILED'
review=report['taskReviews']['GT-15'];review['status']='FAILED';review['findings']=['BV-02'];review['adjudication']='gt15-finding-bv02.json'
(out/'gt15-review.json').write_text(json.dumps(review,indent=2))
(out/'report.json').write_text(json.dumps(report,indent=2))
ledger=root/'docs/guided-tours/EXECUTION_STATUS.md'
current=ledger.read_text();marker='### Independent finding BV-02 — GT-15 FAILED — 2026-09-30'
assert marker not in current
lines=current.splitlines()
for i,line in enumerate(lines):
    cells=line.split('|')
    if len(cells)==8 and cells[2].strip().startswith('GT-15 '):
        cells[3]=' FAILED ';cells[6]=' BV-02 Major: MA-1 board overlap; human gates UNVERIFIED below '
        lines[i]='|'.join(cells)
current='\n'.join(lines)+'\n'
entry=f'''\n\n{marker}

- **Major:** The step-1 `ma-purpose` panel covers part of the outlined board at English 1024×768 and Hindi 1280×800. Reproduced in {len([c for c in cases if c['origin']=='original main'])} original main cases plus {len([c for c in cases if c['origin']=='unchanged retry'])} unchanged retry, including empty/populated, retained Night/focus/nonmatching search and the modeled reduced-motion cases. This is visible opaque panel/board overlap, not the transparent rail bounding-box false positive from Payroll/Production.
- Page spec §E and the GT-15 packet require no overlap. §E requires selecting the conditional `assignments.columns` fallback when overlap remains at 1024×768. Current `lib/configuration-tour.ts:52` still chooses `[data-configuration-tour="board"]`; the task cannot pass MA-1 with this evidence. The reviewer has not tested or implemented an alternate anchor.
- Reproduction: unchanged isolated `assignments` harness, English, 1024×768; launch the guide and inspect step 1. Panel `(16,577,360,175)` overlaps outline `(270,95,732,577)` by 10,070 square pixels. English desktop 1440 and Gujarati phone captured step-1 cases have no overlap; they do not waive the smaller desktop requirement.
- Evidence: `scratch/browser-verification/gt15-finding-bv02.json`, per-run original records and `01.png`; canonical `runs/gt15-0-en-1024x768/assignments-en-1024x768/01.png`. All required English desktop/Gujarati phone steps were separately inspected, with additional 1024/1280 board screenshots reviewed.
- Correction belongs to GT-15 under separate implementation authorization: resolve the conditional board anchor/placement, then re-verify the same viewports and variants. No application code fix was made during this review. Required human/live gates remain **UNVERIFIED**.
- Raw failures also retain one blocked unchanged `production_viewed` mount request per loaded run. See `gt15-mount-analytics-adjudication.json`; no business handler increment, live request or tour navigation was observed. The last two original main runs failed before loading when the owned fixture server exhausted Node heap memory; the identical server was restarted and both cases rerun unchanged, separately preserved. See `gt15-fixture-oom.json` and `gt15-retry-results.json`. Original assertions/classifications/screenshots are preserved.
'''
ledger.write_text(current+entry)
print(json.dumps(dict(finding='BV-02',severity='Major',status='FAILED',reproductions=len(cases))))
