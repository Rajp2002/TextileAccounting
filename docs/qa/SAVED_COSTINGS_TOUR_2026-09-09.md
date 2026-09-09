# Saved Costings guided tour — implementation and verification

Implemented in the isolated `0775` worktree. No deployment or external messages/shares.

## Behavior

- Paid library: 15 steps covering search, filters, grouped costing selection, version history, selected breakdown, commercial totals, reuse/duplicate/separate-quality draft, favourite/archive/review actions, internal and customer export previews, sharing prerequisites, two-version selection, comparison summary and expanded calculation details, and completion. Production and quotation capabilities add their respective steps (17 when both are enabled).
- The Costings tab on quotation-enabled workspaces now uses the existing grouped quality/version library and excludes quotation records from those groups. Other quotation tabs retain their previous presentation.
- Free: six snapshot/export steps. No reusable-quality, versioning, comparison or paid production instructions. The same component covers retained Free snapshots on the owner page after an upgrade.
- Launcher follows the existing amber tour presentation: top of the left rail at the Rate Book desktop breakpoints, inline above content at smaller widths. Free’s standalone/retained section has an inline launcher.
- Next/Enter/Right Arrow, Back/Left Arrow, Tab/Shift-Tab focus cycling, Skip, Finish and replay. Escape is consumed without dismissing. Background pointer, click, touch and scrolling interaction is blocked. Zoom remains available.
- Tour-controlled dialogs are nonmodal underneath the tour’s own modal focus boundary. Inert values are restored exactly, including dynamically mounted portals. Skip/Finish closes samples, restores viewport/padding and launcher focus. Real list/filter/selection state stays mounted and preserved.
- Desktop sample dialogs reserve space beside the reading panel. Mobile reuses `useMobileTour` and its nested-scrollport positioning. Targets are re-resolved and mount tracking is bounded; navigation is never held waiting for a missing target.

## Replay safety

The library, export and comparison views use two in-memory canonical snapshots of the same sample costing. No server detail loading or mutation callbacks are connected to sample records. Empty libraries, a single saved version, incomplete old snapshots and real data-loading states therefore cannot strand the tour. Copy explains what to do in each case.

Export preview has explicit early-return guards for Print, Generate PDF and Share, and suppresses preview analytics in tutorial mode. No PDF is generated merely to expose the Share button: the tour explains that it appears after generating a current customer PDF, and that a share handoff is not delivery confirmation. Sample production links do not prefetch.

The tours start only from their launchers; Finish/Skip closes the current run. Replay starts at the first step. No new account-dismissal database field is introduced.

## Changed source files

- `components/estimator/SavedCostingsTutorial.tsx`: launcher, navigation, focus and interaction boundary, spotlight/panel.
- `lib/saved-costings-tour.ts`: entitlement-specific step ordering, reversible surfaces and isolated canonical sample data.
- `lib/i18n/saved-costings-tutorial.ts`: explicit English, Hindi and Gujarati copy.
- `app/(dashboard)/owner/quotes/QuotesClient.tsx`: paid integration, sample library/dialog orchestration and costing-tab grouping.
- `app/free/costings/SavedFreeCostings.tsx`: snapshot-only integration and sample export preview.
- `components/estimator/CostingExportDialog.tsx`: tutorial preview guards and target annotations.
- `app/globals.css`: responsive launcher placement and reading space for sample dialogs.
- `__tests__/saved-costings-tour.test.ts`: entitlement/order, reversible state, canonical sample comparison and translation coverage.

The current shared checkout’s Cost Estimator/Rate Book tours and helper diffs were inspected. This worktree already had the necessary mobile/target/viewport helpers. No shared-checkout source changes were copied or modified.

## Verification

- Full Vitest suite: 228 files passed; 1,505 tests passed, one skipped. A later parallel rerun timed out in the unrelated payroll mixed-history test and was stopped; a final single-worker rerun of payroll, tour, plan-panel, target and viewport tests passed all 39 tests in five files.
- TypeScript `tsc --noEmit`: passed.
- ESLint on all six changed/new TS/TSX implementation files: passed.
- `git diff --check`: passed.
- Local Next.js QA route using the actual `QuotesClient` and `SavedFreeCostings` components with empty initial records and sample-only tour data. The temporary route was removed after testing.
- Chromium via agent-browser: full paid/Free tours, forward and reverse export/comparison transitions, expanded comparison details, Escape retained at each step, focus inside tour, two selected checkboxes on Back, Skip/Finish with zero remaining dialogs/inert siblings and launcher focus restored.
- All 17 entitlement-enabled steps had highlighted targets and no runtime errors captured during that complete walkthrough.
- Mobile 390 × 844: no horizontal overflow; highlighted breakdown bottom 496px, panel top 508px; no overlap. Background click handler was not reached, wheel/touch events were prevented, and Tab/arrow navigation worked.
- Revised desktop at 1280px: sample dialog right edge 965px, reading panel left edge 1006px; no overlap.
- Gujarati mobile copy and all controls rendered within the panel, with no captured runtime errors. All three languages have complete automated copy coverage.
- Screenshots: `output/playwright/saved-costings-tour/desktop-reuse.png` and `output/playwright/saved-costings-tour/mobile-gujarati.png` (local QA artifacts).

## Limits

Browser verification used local Chromium viewport emulation, not physical iOS/Android devices or a production tenant. Native sharing, printing, PDF generation and real data mutations were intentionally not invoked. English/Hindi/Gujarati tour copy is explicit; surrounding existing UI retains its existing translation coverage. No deployment was performed.
