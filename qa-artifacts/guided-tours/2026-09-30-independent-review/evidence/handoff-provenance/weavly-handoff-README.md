# Guided tours: reviewed implementation and fix handoff

The `tours/implementation` branch preserves the integrated GT-03 through GT-15 working-tree snapshot that was independently reviewed on 2026-09-30. The review was performed above `c020b9b0548a4c9f0c2c0105afe3506d821bc7ce`; the handoff commit additionally commits that previously uncommitted snapshot. No finding was fixed during review or handoff packaging.

**Integrated review verdict: FAIL.** G1's separate reviewer verdict is PASS WITH CONDITIONS. GT-05 and GT-15 are FAILED; other pending prerequisites and human acceptance are not promoted. GT-16/GT-17 remain NOT_STARTED, GT-B1 stays BLOCKED by PI-06/PI-07, and the approved PI-04 Daily Sheet deferral/U-06 copy remain unchanged.

| Finding | Required fix and reproduction |
| --- | --- |
| BV-01, Major, GT-05 | Gujarati 390×844 Save step `est-save` is unavailable, without an on-screen outline, in Base/Lite/Free Estimator. Start and advance through step 9. Resolve the required Save target and reverify all Estimator variants. |
| BV-02, Major, GT-15 / MA-1 | `ma-purpose` overlaps the board at English 1024×768 and Hindi 1280×800. Seven original cases and one unchanged retry reproduce it. `lib/configuration-tour.ts:52` retains the board selector; page spec §E requires the conditional `assignments.columns` fallback when overlap remains at 1024. No alternative anchor was implemented or tested by the reviewer. |

Read the [execution ledger](../../../docs/guided-tours/EXECUTION_STATUS.md), [review report](evidence/report.md), [BV-02 record](evidence/gt15-finding-bv02.json), and the owning [GT-05](../../../docs/guided-tours/tasks/GT-05-cost-estimator.md) / [GT-15](../../../docs/guided-tours/tasks/GT-15-machine-assignments.md) packets before fixing. Follow their approved copy, protected behavior, and escalation rules.

The matrix contains 194 original attempts / 1,318 captured steps, plus separate retries, diagnostics and keyboard evidence. Typecheck, lint, full Vitest (236 files / 1,995 tests / one existing live-only skip), and the 52-file / 661-test tour subset passed. Application fingerprint at review closeout was `a70241eef16e00357e5bb1be433f3e991f9a02777ba08e535c4ce2a091189167`; the application files in this handoff match it.

All non-image review records, command logs, guarded network logs, reports, job definitions, original failed probes and helper provenance are preserved under `evidence/`. Selected original screenshots include both findings and the paint/transition adjudications. The [bundle manifest](manifest.json) lists copied files and hashes, as well as omitted image hashes. Complete local originals remain in `scratch/browser-verification/`; they are not required to reproduce either finding. Archived absolute paths refer to the original review checkout: resolve their suffix after `scratch/browser-verification/` against this bundle's `evidence/` directory. Harness supplemental records are under `evidence/harness-supplemental/`.

Integrity artifacts describe the end of the review, before this packaging/commit. Their old HEAD and ledger hash are historical evidence. The original manifest-schema comparison failure is preserved alongside the corrected proof; eleven files were already deleted in the starting snapshot. The original fixture heap-exhaustion incident and both connection-refused cases are retained. Identical retries recovered the missing 14 steps. Never replace those original failures with retry results.

Baseline mount analytics (`estimator_opened`, `rate_book_viewed`, `production_viewed`) are intercepted and retained as raw failures. Payroll/Production transparent-rail rect flags were separately adjudicated as paint false positives. Immediate Back/Next screenshots can capture unfinished animation; later 500 ms / 2 s diagnostic frames are separate evidence. Do not suppress assertions, erase failures or infer live acceptance from fixture results. Owner QA, native Gujarati/Hindi, screen reader, real devices, authenticated shell, live preference persistence and unsupported fixture states remain UNVERIFIED.

## Reproduce in an isolated scratch harness

Use existing dependencies and an existing external Playwright/Chromium installation; do not change package dependencies. Run from the repository root. These commands do not run the production-configured app build/dev or access a live database. Every server module is stubbed and the supplied browser guard permits only the local fixture at port 5199.

Prepare a new copy (fails if the destination exists):

```bash
node scripts/performance/isolated-command.mjs node qa-artifacts/guided-tours/2026-09-30-independent-review/reproduce.mjs prepare
```

Start the owned fixture in one terminal:

```bash
node scripts/performance/isolated-command.mjs node node_modules/vite/bin/vite.js --config scratch/tour-fix-review/vite.config.mjs --host 127.0.0.1
```

In another terminal, supply browser installation paths through `env` after the wrapper:

```bash
node scripts/performance/isolated-command.mjs env PLAYWRIGHT_ROOT="/path/to/playwright/node_modules/" CHROMIUM_PATH="/path/to/chromium" node qa-artifacts/guided-tours/2026-09-30-independent-review/reproduce.mjs BV-01
node scripts/performance/isolated-command.mjs env PLAYWRIGHT_ROOT="/path/to/playwright/node_modules/" CHROMIUM_PATH="/path/to/chromium" node qa-artifacts/guided-tours/2026-09-30-independent-review/reproduce.mjs BV-02
```

Optionally append an original run ID, such as `gt15-0-en-1024x768`, to run one archived case. The helper uses the unchanged tracked runner and a 170-second process bound, saves new evidence in a unique scratch folder, retains raw exit codes/API guard failures, and does not adjudicate or promote the task. Inspect all new screenshots and records. Keep live/QA/production access outside this synthetic reproduction workflow; stop only the fixture process you started.
