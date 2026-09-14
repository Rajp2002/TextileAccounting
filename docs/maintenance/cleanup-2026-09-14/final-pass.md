# Final candidate pass — B04–B07

Status: complete. B04, B06 and B07 are verified and retained. B05 was reversed after an existing source-contract test failed; its CostEstimateTutorial imports remain. The independent sibling imports were separately requalified under B07. This pass retains 58 unused-import removals across 15 files; cumulative cleanup retains six batches, five private helpers/callbacks and 65 unused import bindings across 17 files (net 71 lines).

## Starting state and baseline

Branch `main`, HEAD `77a511b66ba1c2c557e2cc2c656bbadf323a379f`; staging is empty. B01–B03 are earlier task edits. All four original user files are byte-identical to their initial manifest. A snapshot of 2,057 tracked/relevant untracked files, status, hashes and staged/unstaged patches is at `/var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl`. No environment files were copied. Every non-maintenance file matches the already tested B03 final copy, so its actual full-suite/type/lint/build results are reused as the starting baseline: 1,946 passed, one live test skipped, types/build PASS, lint three errors and 143 warnings. This is source-byte verification, not reliance on HEAD.

## Removal evidence and batch inventory

These candidates are unused **local import bindings**, not implementations, exports, props or hooks. The baseline lint diagnostics and an independent TypeScript AST walk agree: each selected identifier occurs only in its import declaration. No eval/new-Function mechanism exists in these modules. The complete non-import AST text is unchanged in each proposed file. Static and literal dynamic imports, alias resolution, framework entry points, tests and tracked/untracked consumers were already inventoried; external consumers cannot address a private import binding. Exported source declarations, routes, server-action imports, public types, locale keys, CSS/JSX and all state/financial/validation expressions remain intact.

Before source mutation, the installed Next 16.2.12 native SWC compiler produced **byte-identical JavaScript** for both production browser and SSR targets for all 16 proposed files. The comparison uses identical filenames, no source maps, current tsconfig, Next loader options and the configured package-import optimization. It independently proves that even wholly unused import declarations were already omitted from executable output. They do not currently execute required module initialization. Fresh builds and generated CSS/runtime contracts were compared to catch pipeline effects beyond this compiler check. This is a bounded verification script kept outside the repository, not new tooling or a repository test.

| ID / batch | Exact file and removed bindings | Purpose and decision | Consumers, effects, checks and reversal |
| --- | --- | --- | --- |
| C22 / B04 | `app/(dashboard)/owner/production/BaseActiveQualities.tsx`: `Activity`, `ArrowRight`, `Check`, `Clock3`, `SlidersHorizontal`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle` | Unused production/payroll presentation imports; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B04.patch`. |
| C23 / B04 | `app/(dashboard)/owner/production/BaseMachineBoard.tsx`: `AlertCircle`, `ArrowRight`, `Clock3`, `Layers`, `RefreshCw`, `UserCheck`, `UserMinus`, `UserPlus`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle` | Unused production/payroll presentation imports; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B04.patch`. |
| C24 / B04 | `app/(dashboard)/owner/production/BasePayrollSettlementWorkspace.tsx`: `AlertCircle`, `Clock`, `DollarSign`, `Lock`, `RotateCcw`, `ShieldAlert`, `SlidersHorizontal`, `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle` | Unused production/payroll presentation imports; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B04.patch`. |
| C25 / B04 | `components/settings/payroll/PayrollCycleSettingsCard.tsx`: `ArrowRight`, `ShieldAlert`, `HelpCircle` | Unused production/payroll presentation imports; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B04.patch`. |
| C26 / B05 (reverted) | `components/estimator/CostEstimateTutorial.tsx`: `Compass`, `Sparkles` | REVIEW — unused runtime bindings with an existing source-test consumer; no removal retained. | `__tests__/estimator-left-rail.test.ts:39–40` requires these names. Full suite failed after removal; reverse B05 restored exact bytes and the three focused tests passed. Already reversed; do not reverse B05 again. Separate supported-UI/test-contract review required. |
| C27 / B07 | `components/estimator/SavedCostingsTutorial.tsx`: `Compass`, `Sparkles` | Unused costing/Rate Book presentation imports; REMOVE-SAFE — independently requalified and verified under B07. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B07.patch`. |
| C28 / B07 | `components/rates/RateBookTutorial.tsx`: `Compass`, `Sparkles` | Unused costing/Rate Book presentation imports; REMOVE-SAFE — independently requalified and verified under B07. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B07.patch`. |
| C29 / B07 | `app/(dashboard)/owner/rates/RatesClient.tsx`: `CircleDollarSign` | Unused costing/Rate Book presentation imports; REMOVE-SAFE — independently requalified and verified under B07. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B07.patch`. |
| C30 / B06 | `components/onboarding/base/BaseOnboardingWizard.tsx`: `useCallback` | Unused Base onboarding presentation imports and uncalled hook bindings; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B06.patch`. |
| C31 / B06 | `components/onboarding/base/BulkEntryGrid.tsx`: `useCallback`, `Plus`, `Undo2`, `Button` | Unused Base onboarding presentation imports and uncalled hook bindings; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B06.patch`. |
| C32 / B06 | `components/onboarding/base/OnboardingShell.tsx`: `Sparkles`, `cn` | Unused Base onboarding presentation imports and uncalled hook bindings; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B06.patch`. |
| C33 / B06 | `components/onboarding/base/Step2Defaults.tsx`: `HelpCircle`, `Layers` | Unused Base onboarding presentation imports and uncalled hook bindings; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B06.patch`. |
| C34 / B06 | `components/onboarding/base/Step3Machines.tsx`: `Sparkles` | Unused Base onboarding presentation imports and uncalled hook bindings; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B06.patch`. |
| C35 / B06 | `components/onboarding/base/Step4Workers.tsx`: `UserCheck`, `Sparkles` | Unused Base onboarding presentation imports and uncalled hook bindings; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B06.patch`. |
| C36 / B06 | `components/onboarding/base/Step5Payroll.tsx`: `Clock`, `AlertCircle`, `Sparkles` | Unused Base onboarding presentation imports and uncalled hook bindings; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B06.patch`. |
| C37 / B06 | `components/onboarding/base/Step6Review.tsx`: `CheckCircle2`, `cn` | Unused Base onboarding presentation imports and uncalled hook bindings; REMOVE-SAFE — verified and retained. | Only import declaration occurrences; compiler output identical in both targets. Full tests, type/lint, fresh build, CSS/routes/actions comparison. Reverse `patches/B06.patch`. |

B04 retained 36 bindings in four production/payroll panels. B05 attempted seven icon bindings and was reversed. B06 retained 17 bindings in eight Base onboarding components. B07 independently retained five of B05’s proposed bindings in three sibling views. Each retained batch was verified before the next was applied. No rendered icon, React hook invocation, action, business rule or test is removed. Unused optional prop values and protected action imports remain.

## Verification plan and environment

Each batch gets a fresh source copy with installed node_modules symlinked, no .env files and no .next output. The existing `scripts/performance/isolated-command.mjs` supplies synthetic non-serving loopback Supabase configuration, disables live tests and clears integration credentials/telemetry. Commands run through this wrapper. The reviewed user build reset script runs only within the copy. Google Fonts may be fetched read-only. No install, scanner download, live integration, database migration or external write is used.

Required commands per batch: `npm test -- --maxWorkers=2`; `node node_modules/typescript/bin/tsc --noEmit --incremental false`; `npm run lint -- --format json --output-file ../B0N-lint.json`; `npm run build --ignore-scripts`. The separately run full tests cover prebuild. Additional focused suites and artifact comparisons are recorded on completion. A new unexplained failure means reverse only the current batch. The final integrated copy must pass the full baseline suite again. Authenticated DB/browser, real tenant enforcement, live payments/messaging, mobile visuals and full PWA recovery retain the explicitly disclosed earlier limitations.

## Remaining candidate decisions

All diagnostic leads outside these bounded batches retain their declarations and tests. C05 historical costing readers, C06 state/memos/aggregates and server-action reachability, C07–C14 exported/orphan/security/payment/compatibility/dependency candidates and C16 user work keep their earlier decisions. No weak inference from age, duplicate names, graph orphans or unused result is promoted to removal. The final ledger below enumerates residual unused-symbol diagnostics and the required follow-up.

## Validation results

Per-batch results follow. The ledger below records the final integrated checks and exact command context.

## Residual diagnostic ledger

This inventory is derived from the verified B03 lint baseline after excluding the final 58 retained import removals. Final lint confirms 59 retained unused-symbol warnings in 21 files, plus the unchanged non-unused warnings and three errors. These are retained candidates, not asserted dead code. Non-unused lint warnings and the three pre-existing errors also remain; rules and tests are unchanged.

| Exact file | Symbols retained | Decision and required follow-up |
| --- | --- | --- |
| `__tests__/costing-defaults-initialization.test.ts` | `savedCostingsLib` | **KEEP** — Test-only imports or setup values. No test contract was shown to be dead; removing assertions/setup is unnecessary for production cleanup. Investigate producer effects and supported test intent in a separate test-maintenance task. |
| `__tests__/paid-plan-standardized-billing.test.ts` | `existsSync` | **KEEP** — Test-only imports or setup values. No test contract was shown to be dead; removing assertions/setup is unnecessary for production cleanup. Investigate producer effects and supported test intent in a separate test-maintenance task. |
| `__tests__/payroll-cycle-engine.test.ts` | `getBoundaryOnOrBefore` | **KEEP** — Test-only imports or setup values. No test contract was shown to be dead; removing assertions/setup is unnecessary for production cleanup. Investigate producer effects and supported test intent in a separate test-maintenance task. |
| `__tests__/payroll-cycle-integration.test.ts` | `validateCycleRule`, `previewPeriods`, `formatCycleExplanation`, `diffInDays`, `BaseWorkerAdvance`, `newRule`, `new24DayRule` | **KEEP** — Test-only imports or setup values. No test contract was shown to be dead; removing assertions/setup is unnecessary for production cleanup. Investigate producer effects and supported test intent in a separate test-maintenance task. |
| `__tests__/plan-aware-settings-permissions.test.ts` | `securityCard` | **KEEP** — Test-only imports or setup values. No test contract was shown to be dead; removing assertions/setup is unnecessary for production cleanup. Investigate producer effects and supported test intent in a separate test-maintenance task. |
| `__tests__/standalone-plan-chooser.test.ts` | `UPGRADE_PLAN_FEATURES` | **KEEP** — Test-only imports or setup values. No test contract was shown to be dead; removing assertions/setup is unnecessary for production cleanup. Investigate producer effects and supported test intent in a separate test-maintenance task. |
| `__tests__/tour-invitation-lifecycle.test.ts` | `beforeEach`, `afterEach`, `getTourDefinition` | **KEEP** — Test-only imports or setup values. No test contract was shown to be dead; removing assertions/setup is unnecessary for production cleanup. Investigate producer effects and supported test intent in a separate test-maintenance task. |
| `__tests__/tour-preferences-and-actions.test.ts` | `TourId` | **KEEP** — Test-only imports or setup values. No test contract was shown to be dead; removing assertions/setup is unnecessary for production cleanup. Investigate producer effects and supported test intent in a separate test-maintenance task. |
| `app/(dashboard)/owner/billing/page.tsx` | `canEnrollFree`, `UpgradeWall`, `FreeBillingAction`, `BillingPlanTier`, `user`, `query`, `grant`, `canShowPlanCards`, `hadPaidAccess` | **KEEP** — Protected billing/plan-gating module. Existing memoization error or account/entitlement expressions require dedicated review; no billing or Free-policy edit in this task. |
| `app/(dashboard)/owner/estimator/EstimatorClient.tsx` | `accent` | **KEEP** — Unused component/function parameter or destructured prop. Preserve signatures, defaults, object-property evaluation and public prop contracts. A dedicated API/behavior review would be needed before changing them. |
| `app/(dashboard)/owner/production/BaseMachineBoard.tsx` | `onActivateQualityClick` | **KEEP** — Unused component/function parameter or destructured prop. Preserve signatures, defaults, object-property evaluation and public prop contracts. A dedicated API/behavior review would be needed before changing them. |
| `app/(dashboard)/owner/production/BaseProductionClient.tsx` | `createBaseProductionJob`, `BaseMachineJobs`, `costingTargetMeters`, `jobDraft`, `setJobDraft`, `jobSummaries`, `producedThisPeriod`, `openJobs`, `pendingAdvances`, `unsettledPayable`, `handleJobStatus` | **REVIEW** — Historical costing field reader, state initializer/hook positions, render-time aggregates and a legacy server-action consumer. No automatic removal of financial expressions, hook calls or old-client reachability. See C05/C06. |
| `app/(dashboard)/owner/production/actions.ts` | `previewPeriods`, `formatCycleExplanation`, `PayrollCycleRule`, `PayrollCycleConfig`, `rpcData`, `insertData`, `ruleInput` | **REVIEW** — Server action/loader boundary; includes typed contracts and RPC result bindings. Review framework action registration and effects first. The operation that produces an unused result must remain; signature and protected data-path changes need separate scope. |
| `app/(dashboard)/owner/production/loaders.ts` | `getBasePayrollPeriod` | **REVIEW** — Server action/loader boundary; includes typed contracts and RPC result bindings. Review framework action registration and effects first. The operation that produces an unused result must remain; signature and protected data-path changes need separate scope. |
| `app/(dashboard)/owner/rates/RatesClient.tsx` | `index`, `index` | **KEEP** — Unused component/function parameter or destructured prop. Preserve signatures, defaults, object-property evaluation and public prop contracts. A dedicated API/behavior review would be needed before changing them. |
| `components/estimator/CostEstimateTutorial.tsx` | `Compass`, `Sparkles`, `replayTitle`, `replaySubtitle` | **REVIEW** — Locale property reads/string-method evaluation, context-hook result and optional prop default remain. Do not change evaluation, language behavior or component signature to satisfy a diagnostic; localizations and opt-in tour contracts stay. |
| `components/estimator/FreeUsageCard.tsx` | `freeErrorText` | **KEEP** — Protected billing/plan-gating module. Existing memoization error or account/entitlement expressions require dedicated review; no billing or Free-policy edit in this task. |
| `components/estimator/SavedCostingsTutorial.tsx` | `languageStatus` | **REVIEW** — Locale property reads/string-method evaluation, context-hook result and optional prop default remain. Do not change evaluation, language behavior or component signature to satisfy a diagnostic; localizations and opt-in tour contracts stay. |
| `components/onboarding/base/Step6Review.tsx` | `readiness` | **KEEP** — Unused component/function parameter or destructured prop. Preserve signatures, defaults, object-property evaluation and public prop contracts. A dedicated API/behavior review would be needed before changing them. |
| `components/rates/RateBookTutorial.tsx` | `disabled`, `replayTitle`, `replaySubtitle` | **REVIEW** — Locale property reads/string-method evaluation, context-hook result and optional prop default remain. Do not change evaluation, language behavior or component signature to satisfy a diagnostic; localizations and opt-in tour contracts stay. |
| `components/settings/plan-aware/plan-aware-settings-view.tsx` | `tier` | **KEEP** — Unused component/function parameter or destructured prop. Preserve signatures, defaults, object-property evaluation and public prop contracts. A dedicated API/behavior review would be needed before changing them. |

## Review notes and limits

The React review checks component declarations, hook order/dependencies, JSX and accessibility props, effects/subscription cleanup, and public prop/type shapes. All remain byte-identical outside the removed import declarations; no performance or styling refactor is included. Existing production-flow assertions read source/SQL text, payroll tests execute pure settlement/date calculations, onboarding tests execute parsers/defaults plus source contracts, and tutorial tests use mock auth/storage with locale/source assertions. They are not authenticated browser or real database coverage.

The temporary compiler comparison first needed the installed native synchronous binding entry point (the asynchronous entry point requires initialization), the actual x64 host package, and explicit false options for the Next compiler configuration schema. No compiler download or install was run; the native x64 package was already present. The initial lint comparison also included differing temporary absolute paths in the same three diagnostic messages; only those path prefixes were normalized, leaving diagnostic text, severity and rules intact. These are evidence-harness corrections, not application changes or weakened repository checks.

### B04 verified

Working directory: `/var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl/B04`. Full suite PASS (267 files, 1,946 tests, one live skip); configured types PASS; fresh build PASS (64 static pages); focused suite PASS (64 tests). Lint FAIL solely on the same three baseline errors, with 107 warnings; 36 expected warning removals since B03 and no new diagnostics. Generated CSS (two files), routes and all 261 server-action export/worker registrations match B03. Source paths, dynamic imports, exports and orphan inventory match; 1 source-only import edge(s) disappeared, exactly the pre-proved compiler-elided imports. Six mocked auth warning events match after normalizing only elapsed-time fields. The actual edited files produce identical production browser and SSR JavaScript. Reverse patch was applied in a disposable directory and restored each pre-batch file hash. All original user files and prior batches are preserved.

## Additional compiler-only leads

The stricter TypeScript unused-local/parameter discovery also reports the declarations below; configured TypeScript does not enable this as a gate, and JSX-aware lint does not report the default React imports. They are retained. Default React imports are **REVIEW** for a separate, consistent JSX-runtime cleanup including alternate QA/browser transforms and development output; this task does not standardize JSX imports across the repository or expand into currently blocked browser fixtures. Callback parameters are **KEEP** to preserve signatures and invocation contracts. Final strict discovery reports 105 remaining diagnostics (initial 169; B02 164), with no new diagnostic after normalizing line/column shifts; these remain FAIL as a discovery check, while configured TypeScript passes. The difference from lint counts reflects compiler grouping of wholly unused import declarations and JSX-aware lint behavior.

| Exact file | Retained symbol | Decision |
| --- | --- | --- |
| `app/(dashboard)/admin/admin-ui.tsx` | `React` | REVIEW — JSX/runtime convention |
| `app/(dashboard)/owner/machines/error.tsx` | `React` | REVIEW — JSX/runtime convention |
| `app/(dashboard)/owner/payroll/PayrollClient.tsx` | `err` | KEEP — callback signature |
| `app/(dashboard)/owner/payroll/PayrollClient.tsx` | `variables` | KEEP — callback signature |
| `app/(dashboard)/owner/payroll/PayrollClient.tsx` | `data` | KEEP — callback signature |
| `app/(dashboard)/owner/payroll/PayrollClient.tsx` | `error` | KEEP — callback signature |
| `app/(dashboard)/owner/payroll/PayrollClient.tsx` | `variables` | KEEP — callback signature |
| `app/(dashboard)/owner/production/registers/MachinesRegister.tsx` | `React` | REVIEW — JSX/runtime convention |
| `app/(dashboard)/owner/production/registers/WorkersRegister.tsx` | `React` | REVIEW — JSX/runtime convention |
| `app/(dashboard)/owner/workers/error.tsx` | `React` | REVIEW — JSX/runtime convention |
| `app/free/account/FreeAccount.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/estimator/FreeTransactionRecovery.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/machines/MachineCard.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/machines/MachineEmptyState.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/machines/MachineGrid.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/machines/MachineRegisterPanel.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/machines/MachineRow.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/machines/MachinesPageHeader.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/machines/MachineStatusBadge.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/machines/MachineToolbar.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/onboarding/base/BaseOnboardingWizard.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/onboarding/base/CompletionScreen.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/onboarding/base/OnboardingStepper.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/onboarding/base/Step1Factory.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/onboarding/base/Step2Defaults.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/onboarding/base/Step4Workers.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/onboarding/base/Step5Payroll.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/onboarding/base/Step6Review.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/settings/payroll/PayrollCycleSettingsCard.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/settings/plan-aware/deletion-review-card.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/settings/plan-aware/plan-aware-settings-view.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/settings/plan-aware/security-card.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/settings/plan-aware/unsaved-changes-dialog.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/tours/TourInvitation.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/ui/amount.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/workers/WorkerCard.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/workers/WorkerEmptyState.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/workers/WorkerRegisterPanel.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/workers/WorkerRow.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/workers/WorkersPageHeader.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/workers/WorkerStatusBadge.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/workers/WorkerToolbar.tsx` | `React` | REVIEW — JSX/runtime convention |
| `components/workers/WorkforceGroup.tsx` | `React` | REVIEW — JSX/runtime convention |
| `lib/i18n/context.tsx` | `React` | REVIEW — JSX/runtime convention |
| `lib/i18n/context.tsx` | `match` | KEEP — callback signature |
| `scripts/qa/challan-browser/main.tsx` | `React` | REVIEW — JSX/runtime convention |
| `scripts/qa/stock-browser/main.tsx` | `React` | REVIEW — JSX/runtime convention |

Source inventory comparisons normalize file ordering and relative paths to the shared installed node_modules directory, after verifying that both resolver paths reach the exact same installed file. This accounts for different snapshot-directory depths; no source or dependency-resolution difference is ignored.

### B05 reverted — verification gate failed

The full suite failed `__tests__/estimator-left-rail.test.ts:39`: the source-contract assertion requires `Compass` and `Sparkles` in `CostEstimateTutorial.tsx`. Result: 266 test files passed, one failed; 1,945 tests passed, one failed and one live skip. Types passed; lint had the same three errors and 100 warnings, but that is insufficient. The build was started before the completed test outcome was collected, then abandoned when the failing check was identified.

All four B05 files were restored with only the reverse B05 patch, and each exact pre-batch hash was confirmed. No assertion, source contract or implementation was changed to make the test pass. This exposes a gap in the pre-edit reference review: the compiler/AST proof correctly established unused runtime imports but did not account for the existing textual test consumer. At that boundary C26–C29 were reclassified REVIEW. The later independent test-consumer review isolated the failure to CostEstimateTutorial: C26 remains REVIEW, while C27–C29 were separately requalified and verified under B07. A dedicated supported-UI/test-contract decision is still required for C26; cleanup does not decide what its launcher-appearance test should assert. B05.patch is retained only as reverted evidence and must not be included in rollback of retained cleanup.

The B05 build was terminated with exit 130 and is NOT RUN to completion. After reversal, `node scripts/performance/isolated-command.mjs npm test -- __tests__/estimator-left-rail.test.ts --maxWorkers=2` from the restored B05 source copy passed. B06’s full suite passed with all B05 source restored; B07’s full suite then passed with only its independently requalified subset applied. B06 was separately rechecked for textual test consumers using exact candidate names and onboarding component paths; the tutorial-only `Compass`/`Sparkles` assertions do not consume the onboarding modules. Their data/parsing and route/guard tests remain unchanged. No batch depends on the reverted changes.

## B07 independent remainder of the reverted cohort

After reversing B05, the failing test was read in full. Its `tutorialComponent` variable reads only `components/estimator/CostEstimateTutorial.tsx`; that file and its imports remain unchanged. Whole-test searches for the candidate identifiers and the three sibling paths confirm that the remaining five import bindings do not serve that textual assertion. Existing Rate Book tests assert live tutorial imports, keyboard handling, one portal and layout/source contracts; saved-costing tests cover supported flow steps. These live imports and bodies are unchanged. The earlier B05 full run had no failure in those sibling tests, but its failed aggregate result is not treated as a pass.

C27–C29 are independently reclassified REMOVE-SAFE for **B07**: `components/estimator/SavedCostingsTutorial.tsx` (`Compass`, `Sparkles`), `components/rates/RateBookTutorial.tsx` (`Compass`, `Sparkles`), and `app/(dashboard)/owner/rates/RatesClient.tsx` (`CircleDollarSign`). A fresh per-batch installed-SWC comparison again proves identical browser/SSR JavaScript and unchanged non-import AST. B07 ran after B06 was verified, with its own patch, full suite, the formerly failing estimator test, focused Rate Book/tour tests, types/lint and fresh build. No `CostEstimateTutorial` or test modification was made.

### B06 verified

Working directory: `/var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl/B06`. Full suite PASS (267 files, 1,946 tests, one live skip); configured types PASS; fresh build PASS (64 static pages); focused suite PASS (31 tests). Lint FAIL solely on the same three baseline errors, with 90 warnings; 53 expected warning removals since B03 and no new diagnostics. Generated CSS (two files), routes and all 261 server-action export/worker registrations match B03. Source paths, dynamic imports, exports and orphan inventory match; 4 source-only import edge(s) disappeared, exactly the pre-proved compiler-elided imports. Six mocked auth warning events match after normalizing only elapsed-time fields. The actual edited files produce identical production browser and SSR JavaScript. Reverse patch was applied in a disposable directory and restored each pre-batch file hash. All original user files and prior batches are preserved.

### B07 verified

Working directory: `/var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl/B07`. Full suite PASS (267 files, 1,946 tests, one live skip); configured types PASS; fresh build PASS (64 static pages); focused suite PASS (38 tests). Lint FAIL solely on the same three baseline errors, with 85 warnings; 58 expected warning removals since B03 and no new diagnostics. Generated CSS (two files), routes and all 261 server-action export/worker registrations match B03. Source paths, dynamic imports, exports and orphan inventory match; 6 source-only import edge(s) disappeared, exactly the pre-proved compiler-elided imports. Six mocked auth warning events match after normalizing only elapsed-time fields. The actual edited files produce identical production browser and SSR JavaScript. Reverse patch was applied in a disposable directory and restored each pre-batch file hash. All original user files and prior batches are preserved.

## Final verification ledger

All package commands use the isolation wrapper described above; no environment values or credentials are recorded. The baseline for B04 is the byte-identical completed B03 state. B05/B06 start from verified B04 (B05 was exactly reversed). B07 starts from verified B06. Every retained batch has a full-suite/type/lint/fresh-build result and a reverse-tested patch. Working directories: F4 = `/var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl/B04`; F5 = `/var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl/B05`; F6 = `/var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl/B06`; F7 = `/var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl/B07`. The B05 copy was restored after failure for the targeted reversal test; its failed run logs are historical.

| Exact command after `node scripts/performance/isolated-command.mjs` | CWD | Result |
| --- | --- | --- |
| `npm test -- --maxWorkers=2` | F4 | PASS: 267 files, 1,946 passed, one live skip |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | F4 | PASS |
| `npm run lint -- --format json --output-file ../B04-lint.json` | F4 | FAIL: same three baseline errors; 107 warnings, no added diagnostics |
| `npm run build --ignore-scripts` | F4 | PASS: clean build, 64 static pages |
| `npm test -- --maxWorkers=2` | F5 | FAIL: 1,945 passed, one failed, one skipped; batch reverted |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | F5 | PASS |
| `npm run lint -- --format json --output-file ../B05-lint.json` | F5 | FAIL: same three baseline errors; 100 warnings, no added diagnostics |
| `npm run build --ignore-scripts` | F5 | NOT RUN to completion: stopped with exit 130 after test failure |
| `npm test -- --maxWorkers=2` | F6 | PASS: 267 files, 1,946 passed, one live skip |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | F6 | PASS |
| `npm run lint -- --format json --output-file ../B06-lint.json` | F6 | FAIL: same three baseline errors; 90 warnings, no added diagnostics |
| `npm run build --ignore-scripts` | F6 | PASS: clean build, 64 static pages |
| `npm test -- --maxWorkers=2` | F7 | PASS: 267 files, 1,946 passed, one live skip |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | F7 | PASS |
| `npm run lint -- --format json --output-file ../B07-lint.json` | F7 | FAIL: same three baseline errors; 85 warnings, no added diagnostics |
| `npm run build --ignore-scripts` | F7 | PASS: clean build, 64 static pages |
| `npm test -- __tests__/active-qualities-production-flow.test.ts __tests__/base-payroll-settlement-period.test.ts __tests__/payroll-cycle-engine.test.ts __tests__/p1-payroll-config-onboarding.test.ts --maxWorkers=2` | F4 | PASS: 64 tests |
| `npm test -- __tests__/base-onboarding-wizard.test.ts __tests__/base-plan-localization.test.ts __tests__/base-fixed-salary.test.ts __tests__/p1-payroll-config-onboarding.test.ts --maxWorkers=2` | F6 | PASS: 31 tests |
| `npm test -- __tests__/estimator-left-rail.test.ts __tests__/rate-book-tutorial.test.ts __tests__/saved-costings-tour.test.ts __tests__/sprint5-rate-book-ui.test.ts --maxWorkers=2` | F7 | PASS: 38 tests |
| `npm test -- __tests__/estimator-left-rail.test.ts --maxWorkers=2` | F5 after reversal | PASS: three tests |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false --noUnusedLocals --noUnusedParameters` | F7 after build | FAIL: 105 discovery diagnostics; configured type gate remains PASS |

From repository root: `node scripts/performance/isolated-command.mjs node /var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl/check-imports.cjs B04 verify`, and the same command with `B06` and `B07`, PASS. `python3 /var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl/compare-batch.py B04`, and the same command with `B06` and `B07`, PASS. Those inspect full diagnostic sets, unchanged resolver targets, source/route/export inventories, two byte-identical CSS files, all 261 Node action export/worker registrations, expected six mocked auth events and original user hashes. `git diff --check` PASS. No Edge actions exist. Opaque action IDs still vary across clean builds as documented in `continuation.md`; no exported action identity was removed.

## Final public smoke and limits

A fresh browser baseline was captured from the unchanged B03 build because the older screenshot bytes were unavailable in the new browser session. Baseline server: from `/tmp/weavly-cleanup-continuation-4elnpix_/final`, `node scripts/performance/isolated-command.mjs node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4324`. Final server: from F7, same command with port `4323`. Root commands `python3 /var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl/http-smoke.py 4324 baseline` and `python3 /var/folders/fg/zfs5p7f92n923glf5hxny7v40000gn/T/weavly-cleanup-final-audit-4j0273zl/http-smoke.py 4323 final` both PASS all seven status/redirect scenarios.

Browser PASS: English login at 1280 × 720 has identical screenshot bytes; Hindi/Gujarati rendering, Gujarati reload, Tab focus, unauthenticated production deep-link redirect, and offline-page content. Captured browser error/warning lists are empty. No credentials entered or login submitted. Screenshot bytes were compared in memory; no screenshot file was added. Public smoke does not validate authenticated workflows. Dedicated failed-request tracing, authenticated login/reload/logout and tenant isolation, real DB/financial/inventory workflows, mobile visual checks, actual PDF downloads and true PWA/offline recovery remain NOT RUN or BLOCKED as recorded in the earlier report. No production service used and no test/fixture repair.

## Final preservation, reversal and stop decision

All 17 changed source files match the final verification copy. Every other starting non-maintenance file, including all four original user files, retains its starting SHA-256 hash. Source/module inventory includes the relevant untracked build work. No new tracked generated output, asset, config, schema, dependency or lockfile change; no staged change, branch switch, commit or deployment. The temporary servers and agent-created tabs were closed.

Cumulative rollback was executed in a disposable directory in order B07 → B06 → B04 → B03 → B02 → B01 and restored all 17 original source hashes. **Do not reverse B05: it is already reverted.** `manifest.json` and each retained `patches/B0N.patch` identify exactly the cleanup hunks. For each retained batch, run `git apply --reverse --check docs/maintenance/cleanup-2026-09-14/patches/B0N.patch`, then the same command without `--check`. Stop if a hunk conflicts with later work; never reset a complete dirty file. These patches exclude the original user files. Keep the maintenance records; the precise task-file list is in the manifest and report. Temporary source snapshots are local evidence, not durable archival backups.

The practical candidate set is now classified and verified safe batches are complete. C26 needs a separate supported-UI/test-contract decision; no test assertion was weakened. Remaining hooks/evaluated values, public/legacy/security/data paths, dependency/configuration proposals, JSX conventions and orphan exports need the stronger evidence or separate scope stated in their candidate rows. No additional deletion is justified under the present gate. This conclusion does not claim repository-wide purity or zero regression risk.
