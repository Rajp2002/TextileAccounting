import pathlib,json,collections,re,hashlib,shutil
root=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out=root/'scratch/browser-verification'
report=json.loads((out/'report.json').read_text())
groups=['g1']+[f'gt{i:02d}' for i in range(5,16)]
completed=[]
for group in groups:
    rows=json.loads((out/f'{group}-results.json').read_text())
    jobs=json.loads((out/f'{group}-jobs.json').read_text())
    assert len(rows)==len(jobs),(group,len(rows),len(jobs))
    completed.append(dict(group=group,runs=len(rows),steps=sum(r['steps'] for r in rows),classifications=dict(collections.Counter(r['classification'] for r in rows))))
notes={
 'gt05': 'All 17 original runs and required English desktop/Gujarati phone captures reviewed. BV-01 Major reproduces unavailable Save step 9 in Gujarati phone Base/Lite/Free. Other UI assertions pass, including Detailed Done/Exit. Raw FAIL also retains unchanged intercepted estimator_opened mount analytics; no tour business-action increment. Existing costing/already-open sheet/live factory configuration remain UNVERIFIED. No fix applied.',
 'gt06': 'All 22 original runs exit 0 with no UI issues; all required English desktop/Gujarati phone captures reviewed. Empty/populated, retained nonmatching search Exit/Done, deleted-demo and archived-only recovery verified. Approved unavailable update/review/usage states continue and Done focuses Add Yarn Rate. Raw guard FAIL retains unchanged rate_book_viewed mount analytics; prelaunch usage getter is stubbed, with no tour business-action increment. Human/live gates and upstream dependencies remain unfulfilled.'
}
for group,note in notes.items():
    summary=next(x for x in completed if x['group']==group)
    task='GT-'+group[2:]
    item=dict(task=task,**summary,reviewNotes=note,status='FAILED' if task=='GT-05' else 'IN_PROGRESS',humanGates='UNVERIFIED',visualReview='Every captured English 1440x900 and Gujarati 390x844 step inspected',evidence=f'{group}-results.json')
    report['taskReviews'][task]=item
    (out/f'{group}-review.json').write_text(json.dumps(item,indent=2))
report['taskReviews']=dict(sorted(report['taskReviews'].items()))
report['completed']=completed
report['phase']='Independent review complete through GT-15'
report['remaining']='Application corrections and required owner/native/screen-reader/device/live acceptance evidence remain outstanding; no further implementation is authorized by this review.'
report['nextCommand']='Address recorded findings in their owning tasks only under separate implementation authorization; human gates remain UNVERIFIED'
report['integratedReviewVerdict']='FAIL' if any(f['severity'] in ['Blocker','Major'] for f in report['findings']) else 'PASS WITH CONDITIONS'
report['taskStatus'].pop('GT-06..GT-15',None)
report['taskStatus']['GT-06']='IN_PROGRESS'
report['humanGates']['authenticatedShell']='UNVERIFIED'
report['humanGates']['livePreferenceMetadataPersistence']='UNVERIFIED'
runner=root/'scratch/browser-verification-harness/run-tour.mjs'
tracked=root/'docs/guided-tours/harness/run-tour.mjs'
report['runnerIntegrity']=dict(unchanged=runner.read_bytes()==tracked.read_bytes(),sha256=hashlib.sha256(runner.read_bytes()).hexdigest())
assert report['runnerIntegrity']['unchanged']
provenance=out/'provenance-final';provenance.mkdir(exist_ok=False)
manifest=[]
for path in sorted(pathlib.Path('/private/tmp').glob('weavly-review-*')):
    if path.is_file() and path.suffix in ['.py','.mjs','.cjs']:
        target=provenance/path.name;shutil.copy2(path,target)
        manifest.append(dict(source=str(path),copy=str(target),sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
(provenance/'manifest.json').write_text(json.dumps(manifest,indent=2))
report['provenance']='provenance-final/manifest.json'
(out/'report.json').write_text(json.dumps(report,indent=2))
ledger=root/'docs/guided-tours/EXECUTION_STATUS.md'
current=ledger.read_text();marker='### Independent review closeout — integrated GT-03..GT-15 — 2026-09-30'
assert marker not in current
lines=current.splitlines()
for index,line in enumerate(lines):
    cells=line.split('|')
    if len(cells)==8 and cells[2].strip().startswith('GT-06 '):
        cells[5]=' 2026-09-30 ';cells[6]=' Independent 22-run matrix complete; human gates UNVERIFIED below '
        lines[index]='|'.join(cells)
current='\n'.join(lines)+'\n'
finding_ids=', '.join(f['id']+' ('+f['owner']+', '+f['severity']+')' for f in report['findings']) or 'none'
current=re.sub(r'^\*\*Exact next action:\*\*.*$',f'**Exact next action:** Independent review through integrated GT-15 is complete. Address recorded findings under separate implementation authorization: {finding_ids}. G1 reviewer verdict is PASS WITH CONDITIONS; required human/live evidence remains UNVERIFIED. No new implementation wave or GT-16/GT-17 work is authorized by this review.',current,count=1,flags=re.M)
total_runs=sum(x['runs'] for x in completed);total_steps=sum(x['steps'] for x in completed)
entry=f'\n\n{marker}\n\n- **Integrated independent-review verdict: {report["integratedReviewVerdict"]}**; findings: {finding_ids}. G1 remains **PASS WITH CONDITIONS**, a reviewer verdict only. No acceptance gate or prerequisite is self-passed.\n- Completed main matrix: **{total_runs} runs / {total_steps} captured steps**, plus separately recorded supplemental, retry, paint, transition and keyboard probes. Original failures, blocked baseline analytics and transition observations are preserved and adjudicated in `scratch/browser-verification/report.md` and task JSON artifacts.\n- Own checks: tsc PASS; lint PASS/zero warnings; full Vitest 236 files/1,995 tests/one existing live-only skip; tour subset 52 files/661 tests PASS. Exact source copy audit: 849 matches, zero mismatches/unmatched; native endorsement is not claimed.\n- Required English desktop/Gujarati phone step captures inspected for every completed modeled variant. Human owner QA, native-language review, screen reader, real device, authenticated shell, live preference metadata, and fixture-unsupported states remain **UNVERIFIED**. PI-04 stays separately tracked under the approved deferral; U-06 copy/navigation are unchanged.\n- No application fix, business-data mutation, live/QA/production access, new wave, build/dev, commit or push. GT-16/GT-17 remain NOT_STARTED; GT-B1 remains BLOCKED by PI-06/PI-07. Executed runner byte identity is recorded; final application/HEAD/branch and allowed-ledger-only integrity proof is generated after this entry (`source-integrity.json`).\n- All reviewer helpers preserved with hashes under `scratch/browser-verification/provenance-final/manifest.json`. Evidence copies and invalid probe results remain available.\n'
ledger.write_text(current+entry)
print(json.dumps(dict(verdict=report['integratedReviewVerdict'],runs=total_runs,steps=total_steps,findings=finding_ids,provenanceFiles=len(manifest))))
