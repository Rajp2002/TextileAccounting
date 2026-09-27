# Guided tours refinement plan

**Status:** planning complete; implementation not started. Nothing in this package has been implemented. Every file, identifier, component and test named as *proposed* does not exist yet.

This is the authoritative entry point for the guided-tour refinement. It owns the scope, the shared diagnosis, the shared design, the runtime contract, the data-safety rules, the engineering contracts and the decision log. Page-level detail lives in [`docs/guided-tours/pages/`](guided-tours/pages/). Implementation work lives in [`docs/guided-tours/tasks/`](guided-tours/tasks/) and is ordered by [`EXECUTION_QUEUE.md`](guided-tours/EXECUTION_QUEUE.md).

## 0. How to use this package

| You are | Read |
| --- | --- |
| The implementation agent | [`EXECUTOR_PROMPT.md`](guided-tours/EXECUTOR_PROMPT.md), then the queue, then [`EXECUTION_STATUS.md`](guided-tours/EXECUTION_STATUS.md), then only your task packet and the sections of this file it cites. |
| A reviewer at a gate | [`REVIEW_PROMPT.md`](guided-tours/REVIEW_PROMPT.md). |
| The owner | §1 (scope), §2 (page decisions), §3 (what is wrong), §12 (product problems found along the way), §13 (unknowns and blockers). |

One location per rule: shared rules live here and are cited by ID (for example `DR-04`, `TC-3`, `DS-02`). Page specs and task packets cite these IDs instead of restating them. If a page spec and this file disagree, this file wins for shared behavior and the page spec wins for its page's copy, steps and anchors.

Supporting evidence:

- [`docs/guided-tours/audit/`](guided-tours/audit/): five read-only code audits (one per feature family). They are evidence, not decisions; findings adopted here are re-cited with their own IDs.
- [`docs/guided-tours/harness/`](guided-tours/harness/): the browser harness used for the OBSERVED findings, with instructions for re-running it.
- [`docs/guided-tours/PLANNING_CHECKLIST.md`](guided-tours/PLANNING_CHECKLIST.md): how this plan was produced.

## 1. Scope, baseline and evidence

### 1.1 Assignment

Turn the current guided tours into coherent, reliable walkthroughs that teach a textile factory owner with no Weavly experience what each operational page does, what it needs first, how to begin and finish its main workflow, which controls open dialogs, drawers or other pages, how to read the result, and what to do next. Tours stay strictly opt-in, easy to dismiss and replay, trilingual (English, Gujarati, Hindi), and must never change business data or use a Free costing allowance.

Out of scope: Settings, plan selection and upgrades, billing, general page redesign, new business functionality, unrelated refactoring and broad cleanup. Product defects found while auditing are recorded in §12 and routed to the owner. They are not fixed by the tour work unless a task says so explicitly.

### 1.2 Baseline (recorded 2026-09-27)

| Item | Value |
| --- | --- |
| Branch / revision | `claude/gracious-sagan-dnwtsm` at `f7cff98`, identical to `main`; worktree clean before planning |
| Uncommitted changes | Only this planning package: `docs/GUIDED_TOURS_REFINEMENT_PLAN.md`, `docs/guided-tours/**` |
| Runtime | Linux cloud container, Node v22.22.2. Dependencies installed with `npx -y npm@11.6.2 ci`; the container's npm 10.9.7 rejects the lockfile. `package-lock.json` unchanged |
| `.env*` files | None present. The real app cannot sign in here, so no page was observed with real data |
| Type check | `node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false`: PASS |
| Unit tests | `node scripts/performance/isolated-command.mjs npx vitest run`: 227 files, 1,949 passed, 1 skipped |
| Lint | `node scripts/performance/isolated-command.mjs npx eslint --max-warnings=0 .`: exit 0 (CLAUDE.md's "lint is red" baseline is out of date) |
| Tour test subset | 41 files, 604 tests, all passing (selection command in §10.4) |

### 1.3 Evidence classes

Every material finding carries one label:

- **OBSERVED (harness):** reproduced in Chromium through the tour harness (§1.4). The harness renders the real tour components, the real global CSS and the real owner-shell classes, but stubs server actions and has no real data, sidebar content or authentication.
- **CODE-VERIFIED:** established from source, with a path and line.
- **INFERRED:** plausible, not confirmed.
- **BLOCKED/UNKNOWN:** the evidence needed is not available; §13 says where we looked.

Source inspection does not verify animation quality, screen-reader output or real-device behavior. Those are covered by the review gates (§10.3).

### 1.4 The browser harness

Because no credentials exist in this container, tours were exercised in an isolated harness: Vite serves a page that mounts the real tour components (and, for live-page tours, the real page client components) inside the owner-shell classes, with every `'use server'` module replaced by a recording stub. A Playwright script opens each tour, presses Next through every step and records panel and spotlight geometry, focus, scroll, server-action calls and screenshots at four viewports:

| Viewport | Why |
| --- | --- |
| 1440×900, English | Both rails pinned (the widest composition tier) |
| 1280×800, Hindi | Right rail pinned only; long Devanagari copy |
| 1024×768, English | Single-column desktop; guide inline above the page |
| 390×844, Gujarati | Phone; bottom-sheet panel |

Harness limits: no sidebar content (a plain 248px block stands in), no mobile bottom navigation, empty data (live-page tours show their sample/demo rows), no real auth. Findings that depend on real data, real navigation or real devices are marked INFERRED or deferred to the gates. The harness source and instructions are in [`docs/guided-tours/harness/`](guided-tours/harness/).

The working-style article referenced by the brief (`claude.dev/blog/getting-the-most-out-of-opus-5-5`) could not be fetched: the container's egress proxy blocks that domain. The brief's own restatement was applied.

## 2. In-scope pages and tour decisions

Routes were discovered from `app/**/page.tsx`, `lib/owner-navigation.ts`, `lib/stock-navigation.ts`, `lib/disclosure-navigation.ts` and in-page links. "Plans" uses `lib/subscription-access.ts` capabilities.

| ID | Page | Route | Plans | Today | Decision | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| P01 | Cost Estimator | `/owner/estimator`, `/free` | Free, Lite, Base | `cost-estimate`: 10-step core (9 on Free) plus a 43+-step field guide | **Dedicated tour, redesigned.** Field guide removed (D-09). | [cost-estimator.md](guided-tours/pages/cost-estimator.md) |
| P02 | Saved Costings | `/owner/quotes`, `/free/costings` | Free, Lite, Base | `saved-costings`: paid 6–7 steps, Free 4, comparison 4 | **Dedicated tour + optional "Compare versions" walkthrough (paid).** Reference tour (D-03). | [saved-costings.md](guided-tours/pages/saved-costings.md) |
| P03 | Yarn Rate Book | `/owner/rates` | Lite, Base | `rate-book`: 6 steps + help list | **Dedicated tour, redesigned.** | [rate-book.md](guided-tours/pages/rate-book.md) |
| P04 | Production overview | `/owner/production` | Base | `production`: 12-step core + 11-step "details" | **Dedicated tour "Set up production"**; the details track is dissolved into P04, P05 and optional detail (D-10). | [production.md](guided-tours/pages/production.md) |
| P05 | Daily Sheet | `/owner/production/daily-sheet` | Base | None: the guide rail is not rendered on this route | **New dedicated tour "Record a shift"** with its own launcher (D-10). | [daily-sheet.md](guided-tours/pages/daily-sheet.md) |
| P06 | Machine Assignments | `/owner/assignments` | Base | `configuration`: 7 steps | **Dedicated tour, refined.** | [machine-assignments.md](guided-tours/pages/machine-assignments.md) |
| P07 | Machines | `/owner/machines` | Base | `machines`: 6 steps | **Dedicated tour, refined.** | [machines.md](guided-tours/pages/machines.md) |
| P08 | Workers | `/owner/workers` | Base | `workers`: piece 7 / salary 8 steps | **Dedicated tour, refined** (keeps the pay-type branch). | [workers.md](guided-tours/pages/workers.md) |
| P09 | Fabric Stock | `/owner/stock` | Base | `fabric-stock`: 7 steps | **Dedicated tour, refined**; one step covers "Audit Inventory" (D-11). | [fabric-stock.md](guided-tours/pages/fabric-stock.md) |
| P10 | Yarn Stock | `/owner/stock/yarn` | Base | `yarn-stock`: 8 steps | **Dedicated tour, refined**; one step covers "Audit Inventory". | [yarn-stock.md](guided-tours/pages/yarn-stock.md) |
| P11 | Stock audit | `/owner/stock/audit` | Base | Wrongly runs the Fabric Stock tour | **Remove the wrong tour now. A dedicated tour is specified but BLOCKED** until product defects PI-06/PI-07 are fixed (D-11). | [stock-audit.md](guided-tours/pages/stock-audit.md) |
| P12 | Dispatches | `/owner/dispatches` | Base | `dispatch`: 11 steps + 22 help topics | **Dedicated tour, refined** (fixes a factual error, SD-01). | [dispatches.md](guided-tours/pages/dispatches.md) |
| P13 | Dispatch print | `/owner/dispatches/[id]/print` | Base | None | **No tour.** Single-purpose print view opened in a new tab; P12's issue step names it. | [dispatches.md §Print](guided-tours/pages/dispatches.md) |
| P14 | Payroll | `/owner/payroll` | Base | `payroll`: 10-step core + 7-step help (+ dead "full" variant) | **Dedicated tour + optional "Advances, records and corrections" walkthrough.** | [payroll.md](guided-tours/pages/payroll.md) |

Excluded, with reason:

| Route | Reason |
| --- | --- |
| `/owner/settings`, `/free/account`, `/free/settings` (redirect) | Settings: excluded by the brief. |
| `/owner/billing`, `/free/billing`, `/plans`, `/onboarding/plans` | Billing and plan selection: excluded by the brief. |
| `/onboarding`, `/onboarding/base` | Setup wizards that are already step-by-step; a tour would duplicate them. |
| `/owner/data-export` | Account-level export reached only from Settings ("View export history"); settings-adjacent. |
| `/owner/operations`, `/owner/setup` | Legacy redirects to `/owner/assignments` and `/owner/workers` (`lib/management-navigation.ts`). |
| `/admin`, `/owner/settings/audit`, `/track/*` | Archived (`lib/phase1-scope.ts`), redirect to `/feature-archived`. |
| `/locked`, `/offline`, `/install`, `/feature-archived`, public pages | System or public pages, not operational features. |

Excluded pages may appear in tours as destinations (for example, "Settings → Payroll cycle"), but their tours are not designed here.

## 3. What is wrong today (shared diagnosis)

Page-specific defects live in each page spec. These are the cross-cutting ones. Severity: **Blocker** (unsafe, broken, or prevents essential understanding), **Major** (meaningful confusion or missing essential instruction), **Minor** (secondary clarity, consistency, polish).

### 3.1 Content

| ID | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| SD-01 | Blocker | **Tours teach business rules that are no longer true.** The Dispatch tour says confirming a dispatch deducts yarn and that production does not; current migrations deduct yarn when production is saved and the dispatch RPC never touches yarn. The Yarn Stock tour says the opposite, so the two tours contradict each other. The Yarn Stock invitation promises to "audit dispatch deductions". | CODE-VERIFIED: `lib/i18n/dispatch-tutorial.ts:52-56`; `supabase/migrations/20260926132412_restore_challan_auto_archive.sql` (0 occurrences of "yarn"); `20260920000000_unified_inventory_audit_architecture.sql:446` (`production_consumption`); `lib/i18n/tour-invitations.ts:27` |
| SD-02 | Major | **Tours name controls and screens that do not exist.** Examples: "Save machine production" (real: "Save shift"), "Edit production log" ("Edit saved log"), "Print collection sheet" ("Print sheet"), "Overview & Looms" (sidebar: "Overview"), "Loom Board" ("Machine Board"), "Dispatch → Earlier dispatch records → Pending Dispatches" (retired), Payroll's "Full" tier (retired). Several tests pin the wrong wording. | CODE-VERIFIED: audit reports §1.3 (production), §1.3/§4.3 (stock/dispatch), §3/§5 (payroll); `BaseDailyProductionSheet.tsx:664,686,780` |
| SD-03 | Major | **Essential prerequisites are missing.** Production never mentions that every yarn in a costing needs stock above 0 kg before the quality can be activated; the Rate Book tour never shows how to add the first rate; no tour explains where the Daily Sheet is or how to launch its guide. | CODE-VERIFIED: `validate_quality_activation_yarn` (`20260920000000…sql:113-192`); `lib/rate-book-tour.ts:5-12`; `ProductionGuidedTour.tsx:25,32` |
| SD-04 | Major | **Steps explain one thing while spotlighting another.** Estimator warp/weft steps spotlight the component-count boxes while the copy explains row inputs; the Estimator's last paid step spotlights Saved *Qualities* while the copy is about Saved *Costings*; Rate Book step 5 spotlights a badge while describing dialog fields. | CODE-VERIFIED: `lib/estimator-tour.ts:16-17,23`; rate-book audit A4 #4 |
| SD-05 | Major | **Copy is long and repeats labels.** Bodies run 3–5 sentences in a 260–400px panel; the Estimator field guide has a step for every field of every yarn row; many steps restate the control's label. Gujarati and Hindi copy embeds English UI labels that the UI itself shows translated, and uses several names for the same thing (for example three Hindi names for Saved Costings). | CODE-VERIFIED: `lib/i18n/*-tutorial.ts`; audits §5/§6 |
| SD-06 | Major | **The tour for five Base pages hides the real page.** Production, Fabric Stock, Yarn Stock, Dispatches and Payroll wrap the live page in `hidden` and show a hand-built replica, so the owner never sees their own screen during the tour and nothing links the sample back to the real controls at the end. The replicas have drifted from the real UI (SD-02). | CODE-VERIFIED: `<div hidden={step !== null}>` in `ProductionGuidedTour.tsx`, `StockGuidedTour.tsx`, `DispatchGuidedTour.tsx`, `PayrollGuidedTour.tsx` |

### 3.2 Runtime and presentation

| ID | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| SD-07 | Major | **The panel covers the thing it explains.** Placement docks the panel to a viewport corner and only moves it for targets near the top or right edge; targets inside tour dialogs are exempt. | OBSERVED (harness): Yarn Stock step 2 (1280 hi, 1024 en), Payroll steps 1/3/4 (1024), Fabric Stock step 3 (1024), Assignments step 1 (1024/1280/1440), Workers step 1 (1024/1280), Saved Costings step 2 (1440: 55,460 px² of the dialog under the panel), Estimator step 2 (1440). CODE-VERIFIED: `hooks/use-guided-tour.ts:144-146` |
| SD-08 | Major | **At 1440px and wider, the pinned left rail paints over the sample page inside the spotlight.** The replicas use `mx-auto max-w-6xl` instead of the workspace width, so they slide under the fixed rail. | OBSERVED (harness): Payroll step 3 and Production step 1 at 1440×900 (guide card text overlaps "Settle Payroll" and "Active Qualities") |
| SD-09 | Major | **The spotlight can point off-screen.** The Estimator's last step (paid and Free) scrolls elsewhere and leaves its target ~1,700px above the viewport: an empty spotlight. | OBSERVED (harness): `estimator-en-1440x900` step 10 (target y = −1768), `free-estimator` step 9 |
| SD-10 | Major | **Three different runtimes.** Seven Base tours share `hooks/use-guided-tour.ts`; Estimator (753 lines), Rate Book (700) and Saved Costings (208) each re-implement modality, focus, placement and scrolling, with fixed delays (150/200/350/500/550/1500/1800 ms), no scroll restore (Rate Book), and no inert handling for dialogs opened mid-tour (Estimator). | CODE-VERIFIED: estimator audit §2, rate-book audit A2, saved-costings audit B2 |
| SD-11 | Major | **Recording a tour event refreshes the page.** `recordTourEventAction` and the Estimator/Rate Book dismiss actions call `revalidatePath` for the page the user is on. They fire on first view, on start and on finish, which re-renders server data under the user (Payroll workspace payables re-sync; Estimator may re-merge fixed-worker overhead rows). | CODE-VERIFIED: `app/actions/tour-preferences.ts:72-91`, `app/(dashboard)/owner/estimator/tutorial-actions.ts:19-20`; impact INFERRED |
| SD-12 | Major | **The guide card never changes.** Every page uses `align="full"`, which always renders the same "guide" card: no "Not now", no compact state after the tour is done, completion invisible. On phones the full card sits above every page forever. | CODE-VERIFIED: `components/tours/TourInvitation.tsx:83-126` |
| SD-13 | Minor | **Visual treatment breaks the design rules.** `shadow-2xl`, amber borders, black 55% scrim with blur, saffron glow ring, saffron or orange gradient progress bars, saffron "Next" (Saved Costings, Rate Book), three progress indicators at once (section "2/6", step "4/11", bar), 36px controls on desktop. | OBSERVED (harness screenshots); CODE-VERIFIED: panel classes in all ten tour components; `.agents/rules/weavly-global-premium-design-principles.md` §5, §8, §10 |
| SD-14 | Minor | **Completion is recorded inconsistently.** Estimator and Rate Book record every exit as "dismissed" and never "completed"; Estimator and Rate Book never pass account metadata, so a new device re-invites; Free Saved Costings passes no user id, so nothing is ever stored and every visit calls the server. | CODE-VERIFIED: audit reports (estimator §2, rate-book A2, saved-costings B2) |
| SD-15 | Minor | **Registry fields are unused.** `allowedPlans`, `allowedRoles`, `contentVersion` and `invitationPolicyVersion` are never read; eligibility comes only from page gating. | CODE-VERIFIED: grep for `isTourEligible`, `contentVersion` outside `lib/tours/` returns nothing |
| SD-16 | Minor | **Tour code and copy load even when the tour is never used.** Wrappers import 30–50 KB copy modules per page statically (only Machine Assignments uses `dynamic()`). | CODE-VERIFIED: imports in `components/*/…GuidedTour.tsx`, `components/estimator/CostEstimateTutorial.tsx` |

### 3.3 Data safety

| ID | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| SD-17 | Major | **Sample records escape into real actions outside the tour.** The Rate Book demo row reaches `saveCostRate`, `getCostRateHistory` and `archiveCostRate` through Advanced edit, Activity and Archive (the server rejects the id and the user sees an error). The Saved Costings demo costing's "Use" writes a real estimator draft whose source id is `tour-preview-v2`. | CODE-VERIFIED: `RatesClient.tsx:1103` (no demo guard, unlike 1165/1238/1275/1451); `QuotesClient.tsx:1413-1441` |
| SD-18 | Minor | **The tours themselves are safe.** No tour step can call a business action: replicas have only disabled controls and no handlers; live-page tours guard their handlers; pointer input outside the panel is blocked; the only server write is the preferences action. This must be preserved. | CODE-VERIFIED: all five audits §Data safety; OBSERVED (harness): every run recorded only `recordTourEventAction` (plus `getEstimatorSecondaryData` on Estimator mount, which is page loading, not the tour) |

### 3.4 What works and must be kept

- Strictly opt-in: no tour auto-starts (`__tests__/tour-no-autostart.test.ts`).
- The modal model: the page is inert, pointer input outside the panel is blocked, Escape exits, focus is trapped and restored (`hooks/use-guided-tour.ts`).
- The phone layout: a bottom-sheet panel with the target scrolled into the space above it (`lib/mobile-tour-positioning.ts`); OBSERVED free of overlaps at 390×844 in every tour.
- Sample isolation: replicas and injected samples use non-UUID `tour-*` ids that server schemas reject.
- Worked numbers: most tours teach with a concrete example (₹2/m × 120 m = ₹240) that is checked against the real calculation in tests. This is the strongest teaching pattern in the product.

## 4. The intended experience (shared design rules)

### 4.1 What a Weavly tour is

A tour teaches one job on one page: the shortest path from "I just arrived" to "I can start the real work", and it ends by pointing at the real control that starts that work. It explains what happens and why, never just the name of a button. Sample data is always labeled and real data is never changed. Anything rarely needed goes into a step's "More detail" or into the page's one optional walkthrough.

The design reuses Weavly's own patterns: the rail family in `components/ui/rail.ts`, the `Button` variants in `components/ui/button.tsx`, the dialog overlay colour, the warm tokens in `app/globals.css`, and the worked-number examples already used by the tours.

### 4.2 Panel anatomy

```
┌────────────────────────────────────────────┐
│ Sample · Step 3 of 8                        │  eyebrow
│ Record the supplier's new price             │  title
│ Body: one or two sentences that say what    │  body
│ happens and why it matters.                 │
│ More detail ⌄                               │  optional disclosure
│                                             │
│ Exit guide                    Back   Next   │  footer
└────────────────────────────────────────────┘
```

| ID | Rule |
| --- | --- |
| DR-01 | Container: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (title), `aria-describedby` (body), `tabIndex={-1}`; classes `bg-surface text-ink border border-hairline rounded-2xl shadow-[var(--shadow-card)] p-4`; width `w-[360px] max-w-[calc(100vw-32px)]`; `max-h-[calc(100dvh-32px)]`. `data-testid="guided-tour-panel"`, `data-tour-id`, `data-tour-step`, `data-tour-status`. |
| DR-02 | Eyebrow: `text-[12px] font-semibold leading-tight text-subtle`. Text is `Step {n} of {total}`, prefixed with `Sample · ` on steps whose target is sample content (§5.3 PS-SAMPLE, PS-SAMPLE-DIALOG). No section counters, no uppercase. |
| DR-03 | Title: `<h2>` `mt-2 text-lg font-semibold leading-snug text-ink`. Wraps; never truncated. |
| DR-04 | Body: `<p>` `mt-2 text-base leading-relaxed text-body` (14px). |
| DR-05 | More detail (only on steps whose spec has detail copy): a `<button type="button">` with `aria-expanded` and `aria-controls`, label "More detail" with a `ChevronDown` icon (rotates when open), `mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4`. Expanded text `mt-2 text-sm leading-relaxed text-body`. Collapsed on every step entry. `data-tour-control="more"`. |
| DR-06 | Status line, shown only when needed (§5.2 TC-3, TC-8): `mt-3 text-sm text-muted-foreground`, `role="status"`. |
| DR-07 | Footer `mt-4 flex flex-wrap items-center justify-between gap-2`: left `Button variant="ghost"` "Exit guide" (`data-tour-control="exit"`); right group `Button variant="outline"` "Back" (`data-tour-control="back"`, **not rendered on step 1**) and `Button` (default ink) "Next", which becomes "Done" on the last step (`data-tour-control="next"`, same element). Default size `h-10`; on the compact layout the existing rule `.guided-tour-panel [data-tour-control] { min-height: 44px }` applies. |
| DR-08 | No progress bar, percentage, icons (other than the chevron), badges or gradients in the panel. |
| DR-09 | Sample surfaces show one banner at their top: text from `tourCommonCopy.sampleBanner`; classes `rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink`. Not amber, not repeated per step. |

### 4.3 Spotlight and scrim

| ID | Rule |
| --- | --- |
| DR-10 | Scrim: `bg-ink/45`, the same as `components/ui/dialog.tsx`'s overlay. **No blur.** It covers the viewport except a cutout: the target's rect expanded by 6px on each side (clip-path `polygon(evenodd …)`, the existing technique). |
| DR-11 | Outline: a `pointer-events-none fixed` box at the cutout with `rounded-xl border-2 border-saffron`. This is the tour's only saffron element. No `ring-*`, no shadow, no glow, no pulse. |
| DR-12 | Target unavailable: full scrim, no cutout, no outline, and the status line (TC-8). |
| DR-13 | Z-order stays: portal `z-[100]`, panel `z-[101]`, above Radix dialogs (`z-50`) and rails (`z-30`). Tour-owned sample dialogs render beneath the scrim; the cutout shows the part being explained. |

### 4.4 Placement

| ID | Rule |
| --- | --- |
| DR-14 | Desktop (anything not matching the compact query in DR-16): the panel sits **next to** the spotlight, not in a viewport corner. Candidates in order: right, left, below, above; 16px from the outline and at least 16px from every viewport edge. A candidate is valid only if it overlaps neither the outline box nor the step's context box (the sample dialog or sheet containing the target, §5.3). If none is valid, use the viewport corner whose panel box overlaps the outline and context least (ties: top-right). The rule is the pure function `placeTourPanel` (EC-03). |
| DR-15 | Sample dialogs and sheets at desktop keep the existing reserved-column layout (the dialog is shifted left and narrowed so a 352px column remains on its right). DR-14 then places the panel in that column. |
| DR-16 | Compact layout, the existing query `(max-width: 767px), (max-height: 500px) and (pointer: coarse)`: bottom sheet (existing `.guided-tour-panel` mobile rules: 8px sides, `bottom: max(8px, env(safe-area-inset-bottom))`, `max-height: 46dvh`, radius 20px). The target is scrolled into the band from 72px below the top to 16px above the sheet (existing `trackMobileTourTarget`). |

### 4.5 Motion

| ID | Rule |
| --- | --- |
| DR-17 | When the next target is already fully visible, the outline and cutout move to it with `160ms ease-out` (left/top/width/height). When scrolling is needed, the outline is hidden during the scroll and fades in (`opacity`, 120ms) once the target is ready. |
| DR-18 | When the panel's placement changes it fades out and in (120ms); it never slides across the screen. |
| DR-19 | Programmatic scrolls use `behavior: 'smooth'`, except under `prefers-reduced-motion: reduce`, where they are `'instant'` and all tour transitions are off (the existing reduced-motion rule in `app/globals.css` covers `.guided-tour-*`). |
| DR-20 | No halo, pulse or attention animation anywhere (the Estimator halo is removed, D-08). |

### 4.6 Responsive and translated content

| ID | Rule |
| --- | --- |
| DR-21 | Width is fixed per layout; height grows with content. If the panel would exceed its max height, only the text region (`data-tour-description-scroll`) scrolls; the footer always stays visible (existing CSS). |
| DR-22 | Footer wraps: when the three buttons do not fit on one line, "Exit guide" stays left on the first line and "Back"/"Next" move to a right-aligned second line. No button text is truncated. |
| DR-23 | Every step is checked at 360px panel width in Gujarati and Hindi (§10). Copy that forces the body to scroll at 1280×800 must be shortened. |

### 4.7 Entry points, dismissal and replay

| ID | Rule |
| --- | --- |
| DR-24 | Every in-scope page with a tour has exactly one guide launcher in its guide slot: the left rail from 1440px, inline above the page below that (the existing rail composition). A page may also have **one** optional walkthrough launcher (`railButton`) directly under the guide, only where its page spec defines one. |
| DR-25 | Until the owner starts, finishes or dismisses the tour, the guide slot shows the **guide card**: title "{Page} guide", one benefit sentence, `Start guide` and `Not now`. After any of those, it shows the **compact launcher**: a `railButton` "{Page} guide" (Compass icon), which replays the tour. Exact behavior: §7. |
| DR-26 | Tours never start, resume or advance on their own. Leaving the page ends a tour without recording completion. |

### 4.8 Writing rules

| ID | Rule |
| --- | --- |
| DR-27 | Title: sentence case, at most 48 characters in English, and it states the outcome or decision ("Choose the quality and wage"), not the control's name. |
| DR-28 | Body: one or two sentences, at most 190 characters in English. It says what happens and why it matters. When it names a control it uses the label **exactly as the UI displays it in that language**, in quotation marks (“…”). |
| DR-29 | More detail: at most 260 characters in English; exceptions, corrections and rarely needed facts only. |
| DR-30 | Numbers: one worked example per tour where the page calculates something, matching the sample on screen, formatted `en-IN` (1,000 m; ₹2,000). The example must equal the product calculation and be pinned by a test. |
| DR-31 | Tone: plain, direct, second person, present tense. No "simply", "just", "easily", exclamation marks or marketing adjectives. |
| DR-32 | The sample is disclosed once (eyebrow + banner). Bodies do not repeat "this sample saves nothing". |
| DR-33 | The last step is always a live handoff (PS-HANDOFF): it points at the real control that starts the work and says exactly what to do first. |
| DR-34 | Gujarati and Hindi may run up to 60% longer than English but keep the same number of sentences. |

## 5. Runtime contract

### 5.1 Who owns what

The brief separates five concerns. Each has exactly one owner.

| Concern | Owner | Rule |
| --- | --- | --- |
| Logical position in the tour | The page's `tourStep` state (`null` = no tour) | Only the panel's Next, Back, Exit and Done, and the launchers, change it. |
| Page, tab, dialog and sample state | The page, **derived** from `tourStep` by a pure function per tour (existing pattern: `productionTourSurface`, `configurationTourView`, `costingTourSurface`, …) | Restoring means deriving from `null`. The tour never writes live filters, search, selections, forms or drafts; it shadows them (renders sample data in their place). The only exception is PS-TOUR-STATE (§5.3). |
| Viewport and scroll | The runtime (TC-4) | It restores the scroll positions it changed when the tour ends. |
| Visual spotlight | The runtime (TC-5) | Drawn from the measured target; never from guessed coordinates. |
| Keyboard focus | The runtime; the panel is the only focus owner while a tour runs (§5.4) | The page is `inert` and pointer input outside the panel is blocked (existing `useGuidedTourModal`). |

### 5.2 Step transition contract

Every step change (Start, Next, Back) runs the same sequence. No fixed delays; every wait is a condition with a bound.

| ID | Stage | Rule |
| --- | --- | --- |
| TC-1 | Prepare | Set `tourStep` to the new id. The page renders the derived state (open the sample dialog, swap in samples, switch view). The panel immediately shows the new title and body; the spotlight is hidden. `data-tour-status="preparing"`. |
| TC-2 | Resolve | `resolveTourTarget(anchor, context)` (EC-04): all elements matching the step's anchor that pass `isTourTargetVisible`; if a `context` selector is given, prefer matches inside it; take the first in document order. More than one visible match logs `console.warn('[tour] duplicate target', tourId, stepId)` in development only. |
| TC-3 | Wait | On each animation frame, re-resolve and measure. Ready when the target is connected, visible, non-zero in size and its rect has moved ≤1px for 2 consecutive frames. Budget: 1,500 ms from TC-1. Next and Back stay usable (never disabled); if pressed while preparing, the sequence restarts for the newly requested step. If preparation passes 400 ms, the status line shows "Getting this part ready…" until ready or unavailable. |
| TC-4 | Scroll | Only if the target's rect is not fully inside the safe view: desktop = viewport inset by 16px; compact = the band in DR-16. Scroll the nearest scrollable ancestor (`findTourScrollContainer`) or the window so the target is centred in the safe view (top-aligned if taller). Record each container's original scroll position the first time the tour scrolls it. Then return to TC-3 (same budget). |
| TC-5 | Place | Draw the scrim cutout and outline from the measured rect (DR-10, DR-11). Desktop: position the panel with `placeTourPanel` (DR-14). Compact: bottom sheet (DR-16). |
| TC-6 | Focus and announce | See §5.4. The live region announces "Step {n} of {total}: {title}". `data-tour-status="ready"`. |
| TC-7 | Track | While ready, re-measure (no scrolling) on window resize, `visualViewport` resize/scroll, capture-phase scroll, and `ResizeObserver` on the target and the panel. If the target disconnects or becomes invisible, rerun TC-2 to TC-5 once with a fresh 1,500 ms budget, then TC-8. |
| TC-8 | Recover | If the budget ends without a ready target: `data-tour-status="unavailable"`, full scrim, no outline, and the status line shows the page spec's `unavailable` text for that step, or the shared text "This part isn't showing on your screen right now. You can keep going; nothing has changed." Next and Back keep working. Steps are never skipped automatically. |
| TC-9 | Clean up | On Exit, Done, route change or unmount: cancel frames, observers and listeners; restore inert flags, body/scroller padding and floating-element offsets changed by the tour; restore the recorded scroll positions (instant); restore PS-TOUR-STATE captures; hand focus back (§5.4). Only tour-owned changes are reverted. |

### 5.3 Interaction presets

No step asks the owner to click, type or choose anything on the page (D-04). Steps differ only in what they show.

| Preset | Target | Page state | Notes |
| --- | --- | --- | --- |
| PS-LIVE | A control or region of the live page | Unchanged | Page is inert; nothing on it can be pressed. |
| PS-SAMPLE | Sample content: a replica section or injected `tour-*` records | Samples shown in place of live content | Eyebrow says "Sample"; banner DR-09 at the top of the sample surface. |
| PS-SAMPLE-DIALOG | Inside a sample dialog, sheet or popover the tour opens | Radix component rendered `open`, `modal={false}`, close controls hidden, `onOpenAutoFocus`/`onCloseAutoFocus` prevented, `onOpenChange` ignored while the tour runs | `context` = the dialog content selector; DR-15 layout at desktop. |
| PS-TOUR-STATE | Live page after the tour changes a real view setting (Estimator view mode, Live cost sheet open) | Captured at launch, reapplied per step, restored at TC-9 | Only settings listed in the page spec; never inputs or data. |
| PS-HANDOFF | The real control that starts the work, on the live page | All samples removed; live page visible | Last step only. "Done" ends the tour and focuses that control if it is visible and enabled; otherwise the launcher. If the control is missing, TC-8 applies with the page spec's handoff fallback text. |

### 5.4 Focus and keyboard model

- **Open:** focus moves to the panel container, so assistive technology reads the dialog's title and description.
- **Next/Back by pointer or keyboard:** focus stays on the button that was used. Next and Done are the same element, so focus survives the last-step label change. When Back disappears (step 1), focus moves to Next.
- **Announcement:** a visually hidden `aria-live="polite"` region inside the panel carries "Step {n} of {total}: {title}", updated at TC-6 or TC-8.
- **Keys** (existing handler in `useGuidedTourModal`, kept): Escape exits; Tab and Shift+Tab cycle the panel's enabled buttons, including More detail; ArrowRight = Next and ArrowLeft = Back; Enter on the panel container = Next; Enter or Space on a focused button activates that button only. Keys with Ctrl, Alt or Meta pass through, so browser zoom and shortcuts keep working.
- **Page:** every other `body` child is `inert` (re-applied for portals opened later), and pointer input outside the panel is blocked. The spotlight and scrim are `aria-hidden`.
- **Exit:** focus returns to the control that launched the tour; if it is gone, to the page's guide launcher.
- **Done:** focus moves to the handoff control when it is visible and enabled; otherwise as for Exit.

### 5.5 Edge cases

| Situation | Required behavior |
| --- | --- |
| Sticky headers, fixed bars | Desktop owner pages have no sticky header. Compact: the safe band starts 72px from the top (clears the mobile header). Floating shortcuts inside the target's `[data-tour-floating]` ancestor are lifted above the sheet and restored (existing). |
| Independently scrolling containers (sheets, dialogs, tables) | TC-4 scrolls the nearest scrollable ancestor, never the window when the target lives in a container. Clip the measured rect to every scrollport ancestor (existing `trackMobileTourTarget` logic, reused on desktop). |
| Portals, nested dialogs, dropdowns | Only tour-owned sample surfaces may be open during a tour. Live Radix modals block the launcher (it sits under their overlay), so a tour cannot start over one. |
| Overlay stacking | DR-13. Rails and fixed page elements sit under the scrim; a replica must be laid out inside the workspace width so the rail cannot cover it (SD-08, EC-18). |
| Re-renders, resizing, text wrapping, target movement | TC-7. |
| Back through earlier UI states | State is derived from `tourStep`, so going back re-derives the earlier dialog or sample exactly. |
| User closes a sample dialog | Not possible: close controls are hidden, `onOpenChange` is ignored and pointer input is blocked. Escape exits the whole tour. |
| Route change, browser Back/Forward | The wrapper unmounts; TC-9 runs; nothing is recorded. On return the launcher shows its current state. |
| Mobile software keyboard | No step focuses an input, so the keyboard cannot open. |
| Hidden, missing, disabled or duplicate targets | Hidden or missing: TC-8. Disabled: still a valid target (it is visible). Duplicate: TC-2. |
| Two tours at once | `acquireTour(id)` (EC-15) refuses a second tour while one is open. Launchers are also inert while a tour runs. |

## 6. Data-safety rules

These rules bind every task. A task that cannot meet one stops and escalates (EXECUTOR_PROMPT §6).

| ID | Rule | How it is checked |
| --- | --- | --- |
| DS-01 | No tour code path may call a business server action, API route or RPC. The only permitted server call is `recordTourEventAction` (`app/actions/tour-preferences.ts`). | Source-contract test per tour (imports allow-list); harness records `window.__serverCalls` = only `recordTourEventAction`. |
| DS-02 | Sample records use ids that start with `tour-` (existing) or the existing demo ids (`demo-sample-yarn-rate`). Any handler that can receive such a record and would call a server action, write a draft, navigate with its id or create a document must check `isSampleRecordId(id)` (EC-16) first and show the existing sample toast instead. | Unit test of `isSampleRecordId`; source-contract tests on the guarded handlers listed in each page spec. |
| DS-03 | The tour never writes live UI state that belongs to the user: filters, search, sort, selections, open records, form inputs, reducer state, drafts. It renders samples in their place (shadowing), and restoration is derivation from `tourStep === null`. | Page spec lists the shadowed state; harness/manual check that filters and search survive a tour. |
| DS-04 | PS-TOUR-STATE may change only the view settings its page spec lists, captured once at launch and restored at TC-9. | Test of the restore closure; manual check. |
| DS-05 | Recording a tour event must not refresh the page: no `revalidatePath`, `router.refresh()` or cache invalidation in tour code paths. | Source-contract test on `app/actions/tour-preferences.ts`. |
| DS-06 | Free allowance: tour code must not reference `freeMeter`, `/api/free/calculate`, `complete_free_saved_costing` or anything that submits a Free costing, and no step may render an enabled control that does. | Extend `__tests__/tour-quota-and-data-safety.test.ts` with these real tokens (the current tokens do not exist in the codebase). |
| DS-07 | Drafts: tours never write `weavly:base-production:*`, estimator autosave drafts, `weavly-challan-pending` or yarn pending keys. Sample records must not reach "Use", "Duplicate" or "Save as separate quality" (which write estimator drafts). | Covered by DS-02 guards plus a source-contract test. |
| DS-08 | Consequential actions (save shift, activate quality, assign, confirm dispatch, record payment, settle payroll, correct stock) are only ever **explained** on sample surfaces with disabled controls, or pointed at on the live page while it is inert. Progression never depends on performing them. | Replica tests (existing pattern: every `button`/`input` disabled, no `form`/`a`); harness shows no server calls. |
| DS-09 | Leaving a tour by any path restores only what the tour changed (TC-9). No blanket resets. | Code review at each gate. |

## 7. Invitation, persistence and versions

### 7.1 States

`getTourPresentation(tourId, userMetadata, userId, orgId)` (EC-14) returns:

| State | When | Guide slot shows |
| --- | --- | --- |
| `invite` | No record of `dismissed`, `firstStarted` or `completed` (in account metadata, local mirror or legacy flags) | Guide card: title, benefit, "Start guide", "Not now" |
| `replay` | Any of `dismissed`, `firstStarted`, `completed` | Compact launcher "{Page} guide" |

`firstShown` is still recorded once (for analytics) but no longer changes the state. An impression is not a decision (D-07).

### 7.2 Events

| Event | Trigger | Record |
| --- | --- | --- |
| shown | First render of the guide card in `invite` state | `firstShown` (once) |
| dismissed | "Not now" | `dismissed: true`. The slot switches to `replay` immediately and focus moves to the compact launcher. |
| started | "Start guide" or the compact launcher | `firstStarted: true` |
| completed | "Done" on the last step of the page's core tour | `completed: true`, `completedVersion: <contentVersion>` |

Optional walkthroughs record nothing. Exit records nothing beyond `started`.

### 7.3 Storage

- Account: `auth.users.user_metadata.tour_preferences[tourId]` via `recordTourEventAction` (existing), **without any `revalidatePath`** (DS-05).
- Local mirror: `localStorage['weavly:tour-prefs:v1:{userId}']` (existing). It is written first, so the UI updates immediately and a failed server write leaves correct local state.
- Every `TourInvitation` receives `userId`, `orgId` and `userMetadata={{ tour_preferences }}` from its page's server loader. Missing today on Estimator, Free Estimator, Rate Book and Free Saved Costings (SD-14).
- Legacy flags stay readable and are treated as `dismissed`: `user_metadata.cost_estimate_tutorial_dismissed`, `user_metadata.ratebook_tutorial_dismissed`, `localStorage['weavly:cost-estimate-tutorial:v1:{org}:{user}']` and `localStorage['weavly:ratebook-tutorial:v1:{org}:{user}']`. They are no longer written. `dismissCostEstimateTutorial` and `dismissRatebookTutorial` are removed in their feature tasks.

### 7.4 Versions

- `contentVersion` in the registry becomes `'v2'` in the task that ships a redesigned tour. It is stored as `completedVersion`.
- Changing content never re-invites an owner who dismissed, started or completed a tour (`invitationPolicyVersion` stays `'v1'`). Rationale: tours are opt-in; the compact launcher is always there.
- `allowedPlans` and `allowedRoles` stay in the registry as documentation and are asserted by the existing eligibility tests; runtime eligibility remains the page's `AccessGate` and server checks.

## 8. Engineering contracts

### 8.1 Architecture in one paragraph

Keep the existing shape (page owns `tourStep`; a tour component renders a portal; `hooks/use-guided-tour.ts` owns modality) and finish consolidating it. One presentational panel, one spotlight, one step runtime (readiness, scroll, placement, focus) and one composition component replace the ten hand-built panels and the three bespoke engines. Pages keep their own step lists, copy, anchors and derived UI state. No new dependencies, no backend changes, no new persistence, no demo-data system.

Why not a rewrite or a tour library: the existing hooks already implement the hard modal parts and are tested; the defects are in placement, readiness, presentation and content, which are small, testable functions. A third-party tour library would add a dependency, fight the Radix dialogs and the rail layout, and still need every page's derived state.

### 8.2 File-level contracts

"New" and "proposed" files do not exist yet. Line numbers refer to `f7cff98`.

| ID | File / symbol | Change | Interface (proposed) | Must not change | Verified by |
| --- | --- | --- | --- | --- | --- |
| EC-01 | `lib/tours/tour-types.ts` | Add `'daily-sheet'` to `TourId`. Remove `TourEmphasis` and the `emphasis` field. Add `TourStepSpec`. Add `completedVersion?: string` to `TourPreferenceRecord`. | `interface TourStepSpec<S extends string = string> { id: S; anchor: string; context?: string; kind: 'live' \| 'sample' \| 'handoff'; detail?: boolean }` | Existing `TourId` values and record fields | `tsc`; updated `tour-i18n-parity`, `tour-invitation-lifecycle` tests |
| EC-02 | `lib/tours/tour-registry.ts` | Remove `emphasis`; add `daily-sheet` (Base, owner, v2); set `contentVersion: 'v2'` per tour as it ships | unchanged exports | `isTourEligible` semantics | existing eligibility tests |
| EC-03 | `lib/tours/placement.ts` (new) | Pure placement for DR-14 | `placeTourPanel({ target: Rect, context?: Rect \| null, panel: { width: number; height: number }, viewport: { width: number; height: number }, gap = 16, margin = 16 }): { left: number; top: number; side: 'right' \| 'left' \| 'below' \| 'above' \| 'corner' }` | — | new unit tests with fixtures (§10.2) |
| EC-04 | `lib/tours/target-readiness.ts` (new) | TC-2, TC-3, TC-7 helpers; reuse `isTourTargetVisible` and `findTourScrollContainer` from `lib/tutorial-target.ts` | `resolveTourTarget(anchor: string, context?: string): HTMLElement \| null`; `watchTourTarget({ resolve, onReady(el, rect), onUnavailable(), budgetMs = 1500, stableFrames = 2 }): () => void` | `lib/tutorial-target.ts` exports and tests | new unit tests with a fake `requestAnimationFrame` |
| EC-05 | `lib/tours/tour-scroll.ts` (new) | TC-4 and its restore | `scrollIntoSafeView(target, safe: Rect, reducedMotion: boolean, record: ScrollRecord)`; `restoreScroll(record: ScrollRecord)` | — | unit tests (jsdom-free: pass a fake element/scroller) |
| EC-06 | `hooks/use-guided-tour.ts` | Keep `useGuidedTourModal` (focus/keyboard per §5.4: add focus-to-Next when the used button disappears; keep everything else). Add `useTourStep`. Mark `useGuidedTourPlacement` deprecated; delete it in GT-16 once unused. | `useTourStep({ tourId, step, spec, panel, compact, language }): { status: 'preparing' \| 'ready' \| 'unavailable'; rect: Rect \| null; placement: Placement \| null }` | `useGuidedTourModal` behavior pinned by `guided-tour-focus.test.ts` | existing + new tests; harness |
| EC-07 | `hooks/use-mobile-tour.ts`, `lib/mobile-tour-positioning.ts` | Replace the fixed settle timers (`[120, 350]`) with the EC-04 stability check; keep padding reservation, floating lift and their restore | unchanged signatures | behavior pinned by `mobile-tour-positioning.test.ts` except the timer lines | updated test; harness at 390×844 |
| EC-08 | `components/tours/TourPanel.tsx` (new) | DR-01 to DR-09. Keeps the class `guided-tour-panel` and the `guided-tour-controls` footer class (existing CSS and the harness use them). | `TourPanel({ tourId, stepId, title, body, detail?, extra?: ReactNode, index, total, sample, status, statusText?, isLast, onExit, onBack, onNext, panelRef, style })`; `extra` renders between body and More detail (used only for Workers' pay-path choice) | — | SSR render test (anatomy, labels, attributes) |
| EC-09 | `components/tours/TourSpotlight.tsx` (new) | DR-10 to DR-13, DR-17. Keeps the classes `guided-tour-portal`, `guided-tour-backdrop` and `guided-tour-highlight`. | `TourSpotlight({ rect: Rect \| null, animate: boolean })` | — | SSR render test |
| EC-10 | `components/tours/GuidedTour.tsx` (new) | Composes portal + `TourSpotlight` + `TourPanel` + `useGuidedTourModal` + `useTourStep` + `useMobileTour`; completion (§7.2); `acquireTour`; live region | `GuidedTour<S>({ tourId, steps: TourStepSpec<S>[], step: S, copy: (id: S) => { title; body; detail?; unavailable? }, onStepChange(next: S \| null), onDone?(), launcher: RefObject<HTMLElement>, returnFocus?: RefObject<HTMLElement>, recordCompletion?: boolean })` | — | tests + harness |
| EC-11 | `lib/i18n/tour-common.ts` (new) | Shared control and status copy in en/gu/hi (§9.3) | `tourCommonCopy: Record<Language, TourCommonCopy>` | — | parity test |
| EC-12 | `components/tours/TourInvitation.tsx`, `hooks/use-tour-invitation.ts` | §7.1 states; "Not now"; compact launcher for `align="full"`; remove halo | `TourInvitation` props unchanged except `guideCard` removed (unused) | 44px targets; `data-tour-control` values `take-tour` / `quiet-tour` / `dismiss` | `tour-invitation-lifecycle.test.ts` (updated deliberately) |
| EC-13 | `lib/tours/session-coordinator.ts`, `.tour-halo-*` CSS, `tour-session-coordinator.test.ts` | Delete (halo removed, D-08) | — | — | tsc, lint |
| EC-14 | `lib/tours/tour-preferences.ts`, `app/actions/tour-preferences.ts` | `getTourPresentation`; `completedVersion`; remove every `revalidatePath` | `getTourPresentation(...): 'invite' \| 'replay'` | legacy read paths | `tour-preferences-and-actions.test.ts` (updated deliberately) |
| EC-15 | `lib/tours/active-tour.ts` (new) | One tour at a time | `acquireTour(id: TourId): boolean`; `releaseTour(id: TourId): void` | — | unit test |
| EC-16 | `lib/tours/sample-ids.ts` (new) | DS-02 | `isSampleRecordId(id: string \| null \| undefined): boolean` (true for `tour-` prefix and the listed demo ids) | existing sample id formats | unit test |
| EC-17 | `app/globals.css` (tour block, lines ~1433-1647) | Panel/scrim/outline per §4; remove blur; replace the broken `[data-costing-tour-dialog]` width rule with the DR-15 reserved column; keep the compact rules; delete halo keyframes | — | rail composition rules (lines ~550-1070) | harness at all four viewports |
| EC-18 | Replica wrappers: `components/production/ProductionGuidedTour.tsx`, `components/stock/StockGuidedTour.tsx`, `components/dispatches/DispatchGuidedTour.tsx`, `components/payroll/PayrollGuidedTour.tsx` | Render the replica inside the live page's workspace class (`production-overview-workspace`, `stock-workspace-shell`, `dispatch-workspace-shell`, `payroll-workspace-shell`) so rails cannot cover it (SD-08); PS-HANDOFF unhides the live page on the last step | `hidden={step !== null && !isHandoff(step)}` | live page stays mounted while hidden (keeps user state) | harness 1440×900: no rail paint over the target |
| EC-19 | Every feature wrapper | Load the tour runtime and copy with `next/dynamic(() => import(…), { ssr: false })` on first launch; keep the launcher and invitation copy static | — | launcher position and markup | source-contract test per feature |
| EC-20 | `lib/tours/tour-text.ts` (new) | LR-02 token and value filling for tour copy | `formatTourText(text: string, controls: Record<string, string>, values?: Record<string, string \| number>): string` replaces `{c:name}` from `controls` and `{name}` from `values`; an unknown token throws in development and renders the raw token in production (so a missing label is caught by tests) | — | unit test; every page's copy test runs all three languages through it |
| EC-21 | `components/tours/ReplicaGuidedTour.tsx` (new, built in GT-07) | One wrapper for the five replica tours (Dispatches, Fabric/Yarn Stock, Payroll, Production, Daily Sheet): guide slot (+ optional walkthrough launcher), live children kept mounted and `hidden` while a non-handoff step runs, replica rendered inside the page's workspace class, `GuidedTour` | `ReplicaGuidedTour<S>({ tourId, workspaceClassName, railClassName, railLabel, steps, handoffStepId, copy, renderReplica(step), walkthrough?, userId, orgId, userMetadata, children })` | live children never unmounted | GT-07 tests; reused and extended (not forked) by GT-08..GT-12 |

### 8.3 Anchors

- New anchors use one attribute: `data-tour-anchor="<page>.<name>"` (for example `data-tour-anchor="dispatch.new"`). Existing anchors that a page spec keeps (`data-costing-tour`, `data-production-tour`, `data-stock-tour`, `data-dispatch-tour`, `data-payroll-tour`, `data-configuration-tour`, `data-machines-tour`, `data-workers-tour`, `data-ratebook-field`, `data-estimator-field`, `data-tutorial-section`) stay as they are, because tests and CSS use them. Page specs list every anchor as *existing* or *proposed*.
- An anchor must resolve to exactly one visible element in every state the step supports. If a control renders in two places (inline and rail), the anchor goes on both and TC-2's preference rule picks the visible one.
- Adding a `data-tour-anchor` attribute to a live component is the only change allowed to live business components, unless a page spec says otherwise.

### 8.4 Performance when inactive

- Only the launcher, `lib/tours/tour-preferences.ts` and `lib/i18n/tour-invitations.ts` load with the page (EC-19).
- No tour listeners, observers or timers run while `tourStep === null`.
- Sample data (`make…TourExample…`) is created only while a tour is open or where it already exists for the page's empty state.

## 9. Localization

### 9.1 Rules

| ID | Rule |
| --- | --- |
| LR-01 | Every tour string exists in `en`, `gu` and `hi` in the page's copy module, typed `Record<Language, …>` so a missing key fails `tsc`. Tests assert parity, native script, and the DR-27/DR-28 length limits for English. |
| LR-02 | **Controls are named through tokens, never retyped.** Copy writes `{c:name}`; the page's `tourControlLabels(t)` map resolves each token with **the same translation key the live control renders with**. So the tour always shows exactly what the button shows. |
| LR-03 | **Every control a core step names must render through a translation key.** Where the live control is a hard-coded English literal (displayed as English, or word-by-word under the runtime fallback; §9.4), the feature task replaces that literal with a key in `lib/i18n/locales/{en,gu,hi}.ts` whose values come from the page spec's control table. This is the only live-UI text change the tour tasks make, and every such value is flagged for native review. |
| LR-04 | Page names are the navigation labels (§9.2). |
| LR-05 | Gujarati and Hindi copy contains no English words except units and codes (m, kg, ₹, %, PDF, CSV, UPI, GST), the product name Weavly, and tokens. |
| LR-06 | Digits are Western (1,000), matching the UI. Worked examples use the same numbers in all three languages. |
| LR-07 | Sample names are localized (§9.2). |
| LR-09 | Copy keys = the step id without its page prefix (`est-`, `rb-`, `fs-`, `ys-`, `pr-`, `pra-`, `pd-`, `ds-`, `mc-`, `wk-`/`wkp-`/`wks-`, `ma-`), with `.title`, `.body`, `.detail` suffixes and plan variants (`.paid`, `.free`, `.base`, `.existing`, `.empty`, `.unavailable`). Where a page keeps an old step id, its spec states the mapping explicitly. |
| LR-08 | No copy may claim review by a native speaker. Every page spec marks its gu/hi copy "native review pending"; the N review at G2 (§10.3) clears it. |

### 9.2 Glossary

Established UI terms (source: `lib/i18n/locales/{en,gu,hi}.ts`, unless noted). Tours use these; where the UI is inconsistent, the choice below is the decision.

| Concept | English | Gujarati | Hindi | Note |
| --- | --- | --- | --- | --- |
| Cost Estimator | Cost Estimator | ખર્ચ અંદાજક | लागत अनुमानक | `navigation.estimate` |
| Saved Costings | Saved Costings | સાચવેલી કોસ્ટિંગ | सेव की गई कॉस्टिंग | `navigation.costings`; replaces three variants in tour copy |
| Yarn Rate Book | Yarn Rate Book | યાર્ન રેટ બુક | यार्न रेट बुक | `navigation.rates` |
| Production / Overview / Daily Sheet | Production / Overview / Daily Sheet | ઉત્પાદન / ઝાંખી / દૈનિક શીટ | उत्पादन / अवलोकन / दैनिक शीट | `navigation.*`; "Overview & Looms" is retired |
| Machine Assignments | Machine Assignments | મશીન ફાળવણી | मशीन आवंटन | |
| Machines, Workers | Machines, Workers | મશીનો, કારીગરો | मशीनें, कारीगर | |
| Fabric Stock / Yarn Stock | Fabric Stock / Yarn Stock | કાપડનો સ્ટોક / યાર્નનો સ્ટોક | कपड़े का स्टॉक / धागे का स्टॉक | `navigation.yarnStock`; fabric by analogy |
| Dispatches | Dispatches | ડિસ્પેચ | डिस्पैच | `challan.new` = નવો ડિસ્પેચ / नया डिस्पैच |
| Payroll | Payroll | પેરોલ | पेरोल | |
| quality | quality | ક્વોલિટી | क्वालिटी | not ગુણવત્તા/गुणवत्ता |
| costing | costing | કોસ્ટિંગ | कॉस्टिंग | |
| warp / weft | warp / weft | તાણા / ભરણ | ताना / बाना | `estimator.*Components`; the tours' વાણા is replaced |
| yarn | yarn | યાર્ન | धागा (inside the page name: यार्न) | |
| loom / machine | loom / machine | લૂમ / મશીન | लूम / मशीन | "machine" for records, "loom" for the physical weaving position |
| worker | worker | કારીગર | कारीगर | not વણકર/बुनकर |
| day / night shift | day shift / night shift | દિવસની શિફ્ટ / રાતની શિફ્ટ | दिन की शिफ्ट / रात की शिफ्ट | |
| metres | m | મીટર (m in numbers) | मीटर (m in numbers) | |
| piece-rate wage | wage | મજૂરી | मजदूरी | "વેતન/वेतन" is reserved for salary contexts only in Workers |
| salary | salary | પગાર | वेतन | |
| advance (Upaad) | advance | ઉપાડ | उपाड़ | `navigation.advances` |
| deduction / recovery | deduction / recovery | કપાત / વસૂલાત | कटौती / वसूली | |
| overhead | factory overhead | ફેક્ટરી ઓવરહેડ | फैक्ट्री ओवरहेड | |
| margin | margin | માર્જિન | मार्जिन | |
| draft | draft | ડ્રાફ્ટ | ड्राफ्ट | |
| customer | customer | ગ્રાહક | ग्राहक | there is no party master in Dispatches |
| lot / taka | lot / taka | લોટ / તાકા | लॉट / ताका | |
| receipt (dispatch) | receipt | પ્રાપ્તિ | प्राप्ति | not પ્રાપ્તી or રસીદ |
| guide | guide | માર્ગદર્શિકા | मार्गदर्शिका | `challan.guideTitle` pattern |
| sample | sample | નમૂનો / નમૂના | नमूना | |
| Sample fabric / worker / loom / customer / yarn | … | નમૂના કાપડ / કારીગર / લૂમ / ગ્રાહક / યાર્ન | नमूना कपड़ा / कारीगर / लूम / ग्राहक / धागा | |

### 9.3 Shared tour copy (EC-11)

| Key | English | Gujarati | Hindi |
| --- | --- | --- | --- |
| `exit` | Exit guide | માર્ગદર્શિકા બંધ કરો | मार्गदर्शिका बंद करें |
| `back` | Back | પાછળ | पीछे |
| `next` | Next | આગળ | आगे |
| `done` | Done | પૂર્ણ | हो गया |
| `stepOf` | Step {n} of {total} | પગલું {n} / {total} | चरण {n} / {total} |
| `sample` | Sample | નમૂનો | नमूना |
| `sampleBanner` | Sample — nothing here is saved or sent. | નમૂનો — અહીં કંઈ સાચવાતું કે મોકલાતું નથી. | नमूना — यहाँ कुछ भी सेव या भेजा नहीं जाता। |
| `moreDetail` | More detail | વધુ વિગત | और जानकारी |
| `preparing` | Getting this part ready… | આ ભાગ તૈયાર થઈ રહ્યો છે… | यह हिस्सा तैयार हो रहा है… |
| `unavailable` | This part isn't showing on your screen right now. You can keep going; nothing has changed. | આ ભાગ અત્યારે તમારી સ્ક્રીન પર દેખાતો નથી. તમે આગળ વધી શકો છો; કંઈ બદલાયું નથી. | यह हिस्सा अभी आपकी स्क्रीन पर नहीं दिख रहा। आप आगे बढ़ सकते हैं; कुछ नहीं बदला है। |
| `announce` | Step {n} of {total}: {title} | પગલું {n} / {total}: {title} | चरण {n} / {total}: {title} |
| `guideTitle` | {name} guide | {name} માર્ગદર્શિકા | {name} मार्गदर्शिका |
| `startGuide` | Start guide | માર્ગદર્શિકા શરૂ કરો | मार्गदर्शिका शुरू करें |
| `notNow` | Not now | હમણાં નહીં | अभी नहीं |
| `launcherAria` | Start the {name} guide | {name} માર્ગદર્શિકા શરૂ કરો | {name} मार्गदर्शिका शुरू करें |

All gu/hi values: native review pending (LR-08).

### 9.4 Evidence: how Base pages display English literals today

OBSERVED (harness): the runtime translator (`lib/i18n/context.tsx` `translateSourceText` with the strict Base-plan fallback) turns untranslated English into word-by-word output or leaves it in English. Examples for Gujarati: "Save shift" → "સેવ કરો shift"; "Activate for Production" → "ચાલુ કરો માટે ઉત્પાદન"; "Print sheet", "Audit Inventory", "Add yarn", "Link costing" → unchanged English. Many live clients also mark their root `data-i18n-skip="true"` (`QualityStockClient`, `YarnStockClient`, `ChallansClient`, `RatesClient`, `QuotesClient`, `BaseAssignmentWorkspace`, `MachinesRegister`, `WorkersRegister`), so their hard-coded literals show in English. Full probe output: [`docs/guided-tours/audit/label-probe.md`](guided-tours/audit/label-probe.md). This is why LR-02/LR-03 exist; the wider problem is product issue PI-13.

## 10. Verification

### 10.1 Evidence types

| Type | Proves | Does not prove |
| --- | --- | --- |
| Unit / source-contract tests (Vitest, node) | Logic (placement, readiness, preferences), copy parity and limits, import restrictions (DS-01/06/07), disabled replica controls | Visual quality, real focus behavior, screen-reader output |
| SSR render tests (`renderToStaticMarkup`, existing pattern) | Panel anatomy, attributes, labels per language | Interaction |
| Harness runs (§1.4) | Geometry (no overlap, target on screen), focus stays in panel, scroll restored, server calls, screenshots per viewport and language | Real data, real shell, auth, real devices |
| Owner QA run (`npm run dev` on the shared QA project, a test org per plan) | The real page with real data | Anything not exercised |
| Senior review (REVIEW_PROMPT) | Independent comparison of diff, behavior and this spec | — |
| Native-language review | Gujarati and Hindi quality | — |

A required check that was not run is **UNVERIFIED**, never PASSED.

### 10.2 Commands that exist today

Run through the isolation wrapper (it blanks credentials; `CLAUDE.md` and the refactor brief require it):

```bash
# type check
node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false
# lint (repo gate; currently clean)
node scripts/performance/isolated-command.mjs npx eslint --max-warnings=0 .
# focused tests
node scripts/performance/isolated-command.mjs npx vitest run __tests__/<file>
# whole suite
node scripts/performance/isolated-command.mjs npx vitest run
```

The tour subset (41 files at baseline):

```bash
node scripts/performance/isolated-command.mjs npx vitest run $(grep -lE "Tutorial|-tour|Tour[A-Z]|TourInvitation|guided-tour|data-[a-z-]*tour" __tests__/*.ts __tests__/*.tsx)
```

Harness: see [`docs/guided-tours/harness/README.md`](guided-tours/harness/README.md). It lives in the git-ignored `scratch/` folder while in use.

A production build is required only at the final gate, in a credential-free copy of the working tree (the executor does not commit, so `git archive HEAD` would miss the work):

```bash
rm -rf /tmp/weavly-build && mkdir -p /tmp/weavly-build
git ls-files -co --exclude-standard | tar -cf - -T - | tar -xf - -C /tmp/weavly-build
ln -s "$PWD/node_modules" /tmp/weavly-build/node_modules
(cd /tmp/weavly-build && node "$OLDPWD/scripts/performance/isolated-command.mjs" npm run build --ignore-scripts)
```

Never run `npm run build` or `npm start` in the repository root: they load `.env.production.local` (CLAUDE.md).

### 10.3 Gates

| Gate | When | Passes by |
| --- | --- | --- |
| G0 | GT-00 | Executor: baseline commands reproduce §1.2, harness runs one existing tour. |
| Task gate | End of every task | Executor, objectively: the packet's Definition of Done, its commands green, harness scenarios recorded, no new lint/tsc errors, unrelated tests unchanged. |
| **G1** | After GT-03 (foundation + Saved Costings) | **Senior review** (REVIEW_PROMPT) **and** owner QA run of Saved Costings on Free and Lite/Base test orgs **and** a native-language spot check of the Saved Costings copy (to calibrate tone before eleven more pages). GT-04 records the outcome; nothing after GT-04 starts until G1 is PASSED. |
| **G2** | GT-17 (final) | Senior review of the whole program, owner QA run of every tour, native-language review of all gu/hi tour copy and new UI keys, production build in a credential-free copy. |

### 10.4 Test matrix

**Per-step acceptance.** Every step of every page spec must meet the following at each of the four viewports of §1.4 (1440×900 en, 1280×800 hi, 1024×768 en, 390×844 gu), in addition to any step-specific acceptance in its page spec. Every tour is run in the harness and checked for: no panel/outline overlap; outline fully on screen, or the step declared `unavailable` with its recovery text; Next and Back work to both ends; Escape exits and restores focus and scroll; only `recordTourEventAction` calls; no console errors. Variants that need their own harness scenario are listed in each page spec (for example Free vs paid, empty vs populated, piece vs salary worker). Reduced motion: one scenario per task with `reducedMotion: 'reduce'` in the Playwright context, checking that scrolling is instant and no transition runs.

## 11. Decisions

| ID | Decision | Rationale and tradeoff |
| --- | --- | --- |
| D-01 | Extend the existing runtime; do not rewrite or adopt a tour library. | The modal/focus parts work and are tested; the failures are placement, readiness, presentation and content. A library adds a dependency and still needs every page's state. |
| D-02 | Page decisions as in §2. | Every operational page has a decision; exclusions follow the brief. |
| D-03 | **Reference tour: Saved Costings.** | It runs on every plan (Free, Lite, Base), has live-page samples, three tour-owned dialogs (library, export, comparison), an optional walkthrough, a bespoke engine to migrate (like Estimator and Rate Book), a measured panel-over-dialog defect and a sample-leak defect. It exercises more of the shared runtime than any other single tour without the Estimator's risk. |
| D-04 | **Guided demonstrations only: no interactive steps.** | Owners with little software experience, consequential actions and drafts make "click the real button" steps risky. The tour shows state itself; the last step hands off to the real control. Tradeoff: less hands-on practice. |
| D-05 | Keep each tour's demonstration method (replica, injected samples, live page). Fix replica drift with label tokens (LR-02), lay replicas out in the workspace (EC-18) and end with a live handoff. | Replicas exist because consequential dialogs cannot be shown with real data safely. Replacing them with live components in a sample mode would touch every business component. |
| D-06 | Place the panel beside the target (DR-14). | Corner docking covered targets and put the panel up to 800px away (SD-07). The rule is a pure, tested function. |
| D-07 | Guide card until the owner decides; then a compact launcher. "Not now" added. | Opt-in and discoverable; an impression alone is not a decision. Replaces the permanent card (SD-12). |
| D-08 | Remove the Estimator halo. | The only animated nudge, drawn as an orange glow that the design rules exclude; the guide card already invites. |
| D-09 | Remove the Estimator field guide. | 43+ steps, one per field of every row: the "tour of every button" the brief rules out. Its useful facts move into the core steps' More detail. |
| D-10 | Production becomes two tours: "Set up production" (Overview) and "Record a shift" (Daily Sheet, new `TourId` `daily-sheet`). The details track is dissolved. | The Daily Sheet is the most-used page and could not launch a guide; each page now teaches its own job. |
| D-11 | Stock audit: remove the Fabric tour from the audit page now; the audit tour is specified but BLOCKED on PI-06 and PI-07; the stock tours each gain one step about "Audit Inventory". | A tour must not teach a page that mixes audits across dates or cannot be read in Gujarati/Hindi. |
| D-12 | The Estimator tour teaches **Quick** view, the default; it mentions Detailed once. | Owners return to Quick after the tour (SD-04, estimator audit §4.3). |
| D-13 | Controls named by tours render through translation keys shared with the tour (LR-02, LR-03). | The only way to guarantee a Gujarati or Hindi owner can find the button the tour names. Tradeoff: small live-UI text changes, each flagged for native review. |
| D-14 | Tour events never refresh the page (DS-05). | Refreshes re-render server data under unsaved work (SD-11). Local mirror plus account metadata already keep the state. |
| D-15 | Execution order: foundation → Saved Costings (G1) → Cost Estimator → Rate Book → Dispatches → Fabric Stock → Yarn Stock → Payroll → Production → Daily Sheet → Machines → Workers → Machine Assignments → cleanup → final (G2). | All-plan tours first (largest audience); Dispatches next because it introduces the replica handoff that the other Base replica tours reuse; the register tours last because they are already closest to the target. |
| D-16 | Resolved design conflicts from CLAUDE.md: panel shadow `--shadow-card` (conflict 2: stricter rule); controls `h-10`, 44px on touch (conflict 1); tour primary actions ink, saffron only for the outline (conflict 3); no nested cards in the panel (conflict 4). | Follows `.agents/rules` as CLAUDE.md instructs. |
| D-17 | Payroll's unreachable `full` variant is removed from tour code and its tests (the tier was retired). | Dead content with retired features (WhatsApp slips, statutory deductions). |
| D-18 | The persistent demo rows on empty accounts (Rate Book demo yarn, Saved Costings demo costing) stay, but every handler is guarded (DS-02) and their "nothing is saved" claims are corrected. | Existing product behavior; the leaks are the defect, not the rows. |

## 12. Product problems found (not fixed by this program unless a task says so)

These came out of the audits. They are outside the tour scope; the owner decides whether and when to fix them. Tours are written so they do not teach the broken behavior.

| ID | Sev | Problem | Evidence | Tour impact |
| --- | --- | --- | --- | --- |
| PI-01 | Major | Payroll collects a payment date that is never saved; its default is a UTC date. | `BasePayrollSettlementWorkspace.tsx:147,228-234`; `BaseSettlementSchema` (`production/actions.ts:107-120`) has no date | Payroll tour does not claim the date is recorded. |
| PI-02 | Major | Payroll payables are computed up to today regardless of the selected period; completing a period does not check open obligations. | `production/loaders.ts:559`; payroll audit §5 #1 | Payroll tour teaches the current period only. |
| PI-03 | Major | "View log", Payroll's readiness "Review" and Daily Sheet `returnTo` open Overview instead of the Daily Sheet. | `lib/base-production-navigation.ts:52-56` (no `tab=production`); production audit P2 | Tours do not send owners through these links. |
| PI-04 | Unknown (possible Blocker) | Changing date or shift on the Daily Sheet may switch the view to Overview (`replaceState` to `/owner/production`). | INFERRED: `BaseDailyProductionSheet.tsx:178` | GT-12 entry condition (§13 U-06). |
| PI-05 | Major | Activating a quality with an incomplete recipe shows "All required yarns are now available!" and loops. | `BaseActiveQualities.tsx:211-218, 875-903` | Production tour explains the yarn requirement. |
| PI-06 | Major | Stock audit: changing the date mixes two audits; the adjustment shown can differ from the one applied. | `InventoryAuditClient.tsx:89-99`; stock audit §3.4 | Blocks the audit tour (D-11). |
| PI-07 | Major | Stock audit page is English-only, with no translation hooks. | stock audit §3.5 | Blocks the audit tour. |
| PI-08 | Major | Fabric movement kinds `audit_adjustment` and `production_reversal` show raw keys. | `lib/quality-stock.ts:16`; `QualityStockClient.tsx:392` | Fabric tour does not name them. |
| PI-09 | Minor | Fabric stock "tracking started" date is never shown although data and strings exist. | `lib/quality-stock.ts:23`; `en.ts:182-186` | Fabric tour's tracking step removed. |
| PI-10 | Major | Dispatch pending-retry key is not scoped by organization and has no discard. | `ChallansClient.tsx:141-161` | None. |
| PI-11 | Major | Rate Book "Confirm All" confirms hidden (filtered) rows without asking; the row confirm is one click; a confirm dialog is unreachable. | `RatesClient.tsx:1307-1346, 2216` | Rate Book tour warns before pointing at review actions. |
| PI-12 | Major | A retained Free grant renders two Saved Costings pages, rails and tours on `/owner/quotes`. | `owner/quotes/page.tsx:36-38` | Saved Costings spec defines which tour launches (GT-03). |
| PI-13 | Major | Many Base labels display in English or word-by-word in Gujarati/Hindi. | §9.4 | LR-03 fixes only the labels tours name. |
| PI-14 | Minor | Machine cards never show availability; register loaders ignore some query errors. | production audit §3.5, §4.5 | None. |
| PI-15 | Minor | Assignments hide links whose machine has no current job; its replace confirmation is English. | production audit §2.5 | None. |
| PI-16 | Minor | The deduction dialog says deductions are taken "during settlement", but they join capped recovery. | payroll audit §3 #10 | Payroll tour states the correct rule. |
| PI-17 | Minor | Estimator Quick view and the Live cost sheet contain hard-coded English. | estimator audit §4 | LR-03 covers the labels the tour names. |

## 13. Unknowns and blockers

| ID | Unknown | Where we looked | What it blocks | Resolution |
| --- | --- | --- | --- | --- |
| U-01 | Real-app rendering with real data, sidebar and auth | No `.env*` in this container; harness only | Nothing in implementation; G1/G2 evidence | Owner QA runs at G1 and G2. |
| U-02 | Screen-reader output (VoiceOver, TalkBack, NVDA) | Source only | Nothing in implementation | Reviewer or owner check at G1 (reference) and G2. |
| U-03 | Real iOS Safari and Android behavior of the bottom sheet (visual viewport, safe areas) | Harness emulates 390×844 only | Nothing | Owner device check at G2. |
| U-04 | Whether the production database has the migration that moved yarn deduction to production (SD-01) | Migrations are the source of truth per CLAUDE.md; production not inspected | GT-07's Dispatch copy acceptance | Owner confirms at G1; copy follows the migrations until then. |
| U-05 | Native quality of the Gujarati and Hindi copy in this package | Written here, not reviewed by a native speaker | G2 acceptance only | N review at G1 (spot) and G2 (all). |
| U-06 | PI-04: does changing date/shift on the Daily Sheet jump to Overview? | Code reading only | GT-12 step `ds-shift` copy | GT-12 entry condition: owner checks on QA; the page spec gives copy for both outcomes. |
| U-07 | Rate Book tour on a phone in the harness (the 390×844 Gujarati run timed out) | Harness | Nothing | GT-06 re-runs it with the new runtime. |
