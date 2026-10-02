# Weavly mobile PWA diagnosis

Reviewed 2 October 2026, source commit `e68eb92d`. Scope: current Free, Lite, and Base workflows, weighted equally. This is a diagnosis and implementation plan; application code and live account data were not changed.

Implementation subsequently proceeded in five prioritized batches. See [mobile-pwa-implementation.md](mobile-pwa-implementation.md) for completed changes, verification, and remaining device/production validation. The observations below describe the original diagnosis.

## Recommendation

Keep the existing product capabilities and warm visual identity. Focus the next mobile iteration on **bringing work into view sooner, making navigation predictable, standardizing touch controls, and making save/recovery state unambiguous**. The app already has meaningful mobile infrastructure. Rebuilding it or removing advanced features would miss the main opportunities.

Use compact summaries with explicitly labelled detail views: show what helps the current task, and keep calculations, history, corrections, exports, and settings easy to find. Apply the same standard to costing, factory operations, stock/dispatches, and workforce/payroll.

## What was verified

- Source review covered navigation, current plan/route access, mobile CSS and primitives, costing, production, workers/machines/assignments, payroll, stock/dispatches, PWA lifecycle, drafts, loaders, and telemetry.
- Chromium touch/mobile emulation rendered real components using the repository's isolated tour fixtures: 11 distinct screen scenarios at 390×844, estimator at 320×740, daily sheet at 844×390, and daily sheet in Gujarati at 390×844. Fourteen captures completed without uncaught page JavaScript errors or whole-document horizontal overflow.
- Additional interactions dismissed the daily-sheet guide and opened payroll settlement. No business mutations were submitted. Fixtures stub server actions and use synthetic data; the payroll fixture is empty even when `populated=1` is supplied.
- The fixture uses a replica shell, lacks the real bottom navigation and root-layout fonts, and does not mount every global provider. Exact positions are diagnostic measurements of that fixture, not claims about every device or live account. No actual software keyboard was tested.
- Production-build transfer size, throttled loading, backend latency, authenticated end-to-end saves, service-worker upgrades, and physical iPhone/Android standalone behavior were not measured. Historical performance reports were reviewed but are not current mobile benchmarks. PWA generation is disabled in development (`next.config.ts:110`).

Browser evidence and screenshots are in `scratch/mobile-pwa-audit/`; those files are local and gitignored. See `browser-evidence.json`, `browser-details.json`, `probe.cjs`, and `probe-details.cjs`. The more extensive source UX notes are in `scratch/mobile-pwa-audit/ux-findings.md`.

## Findings, in implementation order

### 1. Make the actual task visible sooner — high priority

**Observed:** At 390×844, the daily sheet's first metre input began at y=914 with the guide expanded. Dismissing the guide reduced that to y≈773, still at the bottom of the viewport before accounting for real phone navigation. The default estimator's first quality-name input began at y=724; at 320×740 it began at y=758. These are fixture positions, not universal thresholds.

**Cause:** A guide, shift-details panel, progress panel, and worker-review panel precede the daily-sheet heading/readings. The estimator stacks its guide, current-quality context, mode controls, saved-quality entry, and readiness state above input. Payroll similarly presents substantial period/summary context before worker work.

**Change:**

- Daily sheet: compact date + shift row, one-line completion/save status, then machine readings. Keep Print, Worker review, and Recent production as explicit secondary actions.
- Estimator: compact quality header and Quick/Detailed selector, then the first inputs. Keep the guide reachable from Help; use completed-section summaries and jump links rather than forcing repeated full-form scrolling.
- Payroll: period + readiness + one primary settlement action, followed by searchable workers. Keep gross/recovery/net explanations and historical records in labelled detail views.
- Other registers: title/action, search and active filters, then real records. Let recurring instructional content collapse after use.

Evidence: `components/production/DailySheetGuidedTour.tsx:24`; `app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx:703`; `app/(dashboard)/owner/estimator/EstimatorClient.tsx:2810`; `app/(dashboard)/owner/production/BaseProductionClient.tsx:463` and `:557`.

### 2. Fix short-screen entry and unify floating action placement — high priority

**Observed:** At 844×390, the daily readings scroller was only **40px high**, containing a 90px row. Source uses `max-h-[calc(100vh-25rem)]`; with the app's 14px root that subtracts 350px.

**Change:** Use normal page scrolling for phone readings and reserve bounded register scrolling for sufficiently tall layouts. Do not derive usable phone content height from a fixed desktop subtraction. If a scroller remains necessary, account for actual visible viewport and controls.

The daily Save bar hardcodes an 80px bottom allowance; estimator's live-cost control hardcodes 76px. The navigation already measures its actual height into `--mobile-nav-height`. Build one shared action-placement primitive using that measurement, safe-area insets, and keyboard/visual-viewport state. Keep actions clear of the keyboard accessory and reading fields. Exact nav/action overlap remains a real-shell/device verification item.

Evidence: `BaseDailyProductionSheet.tsx:861` and `:1008`; `EstimatorClient.tsx:1480`; `components/navigation/mobile-navigation.tsx:16`; `app/mobile.css:176`.

### 3. Apply touch and reading standards to custom controls too — high priority

**Observed:** Real component measurements include estimator Quick/Detailed controls at **38.5px high**, cm/inch controls at **22px**, and payroll settlement type filters at approximately **21px**. The dialog close target is approximately **38.5px square**. Shared input controls correctly measured 44px.

**Cause:** The 14px root makes `size-11` equal 38.5px, `text-sm` equal 12.25px, and `text-xs` equal 10.5px. Shared coarse-pointer rules repair selected `data-slot` primitives, but native/custom buttons, close controls, and some toggles escape them. The root scale is intentional; changing it globally would reflow the entire product.

**Change:** Introduce explicit mobile hit-area and reading tokens and use them consistently. Target at least 44×44 CSS px for controls, including custom tabs, unit toggles, close buttons, and disclosure rows. Keep essential labels comfortably readable, normally 14–16px; use smaller text sparingly for secondary metadata. Preserve pinch zoom.

Payroll settlement renders both its custom close button and the shared dialog's default close button in overlapping positions; expose one accessible close control. Add selected/expanded semantics to custom filter and calculation controls. A small switch can remain visually compact if its associated labelled hit area is sufficiently large; inspect the entire hit area before classifying it as a defect.

Evidence: `app/globals.css:497`; `app/mobile.css:53`; `components/ui/dialog.tsx:93`; `components/ui/sheet.tsx:82`; `app/(dashboard)/owner/production/BasePayrollSettlementWorkspace.tsx:467`, `:562`, `:769`; `browser-details.json`.

### 4. Define phone navigation deliberately — high priority

**Source-confirmed:** Base quick navigation is derived from the first four grouped desktop nodes. It promotes Costing, Production, Machine Assignments, and Stock, leaving Workers/Payroll behind Menu. Group tabs open the full side drawer, whereas other tabs navigate directly.

**Recommended Base navigation:** **Costing · Production · Stock · Workforce · More**.

Each domain opens a useful default or remembered valid child screen, with visible local links to related features. Keep domain and child location clear. More includes the complete feature directory as a second discovery route. Preserve route URLs, back behavior, filters, draft recovery, role checks, and plan entitlements.

| Mobile area | Functionality retained and where it appears |
| --- | --- |
| Costing | Estimate, Quick/Detailed, all assumptions, saved costings/qualities where entitled, comparison/reuse/revision, Yarn Rate Book, quotation/share/export, Base production handoff |
| Production | Overview, active qualities/jobs, machine board, Daily Sheet, assignments, machine register, worker review, draft/save/correction/history |
| Stock | Fabric and yarn stock, movements/adjustments, audit, dispatches, related records, preview/print/export |
| Workforce | Workers, piece-rate/salary setup, readiness, pay periods, incentives, advances/recoveries, settlement/completion, calculation details, payment records, permitted reversals, payroll exports |
| More | Full feature directory, settings/defaults, billing, language, help/tours, entitled audit/data-export/privacy/account actions, sign out |

Use **Estimate · Saved · Rates · More** for Lite and **Estimate · Saved · More** for Free. Do not introduce non-entitled operations merely to make plan navigation visually symmetrical. These are proposed labels and grouping; confirm their Gujarati/Hindi wording through task testing.

Evidence: `components/navigation/owner-sidebar.tsx:86` and `:104`; `lib/disclosure-navigation.ts:18`; `lib/owner-navigation.ts:19`; `lib/subscription-access.ts`. Historical supervisor workflows are retired, not a missing mobile feature.

### 5. Make save, offline, and update states trustworthy — high priority

**Existing strengths:** Costing and production have local drafts, stable request identities, and conflict/revision handling. Production clears its draft after success. Protected documents/data intentionally use NetworkOnly caching; offline business writes have been retired.

**Gaps:** There is no consistent shared connectivity/save presentation across workflows. Estimator checks offline state when saving; production attempts its action and then shows the caught error. Offline fallback Retry goes to `/`, losing the attempted destination. Some recovery/update text remains hardcoded English.

**Change:** Use consistent states: **Draft on this device → Saving → Saved**, with explicit **Connection lost—draft safe** only when persistence actually succeeded, and **Couldn't save—Retry** for failures. Keep the current task and retry identity. Check real request outcomes as well as browser connectivity events. Retry the attempted URL/query after reconnecting. Explain operations needing internet without implying that a locally saved draft is a submitted business record.

**Concrete update bug:** Update notices use the worker's `scriptURL` as the version key in sessionStorage, while the worker defaults to the same `/sw.js` across releases. Later releases in that session can be suppressed as already seen. Use a real build identifier and retain an Update available action after the toast expires. Refresh only with a clear view of pending saves/drafts; preserve user-controlled activation.

Evidence: `components/pwa-update-notice.tsx:30`, `:73`, `:89`; `next.config.ts:108`; `lib/db.ts:4`; `components/providers.tsx:9`; `app/offline/page.tsx:23`; `BaseDailyProductionSheet.tsx:570`; `EstimatorClient.tsx:4700`.

### 6. Reduce initial data and input work without changing accounting — high priority

**Source-confirmed; latency not measured:** Production and payroll both use a loader that waits for 17 result groups, including complete historical entries, settlements/lines, revisions, assignments, and allocations. Datasets load concurrently; each complete read requests pages of up to 500 rows sequentially. A shared client imports multiple production/payroll workspaces and calculates payroll even for production views.

**Change:** Separate task-specific loaders and client entry points. Load active production and the selected shift first; fetch record details, revisions, and history when requested, with server-side pagination. Defer settlement/incentive/history panels. Keep meaningful loading and error states.

**Critical preservation rule:** Payroll includes older unpaid work. Do not improve speed by truncating history or blindly restricting computation to the displayed month. Calculate authoritative totals over every relevant obligation, including salary rules, advances, corrections, reversals, and rounding; return compact summaries and retrieve provenance on demand.

Daily-sheet input changes currently clone and serialize the full row map and synchronously write localStorage on every keystroke, while recomputing summaries and rerendering rows. Memoize row rendering and isolate per-row calculations; profile incremental/durable persistence. Do not replace this with a naive debounce that loses the last edits when the app is suspended.

Evidence: `app/(dashboard)/owner/production/loaders.ts:149`, `:566`, `:586`; `lib/base-complete-query.ts:9`; `BaseProductionClient.tsx:72`, `:197`, `:287`; `BaseDailyProductionSheet.tsx:463`, `:490`, `:862`; `lib/base-production-core.ts:484`.

### 7. Recompose dense records and long reviews — next priority

Retain desktop tables for large screens and exports. On phones, show identity + status + essential amount/quantity, followed by explicit View/Edit/Review actions and labelled detail. Payroll record detail still includes a 720px earnings table and a 640px machine table; costing comparison uses a 760px table. These are contained scrollers, not evidence of whole-page overflow, but they require sideways reading on phones.

For comparisons, use metric-by-metric **Previous / Current / Change** rows. For payroll, make name, net pay, readiness, and next action scannable; expose gross, recoveries, rates, quantities, provenance, and corrections through detail. For stock/dispatches, prioritize fabric/yarn identity, quantity, delivery/payment state, and the relevant action. Keep active filters visible and make Clear filters obvious.

Long entry/review tasks should use a full-height phone workspace with a stable title and primary action. Short sheets suit focused selections/confirmations. Reuse existing engines and validation; do not maintain separate mobile financial logic.

Evidence: `app/(dashboard)/owner/production/BasePayrollRecords.tsx:325`, `:369`; `app/(dashboard)/owner/quotes/QuotesClient.tsx:1596`; `BasePayrollSettlementWorkspace.tsx:503`.

### 8. Polish launch, installation, sharing, and measurement — next priority

- **Installation:** The owner nudge appears after eight seconds and links to generic instructions. Prefer a prompt after a successful meaningful task, direct Android installation when available, and concise device-specific instructions otherwise. Decide intentionally whether Free users should receive it. Preserve dismissal and frequency limits. (`components/pwa-install-nudge.tsx:20`, `:43`, `:89`.)
- **Sharing:** Native PDF file sharing already exists but follows generation that also downloads the file. On phones use Prepare PDF → Share as the main path, with Download/Print clearly available. Preserve browser support fallbacks and user-gesture requirements. (`components/estimator/CostingExportDialog.tsx:302`, `:319`, `:332`.)
- **Launch:** Consider first-use/on-demand playback for the approximately 5.17-second brand intro on installed `/login` launches. Its current repeat policy is an intentional design choice, not a functional defect; it is skippable and respects reduced motion/Save-Data. It does not imply a five-second delay on authenticated owner launches. (`lib/intro/intro-policy.ts:8`; `lib/intro/weave-timeline.ts:103`.)
- **Measurement:** Web Vitals currently cover documents initially opened at `/owner/estimator`. Add content-free measurements for all main workspaces and separate SPA/task timings from document metrics. Profile Gujarati/Hindi: their legacy DOM translation observer does extra work during mutations. (`lib/web-vitals.ts:10`, `:34`, `:59`; `lib/i18n/context.tsx:339`.)

## What to preserve

Safe-area handling, 16px mobile input text, pinch zoom, visual-viewport tracking, keyboard-aware overlays, measured/hiding bottom navigation, Next/Previous/Done input accessory, Quick/Detailed calculation parity, inline validation and error-to-field navigation, pending-versus-zero readings, local draft recovery, cross-tab conflict handling, duplicate-save protection, explicit payroll review gates, authorization/plan boundaries, protected-cache policy, language coverage, reduced motion, and lazy-loaded PDF/tour resources.

The app background is already static/removed in the current component; generic advice to remove animated dashboard backgrounds would not address today's code. Existing performance improvements should be retained and measured before further optimization.

## Delivery sequence and acceptance

1. **Correct measurable friction:** short-height reading area, undersized custom controls, duplicate close controls, consistent bottom actions, release-aware update detection, task-preserving offline retry. Add targeted behavioral checks for these defects.
2. **Deliver the common mobile structure across domains:** explicit plan-aware navigation, compact context headers, labelled details, consistent save/error states, task-first layouts. Validate every entitled route/action against the retention map; keep existing business logic and tour anchors working.
3. **Reduce startup/data work:** establish current production traces, split task loaders/clients, page history, optimize daily input rendering/persistence. Verify identical financial outputs, including older unpaid work, before accepting speed improvements.
4. **Validate on current physical installed PWAs and refine:** all languages, realistic records, interruption recovery, accessibility, sharing, and representative hardware/network conditions.

Suggested acceptance targets (targets, not achieved measurements):

| Area | Release gate |
| --- | --- |
| Functional parity | Every existing entitled feature, record action, field, calculation, export, correction, and recovery path remains reachable and correct |
| Task access | Major Base domains one tap away; related tools visible locally; stable back navigation and preserved filters/drafts |
| Readability/touch | Essential targets ≥44×44 CSS px; readable labels; no loss of content at 200% zoom/text testing; EN/HI/GU layouts verified |
| Phone geometry | No accidental page overflow, keyboard-covered focused field/primary action, collapsed reading scroller, or competing fixed bars at 320–430px widths and short landscape |
| Field performance | Mobile p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1, reported per relevant document population; workflow responsiveness measured separately |
| Task responsiveness | Input/selection and initial save feedback target ≤100ms; distinguish acknowledgement from completed server save |
| Loading | Establish midrange Android/4G baseline; initial goals useful warm navigation ≤500ms and cold usable workspace ≤3s; never count a skeleton as task readiness |
| Data integrity | Draft survives suspension; response-loss retry does not duplicate writes; payroll totals match with prior unpaid work, corrections, salaries, advances, and reversals |

Required current-build device scenarios: iPhone Home Screen and Android installed Chrome; browser and standalone modes; cold launch and resumed session; expiration/deep links; notch/home indicator; keyboard plus open sheet; rotation; low bandwidth; offline start; loss/recovery during save; OS suspension/termination; two successive service-worker deployments; share/download/print and return from external apps; VoiceOver/TalkBack; long names/amounts; populated and empty/error states. Use realistic small/large datasets and all three languages.

There is historical iPhone and performance evidence in the repository. This review does not replace current-build device verification or establish a current production performance score.
