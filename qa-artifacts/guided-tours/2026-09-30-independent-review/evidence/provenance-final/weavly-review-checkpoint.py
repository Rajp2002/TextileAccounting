import pathlib,json,hashlib
r=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
o=r/'scratch/browser-verification'
source=json.loads((o/'source-start.json').read_text())
code={f:h for f,h in source['files'].items() if f.startswith(('app/','components/','hooks/','lib/','__tests__/')) or f in ('package.json','package-lock.json','tsconfig.json','vitest.config.ts')}
fp=hashlib.sha256(json.dumps(code,sort_keys=True).encode()).hexdigest()
report=json.loads((o/'report.json').read_text());report['source']['applicationFingerprint']=fp
report['commands']=json.loads((o/'commands/results.json').read_text())
report['visualReviewed']=['foundation-en-1440x900:01-06','foundation-gu-390x844:01-06','g1-0-en-1440x900:01-07']
report['humanGates']={'ownerQA':'UNVERIFIED','nativeGujaratiHindi':'UNVERIFIED','screenReader':'UNVERIFIED','realDevices':'UNVERIFIED'}
(o/'report.json').write_text(json.dumps(report,indent=2))
p=r/'docs/guided-tours/EXECUTION_STATUS.md';text=p.read_text()
text=text.replace('| 5 | GT-04 Gate G1 | NOT_STARTED | — | — | — |','| 5 | GT-04 Gate G1 | IN_PROGRESS | c020b9b0 + integrated Waves 1–4 | 2026-09-30 | Independent browser/review checkpoint below |')
old='**Exact next action:** Collect fresh resumed GT-10 and ongoing GT-13 final evidence; integrate approved completed patches and run combined checks. Browser/native/reviewer/owner acceptance remains UNVERIFIED.'
new='**Exact next action:** Independent verification is running against the existing tours/implementation checkout: finish foundation/reference G1 browser/review evidence, then GT-05–GT-15 in queue order. Waves 1–4 are integrated; the combined implementation checks already passed. Owner QA, native-language and real-device/screen-reader evidence remain UNVERIFIED; GT-16/GT-17 have not started.'
text=text.replace(old,new)
old='Wave 4: GT-10’s missing-copy decision is resolved by explicit owner approval and Payroll §F.1. GT-10 resumes in its existing worker; GT-13 continues independently. The historical blocked artifacts below are preserved. No current implementation decision is pending.'
new='Current (2026-09-30): Waves 1–4, including GT-10 and GT-13, are integrated and automated checks pass. Independent synthetic-browser verification is underway. No implementation decision is pending. G1 owner QA/native evidence is outstanding; PI-04 is an accepted GT-12 implementation deferral; GT-B1 remains blocked by PI-06/PI-07. Historical Wave entries below are preserved.'
text=text.replace(old,new)
text+='''
### Independent browser/review verification — IN_PROGRESS — 2026-09-30
- Authority: separate browser/review assignment; browser deferral lifted. Review-only: application/test/dependency code is untouched. No new implementation wave, commit, push, PR, deployment, production/QA login or business action.
- Checkout verified: `/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas`, `tours/implementation` @ `c020b9b0548a4c9f0c2c0105afe3506d821bc7ce`, with all inherited uncommitted changes preserved. Initial status, every tracked/untracked file hash, complete baseline diff (2275e920), and inherited untracked source are preserved. Application fingerprint: `'''+fp+'''`.
- Fresh artifacts: `scratch/browser-verification/` (machine-readable report/checkpoints, commands, matrices, traffic, screenshots, contact sheets) and `scratch/browser-verification-harness/` (fresh harness copy). Old baseline/failure evidence is untouched. Original source copies were relocated to `/private/tmp/weavly-browser-verification-inherited-20260930` after they contaminated the subset's filename-filter discovery; relocation manifest and failed log are preserved. No test/assertion/config was weakened.
- Independent sequential isolated checks: typecheck PASS; zero-warning lint PASS; full Vitest PASS, 236 files / 1995 tests / 1 existing live-only skip; corrected tour subset PASS, 52 files / 661 tests. Initial subset run: 52 actual files passed, 2 copied scratch files failed import; INVALID as application evidence, preserved before relocation/retry.
- Safety: read wrapper and harness source; localhost Vite transforms for preference, Production, Estimator and Rate Book actions are recording stubs with no real auth/Supabase import. A guessed Dispatch actions path returned harness HTML and is not counted as isolation proof. The actual Dispatch module is `challan-actions.ts`; it will be checked before its task. Browser instrumentation permits only localhost:5199, blocks external/non-costings API traffic, and preserves request/response logs. No blocked traffic in the completed foundation/reference runs so far.
- Owned server: Vite session 91675, PID 48739, localhost:5199, isolated synthetic harness only. Stop only this owned server at closeout. Check runner session 8821 and subset recovery session 78039 are complete; G1 matrix session 73640 is running sequentially under the existing macOS timeout helper.
- Completed visual inspection: all six foundation steps at English 1440×900 and Gujarati 390×844; all seven Base Saved Costings English 1440×900 steps. No visible panel/outline/dialog or rail paint issue in those reviewed images. Numeric passes are not treated as completion of unreviewed screenshots.
- Checkpoint and next command: continue `g1` matrix, inspect remaining required screenshots, then run the prepared `g1-supplemental` recovery/motion/invitation/lifecycle/variants probes. Source review and GT-05/GT-06 matrices are being prepared; no later task is accepted. Human evidence remains UNVERIFIED; GT-03 stays REVIEW_REQUIRED, GT-04 IN_PROGRESS, GT-05–GT-15 IN_PROGRESS, GT-16/GT-17 NOT_STARTED and GT-B1 BLOCKED until evidence warrants a change.
'''
p.write_text(text)
print(json.dumps({'fingerprint':fp,'checkpoint':str(o/'report.json'),'ledger':str(p)}))
