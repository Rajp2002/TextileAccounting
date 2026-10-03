# Mobile PWA implementation

This tracks the sequential implementation of `mobile-pwa-diagnosis-2026-10-02.md`. All current Free, Lite, and Base functionality and accounting rules remain in scope. No deployment or live data changes are included.

## Batch 1 — mobile layout and controls

Implemented:

- Phone production readings use page scrolling, including short landscape. Desktop retains a bounded reading region with a useful minimum available height.
- The production register no longer reserves a large empty phone panel.
- Production save and estimator floating actions use measured navigation height, including translated labels and safe areas; software-keyboard state hides floating controls while entry is active.
- Shared segmented controls, navigation actions, tour launchers, custom estimator units, payroll filters, modal close controls, and labelled switches have a minimum 44px touch height. Custom button/close targets also have a 44px minimum width.
- Payroll settlement has one close control. Filters and calculation disclosure expose selected/expanded state; compact controls wrap when needed.

Verified:

- TypeScript and zero-warning ESLint pass.
- 101 focused tests pass, covering mobile viewport/input navigation, daily navigation/tours, payroll tours, estimator readiness, and desktop composition.
- Chromium fixture checks cover 320×568, 390×844, 844×390 with touch enabled, and 1440×900; English, Gujarati, and Hindi checks include real shared mobile navigation and viewport components.
- Landscape readings grew from a 40px scroller to a full approximately 90px sample row with page scrolling. Tested custom phone targets meet 44px, floating actions clear the measured navigation, and settlement exposes one close control.
- Full suite: 250 files / 2,078 tests passed, 1 intentional live-test skip; the remaining build-cache test passed separately with the sandbox's child-process restriction resolved. Total: all 2,079 non-skipped tests passed across those runs.

Evidence is local under `scratch/mobile-pwa-audit/batch1/`. These are synthetic-data UI fixtures, not installed-device or live-account tests. Keyboard CSS state was simulated; the existing viewport/keyboard behavior tests also pass.

## Batch 2 — update, recovery, and save reliability

Implemented:

- Waiting service workers identify their own build. Consecutive deployments at `/sw.js` can each announce an update; older workers use in-memory deduplication.
- An explicit refresh activates the waiting worker, checks editor guards again, then reloads. Timeout, failed activation, draft storage failure, unresolved conflicts, and protected in-progress edits leave the page open with retry. The navigation menu retains an update action after its notice expires.
- Estimator, daily-sheet, settlement, and existing unsaved settings/editor protections participate in refresh safety. This is explicit update protection, not a universal browser/OS termination guarantee.
- Offline retry reloads the attempted URL, preserving task/query/fragment. Direct offline-page visits return through sign-in. Protected tenant data remains network-only.
- Estimator draft status distinguishes pending local write, locally saved, failed local write, server save in progress, and confirmed server save. Production status likewise does not label failed/conflicting drafts as submitted.
- New copy is present in English, Hindi, and Gujarati.

Verified:

- Type checking and zero-warning lint pass. Focused update, recovery, guard, autosave, auth-boundary, and existing tour/readiness checks pass.
- Real local Chromium service workers at one script URL: version 2 stays waiting when the editor blocks refresh; retry activates version 2 and reloads under it; version 3 subsequently receives its distinct notice key.
- Offline screens in all three languages fit 390px with 44px actions.
- Evidence: `scratch/mobile-pwa-audit/update-results.json`, update/offline screenshots, and behavioral tests. The local worker proof uses the actual custom-worker source with a fixture build ID and Workbox-equivalent activation handler. Production webpack generation and installed iOS/Android checks remain part of final validation.

## Batch 3 — mobile workflow presentation

Implemented:

- Base uses direct Costing, Production, Stock, Workforce destinations plus More. Related links stay visible within each domain, including assignments, machines, dispatches, rate book, and payroll. Free/Lite retain their entitled destinations with shorter labels. The full drawer and desktop directory remain available.
- Phone guides use a compact invitation with visible Start and expandable explanation/dismissal. Opening/collapsing help does not change stored tour preferences.
- Daily date/shift controls share a row; progress and secondary actions are compact while retaining the original mounted controls and tour anchors.
- Payroll phone detail uses labelled values from the same formatted row data as desktop tables. Costing comparisons reflow the same table values into metric/Old/New/Change blocks.
- Essential shared phone labels/buttons use 14px text; bottom labels increased with measured navigation height retained.

Verified:

- 124 focused navigation, tour, financial presentation, and comparison tests pass; TypeScript and zero-warning lint pass.
- 18 Chromium fixture combinations cover daily entry, payroll detail, and comparison at 320×568, 390×844, 844×390 touch landscape, 1440×900 desktop, plus Hindi/Gujarati phones. No page overflow; all 23 comparison metrics fit vertically on phones; desktop detail tables remain visible.
- The first daily reading moved from approximately y914 to y611 at 390×844 with expanded initial guidance replaced by compact help, including the new contextual navigation. Short phones still require normal page scrolling.
- Nine additional Free/Lite/Base × EN/HI/GU phone checks verify the bottom destinations and full drawer routes.
- Evidence: `scratch/mobile-pwa-audit/batch3/`. Financial parity tests cover salary, incentive, per-metre, machine-worker and reversed receipt values. Synthetic fixtures do not establish live-account or installed-device performance.

The Saved Costings toolbar also uses full-width search and wrapping controls. Six additional EN/HI/GU checks at 320px and 390px confirmed no page/filter-popup overflow and 44px targets (`quotes-toolbar-results.json`).

## Batch 4 — task loading and input work

Implemented:

- Assignments has a dedicated five-dataset loader and a thin client. Role/entitlement checks, tenant filters, complete pagination, navigation state, tours, and analytics remain present.
- Production skips four payroll-only datasets. Payroll skips six operational datasets. Both retain the records needed by their work; payroll retains all older unpaid entries, salary history, advances, incentives, settlement lines, reversals, periods, and allocations. Complete loading remains the compatibility default.
- Removed an unused duplicate server payroll calculation. The production client calculates payroll only in payroll views. Records and settlement load on demand, with local retry; settlement stays mounted after its first opening so closing it preserves local state.
- Closed history and worker-review panels avoid unnecessary data preparation. Unchanged machine reading rows skip control rerenders, while handlers always use the latest committed editor state.
- Daily drafts still serialize and persist synchronously on every edit. Estimator autosave receives a stable persistence predicate; save-status renders no longer restart its debounce. Latest recoverable estimator inputs update at commit before page-hide flushing.

Verified:

- Loader tests compare complete/scoped financial results, including older unpaid work, salary changes, incentives, reversed payments, tenant separation, pagination, and failed reads. Missing financial inputs fail visibly instead of silently appearing empty.
- Browser verification confirms deferred settlement loading, retained search after close/reopen, and assignments return navigation.
- Synthetic 100/500-machine browser profiles identified row rendering and closed-panel preparation as larger costs than draft serialization/storage. Three sampled edits each still produced three durable writes. Different-worker edits and opening/closing worker review preserve both latest values.
- Diagnostic 100-machine React update samples dropped from roughly 113–118ms to 15–25ms; final 500-machine samples were roughly 29–44ms. These are unthrottled desktop Chromium with development React, three samples per scenario, variable JIT and host load—not production INP, representative mobile latency, or statistical benchmarks. No device-speed guarantee is inferred.
- Estimator browser proof observes one local write for an edit, still one after a further 4.5 seconds.
- Evidence: `stage4-browser-results.json`, `daily-input-profile-before.json`, `daily-input-profile.json`, `daily-input-helper-profile.json`, and `autosave-results.json` under the local audit directory.

## Batch 5 — installation, sharing, launch, and diagnostics

Implemented:

- Installation reminders qualify after a confirmed costing, production, payroll, stock, or dispatch success, including Free. They wait for editing, keyboard, dialogs, and registered unfinished-work blockers to clear; further input cancels the pending reminder. Impressions are recorded after visibility, with the existing seven-day frequency and permanent opt-out.
- Native installation uses the retained browser prompt from an explicit tap. Accepted prompts are not treated as installation evidence; `appinstalled` or standalone mode is. Unsupported/failed prompts retain localized platform instructions.
- Mobile PDF preparation creates the guarded file without automatically downloading. Share, Download, and Print remain explicit. Sharing uses the prepared file in the tap gesture; cancellation is neutral, unsupported devices show Download, and document edits invalidate the prepared file. Internal and customer document boundaries remain intact.
- Installed-login introduction plays on every launch by default (owner decision, 2026-10-03), with First launch / Every launch / Off in account settings, stored per device. Completion/explicit skip records the first introduction, which only matters once a device chooses First launch. Preferences are checked before the dark prepaint; restricted storage falls through to login. Existing reduced-motion, Save-Data, back-navigation, force/suppress, and landing policies remain supported.
- Local route-readiness marks cover Free costing, production/daily sheet, assignments, payroll, stock, and dispatch alongside the existing routes. Route changes reset the tracker; names exclude queries/record IDs and buffers are bounded. The existing remote Web Vitals contract remains document-level and estimator-only. These local marks do not claim to be remote workflow latency or task-completion telemetry.
- New interface copy is supplied in English, Hindi, and Gujarati.

Verified:

- Browser fixtures confirm success-only reminders, editing deferral, visible impression persistence, opt-out, PDF preparation with zero downloads, native sharing with active user gesture, neutral cancellation, explicit download fallback, blob reuse, and stale-file invalidation. PDF rendering/native OS handoff are mocked in this lifecycle fixture; existing document-content tests cover the real export model/layout.
- Three further EN/HI/GU landscape checks confirm that a failed native installation prompt leaves usable guidance and that the reminder clears measured navigation by 12px (`install-native-results.json`).
- Startup policy VM tests cover first/repeat launch, preferences, explicit skip/completion, unavailable storage, reduced motion, and existing policy exceptions.
- Production generation embeds the actual Next build ID in the custom worker; no unresolved build-ID identifier remains. The separate real Chromium worker upgrade proof covers consecutive workers at one script URL.

## Implementation validation before integration

- Full isolated test suite: 263 files, 2,253 passing tests, one intentional live-service skip.
- TypeScript and zero-warning ESLint pass. Isolated production compilation, generated pages, and worker generation pass; final build evidence is in `scratch/mobile-pwa-audit/final-build.log`.
- Final production build: `0DvvTiJZm8NfbsMXk9flV`. The generated worker contains this exact ID, and the emitted CSS includes the final installation-reminder navigation clearance and readable text rules. A pre-existing documentation token produces a non-blocking CSS optimizer warning (`docs/brand/WEAVLY_COLOR_SYSTEM.md:30`).
- The existing emitted-route-chunk analyzer reports estimator 238,894 B gzip (above its 200,000 B budget), rates 128,803 B, saved costings 168,279 B, and settings 174,051 B (each below its 180,000 B budget). Billing is informational at 76,260 B. These are chunk unions, not browser transfer measurements, and no same-commit pre-change build was measured. The estimator remains a bundle-reduction follow-up; the current pass does not claim that all performance budgets have been met. Artifact: `final-bundle-report.json` in the audit directory.
- This implementation validation used no production data writes, deployment, or live authenticated end-to-end submissions.
- Physical iPhone/Android checks remain necessary before release: installed-app keyboard/focus and safe areas, OS suspend/restore, real native install/share, weak-network saves, and authenticated update/draft recovery. Browser fixtures and policy tests do not establish these device behaviors.
- Historical datasets needed for accounting are still loaded completely. Authoritative server summaries with paginated provenance are a separate architectural follow-up; this change does not truncate history to obtain a faster result. Real-device and production measurements should determine whether that further work is needed.

## Integration for publication

On 3 October 2026 (Asia/Kolkata), the user authorized committing, pushing, and merging this work. Branch `codex/mobile-pwa-experience` integrates main through `846cc337`. Conflict resolution retains main's optimistic assignment interactions, animation classes, public-page translations, and shared top-centre toast stack alongside the mobile layouts, task-specific loaders, and guarded update manager. The pull request records combined-check results; the build ID and bundle figures above remain the original implementation snapshot.
