import pathlib,json
r=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas');o=r/'scratch/browser-verification'
report=json.loads((o/'report.json').read_text())
for group in ['gt05','gt06']:
 for row in json.loads((o/f'{group}-results.json').read_text()):
  if (row.get('language'),row.get('size')) in [('en','1440x900'),('gu','390x844')]:
   item=row['id']+':all'
   if item not in report['visualReviewed']:report['visualReviewed'].append(item)
report['visualReviewed'].append('G1 supplemental invitation, lifecycle, populated/error/embedded screenshots: all 14 derived contact sheets inspected')
report['g1ReviewerVerdict']='PASS WITH CONDITIONS; owner/native/accessibility/device evidence remains UNVERIFIED; GT-04 stays IN_PROGRESS'
report['keyboard']={'final':'g1-keyboard-final/record.json','result':'4/4 scenarios passed; 21 steps','invalidProbes':['g1-keyboard/record.json: reviewer incorrectly required Next focus on launch; §5.4 requires panel','g1-keyboard-spec-aligned/record.json: empty navigation telemetry was undefined']}
report['copyAudit']={'file':next(o.glob('copy-alias-resolved-*.json')).name,'matched':849,'mismatches':0,'unmatched':0,'nativeReview':'UNVERIFIED'}
(o/'report.json').write_text(json.dumps(report,indent=2))
g1='''VERDICT: PASS WITH CONDITIONS
Scope: G1 — GT-01, GT-02, GT-03, independently assessed against GT-00 revision 2275e920 and current integrated checkout c020b9b0548a4c9f0c2c0105afe3506d821bc7ce.

Reviewer checks: isolated tsc PASS; lint PASS (zero warnings); full Vitest PASS (236 files, 1,995 tests, one existing live-only skip); tour subset PASS (52 files, 661 tests). The first subset run discovered preserved duplicate evidence copies and failed to import them; raw failure retained and copies relocated outside test discovery. Assertions and timeouts were unchanged.

Reviewer harness: foundation plus Saved Costings Base/Lite/Free/Compare at en1440×900, hi1280×800, en1024×768, gu390×844 and reduced-motion en1024×768: 25 runs / 135 steps, UI and network assertions passed. Every English desktop and Gujarati phone step was visually inspected. Supplemental runtime recovery, motion, invitation persistence/reload/replay, retained filters, populated/error/embedded variants were checked. Six invitation scenarios passed their own assertions; their raw guard result remains FAIL for ten intercepted pre-launch/reload estimator_opened analytics requests from the unmodified page mount effect. They are not accepted as network-clean runs.

Keyboard-only Base/Lite/Free/Compare: 4/4 scenarios, 21 steps PASS, including genuine Tab to launcher, Enter, repeated Tab/Shift+Tab containment, More detail, Back, Next/Done retained focus, handoff focus, replay and Escape. Two earlier custom-probe failures remain preserved: an incorrect reviewer expectation of Next focus on launch (spec §5.4 explicitly requires the panel container), then undefined empty harness navigation telemetry. Neither is an application finding.

Findings in G1 scope: no reproduced Blocker or Major. Panel anatomy, live-region wiring, context/outline separation, exact three-language spec copy, control token keys, sample guards, lazy runtime loading, preference versioning and local cleanup were compared with source. Current synthetic behavior does not prove live server persistence or real shell behavior.

Not verified: owner QA; native Gujarati/Hindi review; screen reader; real phones/tablets; authenticated shell and live account metadata persistence (prohibited in this session). Source audit and screenshot inspection do not substitute for those checks. G1 task GT-04 remains IN_PROGRESS. This verdict does not authorize a new implementation wave or pass a human gate.

Conditions: obtain the owner's required QA and native review evidence, plus accessibility/device evidence before claiming those checks. Preserve all unverified items and address any resulting findings. Later independent task verification may continue only under the user's express authorization.

Evidence: commands/results.json, g1-results.json, g1-supplemental-results.json, g1-keyboard-final/record.json and network log, copy-alias-resolved-*.json, G1 contact manifests and supplemental-manifest.json. No application code was edited by this reviewer.
'''
(o/'g1-review.md').write_text(g1)
ledger=r/'docs/guided-tours/EXECUTION_STATUS.md'
entry='''

### Independent reviewer checkpoint — G1 evidence complete; GT-05 defect; GT-06 matrix complete — 2026-09-30

- G1 independent reviewer verdict: **PASS WITH CONDITIONS** (`scratch/browser-verification/g1-review.md`). This is a reviewer verdict only: GT-04 remains **IN_PROGRESS**, with owner QA/native review/screen reader/real device evidence **UNVERIFIED**. No human approval is inferred. Own checks passed: tsc; lint zero warnings; full 236 files/1,995 tests/one live-only skip; tour subset 52 files/661 tests. G1 matrix 25 runs/135 steps passed; all required English desktop/Gujarati phone step screenshots inspected, plus the supplemental states.
- Keyboard-only final probe: Base/Lite/Free/Compare **4/4 PASS**, 21 steps, genuine Tab traversal, More detail, Back, Next/Done focus, replay, Escape and inert cleanup. Original failed reviewer probes are preserved and explained in `g1-review.md`: incorrect launch-focus expectation, then undefined empty navigation telemetry. Application source and mandatory tests/assertions/timeouts were unchanged.
- GT-05: all **17 runs** retained. Three Gujarati phone variants (Base/Lite/Free) independently fail Save step 9 as recorded in **BV-01 Major**; GT-05 stays **FAILED**. Other UI assertions passed, including Detailed view Done/Exit at step 8. All English desktop/Gujarati phone step screenshots inspected for all three plans. No fix applied. Existing-costing / already-open-sheet / live factory configuration states are still UNVERIFIED where the synthetic fixture does not model them.
- GT-06: **22 runs**, all exited 0 with empty UI issue lists: empty/populated standard+reduced matrices; retained nonmatching search with Exit/Done; deleted-demo and archived-only recovery at four standard viewports. Missing rows correctly show the approved unavailable text at update/review/usage, allow continuation, and focus Add Yarn Rate on Done. All English desktop/Gujarati phone screenshots for the five variants inspected. Raw matrix guard classification stays **FAIL** for intercepted baseline `rate_book_viewed` POST on mount; `getCostRateUsage` occurs before launch and is stubbed. No business-action increments or navigation during tours. GT-06 remains **IN_PROGRESS**, not PASSED: upstream GT-05 is FAILED and human/live checks are not fulfilled.
- Exact source-copy audit: **849 matches, zero mismatches, zero unmatched** across the 12 page specs (en/gu/hi title/body/detail/benefit/unavailable rows, explicit key aliases preserved in artifact). Native-language review remains pending.
- Interruption resume confirmed the owned Vite PID 48739, no matrix/browser probe was left running, and no Dispatch run had started. Dispatch action-stub isolation proof is `isolation/dispatch-challan-actual-transformed.txt` (`__serverCalls` stub true, actual Supabase import absent); the earlier root-relative URL returned harness HTML and is explicitly not proof.
- Current phase: independently verify already integrated **GT-07 Dispatch**, then GT-08..GT-15 in queue order. No new wave/GT-16/GT-17 work, no application fix, no live data, no commit/push/build/dev. Exact current command: `node scripts/performance/isolated-command.mjs python3 /private/tmp/weavly-review-matrix.py gt07` in the tours implementation checkout. Raw evidence remains under `scratch/browser-verification/` and `scratch/browser-verification-harness/`.
'''
ledger.write_text(ledger.read_text()+entry)
print(json.dumps({'g1':'PASS WITH CONDITIONS','gt05':'FAILED','gt06':'IN_PROGRESS','next':'GT-07'}))
