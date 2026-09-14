# Cleanup report — 14 September 2026

Completed six verified, reversible batches: five unreachable private helpers/callbacks and 65 unused import bindings removed across 17 source files (net 71 lines). Final full regression tests (1,946 passed, one live skip), configured types, fresh production build and local public smoke checks passed. Lint retains the same three pre-existing errors; warnings fell from 155 to 85. B05 was fully reverted after a source-contract test failed; its independently verified sibling imports were later removed under B07, while CostEstimateTutorial and every test remain unchanged. Your four starting user files are preserved. See [final-pass.md](./final-pass.md) for the latest candidate decisions, exact command ledger, evidence and limits; [continuation.md](./continuation.md) records B03. The B01/B02 ledgers below are historical. See [publication.md](./publication.md) for the subsequently authorized commit/push/merge scope and validation of the exact commit candidate.

## Starting point and scope

Branch `main`, HEAD `77a511b66ba1c2c557e2cc2c656bbadf323a379f`. No staged changes. Pre-existing user work consists of modified `package.json` and untracked `__tests__/build-type-cache.test.ts`, `scripts/reset-build-type-cache.mjs`, and `docs/deployment-typescript-cache-incident.md`. Validation includes these files; cleanup does not edit them. No commits, dependency changes, configuration changes, service operations or deployments.

The repository has one npm application. No AGENTS.md/contributor file was found. Existing engineering, product, security and design guidance was inspected; current code/tests govern where old documents differ. Local validation uses the installed lockfile versions, not newly downloaded tools.

## Deletion manifest

| Batch | Production source | Removal and evidence | Tests/documentation |
| --- | --- | --- | --- |
| B01 | `app/(dashboard)/owner/production/BaseProductionClient.tsx` | Delete private `getStatusVariant`, `getNextStatus`, `getStatusActionLabel` (20 lines). Compiler, lint, exhaustive symbol searches over captured nonsecret text files, import/export graph and commit `727ba5d2` establish removal of all former callers. Pure literal-return helpers; no module effects, public exports, live handlers or hooks changed. AST comparison verifies every retained statement and complete component body are identical. | No tests removed or weakened. Existing production/payroll/assignment and full regression suite retained. Audit, report and reversible patch added. |
| B02 | `lib/estimator-yarn-suggestions.ts` | Remove unused `type WarpRow` and `type WeftRow` import bindings. `getEffectiveYarnDenier` runtime import and all exported types remain. Compiler/lint/module inspection agree; emitted JavaScript is byte-identical. | No test changes; existing yarn suggestion tests pass (11 tests). Second reversible patch added. |
| B03 | `app/(dashboard)/owner/production/BaseProductionClient.tsx` | Delete unused `openNewJob` and `openRecord`, plus `ClipboardList`, `IndianRupee`, `RotateCcw`, `calculateBaseJobSummary` and type-only `BasePayrollPeriod` import bindings (20 more lines). No retained hook, calculation, JSX, action or imported module changed. | 40 focused tests and the full suite passed; no test changes. See `continuation.md` and `patches/B03.patch`. |
| B04 | Production/Active Qualities/Machine Board/settlement and payroll settings panels | Remove 36 unused imports; AST and installed Next browser/SSR output identical. | Full suite + 64 focused tests, types, clean build, CSS/routes/actions unchanged. No test changes. |
| B06 | Eight `components/onboarding/base` components | Remove 17 unused imports; hook invocations, props, effects and all component bodies unchanged. | Full suite + 31 focused tests, types, clean build and identical compiler/CSS/runtime inventories. |
| B07 | SavedCostingsTutorial, RateBookTutorial, RatesClient | Remove five unused icon bindings after separately ruling out B05's textual test consumer. | Full suite + 38 focused tests including previously failing test, types/build and runtime inventories pass. |

**Reverted:** B05 originally attempted seven icon bindings in four views; `estimator-left-rail.test.ts` still requires two names in CostEstimateTutorial. Entire batch was reversed; no assertion changed. Five independent bindings were separately requalified under B07. B05.patch is evidence only.

The complete candidate inventory is in `audit.md` and `final-pass.md`, including exact paths and required follow-up evidence. No public page/API, server action, dependency, schema, migration, generated client, translation, asset, stylesheet or recovery path is removed.

## Original B01/B02 verification environment and command ledger

All commands below run through the existing `node scripts/performance/isolated-command.mjs` wrapper. It clears service credentials and uses synthetic, non-serving loopback Supabase configuration, with live integration opt-in and telemetry disabled. No environment file is present in a validation copy. The shared `node_modules` symlink uses already installed packages. Builds start in separate copies with no `.next` output, and write generated public workers only inside those copies. No root build cache or ignored user file is deleted.

Working directories:

- B: `/tmp/weavly-cleanup-20260914-6jfkbodn/baseline`
- I: `/tmp/weavly-cleanup-20260914-6jfkbodn/batch01`
- F: `/tmp/weavly-cleanup-20260914-6jfkbodn/final`

| Check / exact command (following wrapper) | Baseline B | B01 I | Final F | Kind / limits |
| --- | --- | --- | --- | --- |
| `npm test -- --maxWorkers=2` | PASS: 267 files, 1,946 passed, one skipped | PASS: same counts | PASS: same counts | Units, mocks, source/SQL assertions and isolated temporary-file shell tests. The skipped live Supabase test is not integration proof. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS | PASS | PASS | Configured complete TS include graph, including tests/scripts and generated Next types. No type rules changed. |
| `npm run lint -- --format json --output-file ../baseline-lint.json` (I uses `../B01-lint.json`; F uses `../final-lint.json`) | FAIL: 3 errors, 155 warnings | FAIL: same 3 errors, 152 warnings | FAIL: same 3 errors, 150 warnings | Compare diagnostic rule/file/severity/message, allowing shifted line numbers. B01 removes only its three unused-function warnings. |
| `npm run build --ignore-scripts` | PASS: 64 static pages generated | PASS: 64 static pages generated | PASS: 64 static pages generated | Runs the actual user-modified build script. Prebuild tests run separately above; no gate disabled in repository. Sentry uploads disabled; Google Fonts fetched read-only. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false --noUnusedLocals --noUnusedParameters` | FAIL: 169 discovery diagnostics | NOT RUN separately | FAIL: 164; exactly five expected removals | Optional stricter discovery, not the configured type gate. No compiler configuration changes. |
| `npm test -- __tests__/estimator-yarn-ratebook-dropdown.test.ts --maxWorkers=2` | PASS: 11 tests | NOT RUN separately | PASS: 11 tests | Yarn parsing, rate-book preference, saved-quality fallback, search/category ranking and limit behavior. |

The initial exploratory invocation `node node_modules/vitest/vitest.mjs run __tests__/estimator-yarn-suggestions.test.ts --maxWorkers=2` in B failed because that guessed filename does not exist (no tests ran). The actual consumer was found by reference search and the corrected command above passed. This was a command-selection error, not a source failure.

All three full-suite runs emitted the same expected mocked session-recovery/inactivity warning events; elapsed idle times vary with the clock. No new warning event appeared. Existing lint errors are `react-hooks/preserve-manual-memoization` in `components/estimator/FreeUsageCard.tsx:50`, and `react-hooks/set-state-in-effect` in `components/navigation/navigation-disclosure.tsx:30` and `hooks/use-gutter-dock.ts:120`. They remain separate work; no suppressions or behavioral fixes are added.

Additional local checks: `node /tmp/weavly-cleanup-20260914-6jfkbodn/verify-type-imports.cjs` from repository root PASS (identical emitted JS); source file list, imports, exports, dynamic imports and orphan inventory are unchanged. `node ../inventory.cjs` from B and F generated those inventories (an initial wrong-working-directory retry failed and was corrected; its empty output was removed). Both reverse patches were actually applied to disposable file copies and restored their starting SHA-256 hashes. Other checks: `node /tmp/weavly-cleanup-20260914-6jfkbodn/verify-private-removal.cjs` from repository root PASS at the B01 batch boundary; `git diff --check` PASS; `git apply --reverse --check docs/maintenance/cleanup-2026-09-14/patches/B01.patch` PASS. Generated `app-paths-manifest.json` and `routes-manifest.json` compare equal between B and I. Final generated route manifests compare equal to baseline; final imports/exports/dynamic-import/source-file inventories are unchanged. No tracked generated or public asset file changed. Fresh build chunk hashes and Sentry debug identifiers vary; binary identity of entire build output is not claimed. Only the expected private declarations and type import bindings disappear. All three reverse-check commands pass.

## Original B01/B02 browser and HTTP smoke checks

Baseline built server command, from B: `node scripts/performance/isolated-command.mjs node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4320`. Only loopback is bound. Final server command is identical from F with `--port 4321`. HTTP checks use `python3 /tmp/weavly-cleanup-20260914-6jfkbodn/http-smoke.py 4320 baseline` and the same command with `4321 final` from the repository root. Browser scenarios use the in-app browser against those loopback URLs.

| Scenario | Baseline | Final | Evidence and limits |
| --- | --- | --- | --- |
| Login page `/login` | PASS | PASS | HTTP 200, rendered login form; 1280 × 720 English desktop screenshots are byte-identical baseline/final (compared in browser runtime; no screenshots added to the repository). No credentials entered or login submitted. |
| Switch English → Hindi → Gujarati; reload; Tab focus | PASS | PASS | Translated heading/fields, retained Gujarati after reload, focus moves to language control. This is limited public-page localization/keyboard coverage. |
| `/owner/production`, `/owner/payroll`, `/owner/assignments`, `/free` without session | PASS | PASS | HTTP 307 to `/login`; browser also confirms production deep-link redirect. |
| `/api/free/status` without session | PASS | PASS | HTTP 401 JSON response. No authenticated or cross-tenant data queried. |
| `/offline` | PASS | PASS | HTTP 200, offline explanation and sign-in/retry links render. This is not an offline network/service-worker recovery test. |
| Browser console on built public pages | PASS | PASS | Captured error/warning list empty. Dedicated network request trace not available through this check. |
| Existing `scripts/qa/base-fixed-salary-preview.mjs` | BLOCKED | BLOCKED (not rerun) | Launched through isolated wrapper at port 4319; blank browser, Vite cannot resolve `server-only` from server modules. The fixture no longer fully isolates its import graph. Same unmodified failing imports remain in final; no harness or dependency fix attempted. This fixture was started with `node scripts/performance/isolated-command.mjs node scripts/qa/base-fixed-salary-preview.mjs` from B. Server stopped. |
| 390 × 844 mobile screenshot | BLOCKED | NOT RUN | Browser could not capture the requested viewport; override reset. No mobile visual equivalence claimed. |
| Authenticated workflows, DB/RLS integration, real payments/messages, service-worker network recovery | NOT RUN | NOT RUN | No verified disposable authenticated service environment. User explicitly prohibited production operations. Local stock test creates cluster roles and replays migrations, so it was not invoked against an unverified cluster. |

No new tests are added: the edits do not alter called implementations. Existing observable-behavior tests plus statement/emission comparisons cover these removals more directly than tests asserting private code absence. No line/branch coverage run or percentage is claimed; no coverage tooling was installed.

## Behavior/security assessment and remaining gaps

- Costing, Quick/Detailed parity, precision/rounding, invalid inputs and historical immutability: existing `lite-quick-detailed-parity`, `sprint0-costing-truth`, snapshot/readiness/export and Rate Book tests run unchanged. No formulas or historical readers edited.
- Free/Lite/Base, paid activation and legacy trial/premium: capability and policy tests run unchanged. Current Free policy is monthly with India-time boundaries and frozen allowance rows; saving/export support is taken from code, not older proposals. Billing, onboarding and entitlement code remain intact.
- Production, assignments, workers, payroll, stock and dispatches: existing core, continuity, cycle, stock, challan and boundary tests run. Many RPC/security/UI assertions inspect source text or mocks; actual database transactions and authenticated rendered flows are not verified here. All live implementations and persisted formats remain unchanged.
- Auth/tenancy: anonymous protected-page/API rejection was exercised; authenticated session reload/logout and cross-tenant DB rejection were not. No auth or security implementation changed.
- Locales, navigation, exports and recovery: existing unit/source tests plus limited public browser checks; no full mobile, installed-PWA, export-download or authenticated locale walkthrough. Translation dictionaries, snapshot/export models, public routes and generated contracts remain.

These checks support the narrow removals. They do not guarantee zero regressions or establish that all unused code has been found.

## Working tree and rollback

Only the 17 source files listed in the manifest and the new maintenance folder belong to this task. `package.json`, `__tests__/build-type-cache.test.ts`, `scripts/reset-build-type-cache.mjs` and `docs/deployment-typescript-cache-incident.md` retain their original bytes. Branch/HEAD and empty staged diff are unchanged. No commit, dependency/configuration or production operation occurred. New local evidence is at `/var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl`; earlier snapshots remain at the paths above.

To undo all retained cleanup from repository root, reverse B07, B06, B04, B03, B02, B01, checking each patch first. **Skip B05; it is already reversed.** This exact sequence restored all 17 original source hashes in a disposable proof directory.

```sh
git apply --reverse --check docs/maintenance/cleanup-2026-09-14/patches/B07.patch
git apply --reverse docs/maintenance/cleanup-2026-09-14/patches/B07.patch
git apply --reverse --check docs/maintenance/cleanup-2026-09-14/patches/B06.patch
git apply --reverse docs/maintenance/cleanup-2026-09-14/patches/B06.patch
git apply --reverse --check docs/maintenance/cleanup-2026-09-14/patches/B04.patch
git apply --reverse docs/maintenance/cleanup-2026-09-14/patches/B04.patch
git apply --reverse --check docs/maintenance/cleanup-2026-09-14/patches/B03.patch
git apply --reverse docs/maintenance/cleanup-2026-09-14/patches/B03.patch
git apply --reverse --check docs/maintenance/cleanup-2026-09-14/patches/B02.patch
git apply --reverse docs/maintenance/cleanup-2026-09-14/patches/B02.patch
git apply --reverse --check docs/maintenance/cleanup-2026-09-14/patches/B01.patch
git apply --reverse docs/maintenance/cleanup-2026-09-14/patches/B01.patch
```

If a check fails after later edits, reconcile only that hunk; do not reset/restore the whole file, stash, or clean the tree. The patches exclude all user work. Keep the maintenance folder as evidence. Its task-owned files are `audit.md`, `report.md`, `continuation.md`, `final-pass.md`, `publication.md`, `manifest.json`, and `patches/B01.patch` through `patches/B07.patch`; remove only those individual files if documentation rollback is wanted. All temporary servers and agent-created browser tabs were closed. No new mobile verification or authenticated integration is claimed. Final application source matches the verified F7 copy; closeout edits affect only these engineering records.

## Separate follow-ups

Audit IDs C05–C15 and the final-pass residual ledger cover remaining production remnants, orphan components/hooks, compatibility/recovery code and unused declarations. C26 keeps CostEstimateTutorial's two icon imports pending a supported-UI/source-test contract review. The selected C15 import subset was completed under B04/B06/B07. Their reachability, effects or supported contracts need stronger evidence; no broad pruning is proposed here. QR-code dependencies need a separately approved dependency/peer/deployment audit; typography is demonstrably used by CSS. Repair/QA scripts, archived public routes, future/legacy tiers and schema/migration history are retained. Existing lint errors and the stale browser fixture are separate issues, not cleanup fixes.
