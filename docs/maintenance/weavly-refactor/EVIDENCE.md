# Weavly refactor program — evidence

Revision for everything below: `d748008e9977df666a7b3354069c24f91e91acac` (2026-09-26), unless a row says otherwise. Labels: **VERIFIED** (read in code or command output), **INFERRED** (strong indirect evidence), **UNKNOWN**. Check status: PASS / FAIL / BLOCKED / NOT RUN.

Bulky artifacts are not tracked. They live in the session scratchpad `…/scratchpad/baseline/` (`tsc.log`, `vitest.log`, `lint.json`, `build.log`, `bundle.json`, `orphans.tsv`, `orphans-enriched.txt`), which is **not durable**. The commands below regenerate them.

## E1. Baseline checks

All checks run through `scripts/performance/isolated-command.mjs`. It passes an allowlisted process environment, blanks every key named in `.env*` files, points Supabase at `127.0.0.1:9` with placeholder keys, blanks Sentry/Upstash, and sets `RUN_LIVE_SUPABASE_TESTS=0`. The shell had no service variables exported (checked by name only). There are no git hooks in `.git/hooks`. Host: Node 24.11.1, npm 11.6.2, macOS.

| Check | Command (after the wrapper) | Status | Result |
| --- | --- | --- | --- |
| Types | `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS | exit 0, 34.8 s |
| Tests | `npx vitest run --reporter=dot` | PASS | 228 files; 1,989 passed, 1 skipped (`finance.test.ts` live test); 16.7 s |
| Lint | `npx eslint --max-warnings=0 --format json` | FAIL (pre-existing) | 3 errors, 81 warnings. Errors: `FreeUsageCard.tsx:50` preserve-manual-memoization, `navigation-disclosure.tsx:30` and `use-gutter-dock.ts:120` set-state-in-effect. Warnings by area: app 34 unused-vars + 18 any; `__tests__` 18 unused-vars + 1 any; components 6 unused-vars; lib 3 any; hooks 1 any. Babel notes that `EstimatorClient.tsx` exceeds 500 KB |
| Build | export copy (`git archive HEAD`, 0 `.env*` files, symlinked `node_modules`) → `npm run build --ignore-scripts` | PASS | compiled in 80 s, TypeScript 35.8 s, 53 static pages, 136 s wall. Google Fonts fetched read-only; Sentry upload disabled |
| Bundle | `node scripts/performance/application-bundle-report.mjs .next` | PASS | see E6 |
| Authenticated browser flows, RLS/RPC against a DB, Razorpay, WhatsApp, service worker offline | — | NOT RUN | no isolated backend or test accounts. `npm run dev` points at shared QA and a local build at production |
| Field Web Vitals | — | BLOCKED | the only RUM sink is production table `web_vital_samples` (`app/api/analytics/web-vitals/route.ts`), fed only by `EstimatorClient` via `lib/web-vitals.ts`. Reading it needs explicit approval |

CLAUDE.md records 1,988 passed at `c29dfe15`; this revision has 1,989. The suite is 228 files, down from 267 at the 2026-09-14 cleanup (`77a511b6`). Since then 61 test files were deleted and 23 added. All 61 deletions are in the Full Suite retirement `25933ba5`, which also deleted 112 app/lib/component/hook files. Whether every deleted test covered only retired behavior was not re-verified in Phase 0 (UNKNOWN; Phase 1 input). At least one deleted test also guarded surviving code. `p0-locked-tenant-boundary.test.ts` (read at `25933ba5^`) asserted `lib/auth.ts` and migration `20260626051352_harden_locked_tenant_writes.sql` alongside now-deleted supervisor/owner action files. Locked-tenant guards keep some current coverage (`assertOrgWritable` in 2 test files, `check_org_lockdown` in 1). `access_code` appears in 5 app/lib files and in **0** current tests, since `p0-access-code-boundary.test.ts` was deleted.

## E2. Stack and repository map (VERIFIED)

- **Installed versions** (`npm ls --depth=0`): next 16.2.12 (webpack builds), react/react-dom 19.2.7, typescript 5.9.3, vitest 4.1.8, eslint 9.39.2, @supabase/supabase-js 2.95.3, @supabase/ssr 0.8.0, supabase CLI 2.109.1, @tanstack/react-query 5.90.21, zod 4.3.6, decimal.js 10.6.0, jspdf 4.2.1, dexie 4.3.0, framer-motion 12.34.0, @sentry/nextjs 10.69.0, @ducanh2912/next-pwa 10.2.9, razorpay 2.9.6, tailwindcss 4.1.18. Extraneous: `@emnapi/*`, `@tybys/wasm-util`, `@img/sharp-wasm32`.
- **Size:** 1,948 tracked files. App source is 545 TS/TSX files: 48 `page.tsx`, 24 route handlers, 17 action files, 22 `'use server'` and 201 `'use client'` modules. There are 185 files in `lib/`, 158 in `components/`, 229 in `__tests__/`, 130 in `scripts/`, 300 migrations and 11 edge functions plus `_shared`.
- **Routes:**
  - Free: `/free`, `/free/{account,billing,costings,settings}`.
  - Lite: `/owner/{estimator,quotes,rates,settings,billing}`.
  - Base adds `/owner/{production,production/daily-sheet,assignments,machines,workers,payroll,stock,stock/yarn,stock/audit,dispatches,dispatches/[id]/print,operations,setup,data-export}`.
  - Auth: `/login`, `/signup`, `/verify`, `/forgot-password`, `/reset-password`, `/onboarding{,/plans,/base}`, `/auth/{callback,confirm,signout,auth-code-error}`.
  - Public: `/`, `/plans`, `/privacy`, `/terms`, `/refund-policy`, `/privacy-request`, `/security-incident`, `/install`, `/offline`, `/locked`, `/feature-archived`, `/owner/settings/dpa`, `/track/[token]`.
  - Archived via `lib/phase1-scope.ts`: `/admin`, `/owner/settings/audit`, `/track`. The `supervisor` role still exists in `proxy.ts:18,402,469` and `lib/auth.ts:22` and is redirected to `/feature-archived`; no supervisor routes remain. `next.config.ts` still sets no-store headers for `/supervisor/*` (harmless leftover).
- **API routes:** analytics (plan-events, web-vitals); billing (checkout-script, checkout-state, create-order, invoice/[id], receipt/[id], redeem-referral-year, status, verify-payment); free (account, calculate, costings, events, status); referrals (apply, generate); subscriptions (auto-renew, create); telemetry (logout, sign-in); webhooks/razorpay.
- **Edge functions (Deno):** check-pace-index, monthly-brief, retry-failed-messages, send-{access-code, advance-receipt, daily-brief, deadline-alert, lockdown-alert, payslip}, whatsapp-{summary, webhook}. Whether these are deployed is UNKNOWN. Several serve retired supervisor/Full Suite flows (INFERRED from their names).
- **CI/deploy:** Vercel `bom1` (`vercel.json`). The only GitHub workflows are production backup and restore drill. **No CI test, type or lint gate.**
- **PWA:** custom worker `worker/index.ts`. Runtime caching in `next.config.ts` is network-only for documents, RSC, API and same-origin GETs, and cache-first for static assets (`weavly-static-assets-v2`, 160 entries, 30 days).

## E3. Test suite profile (VERIFIED)

- 228 test files. **135 read source text** (`readFileSync`/`readFile`); 83 of those also import `lib/`. **46 read migrations.** 18 render with `renderToStaticMarkup`. None use a DOM, interaction or browser.
- Most text-asserted files: `EstimatorClient.tsx` (53 test files), `estimator/actions.ts` (31), `QuotesClient.tsx` (28), `RatesClient.tsx` (20), `factory-cost-profile.tsx` (12), `rates/actions.ts` (12).
- **Consequence:** any restructuring of the estimator, quotes or rates breaks dozens of text contracts even when behavior is unchanged. It also leaves real behavior (rendered output, interactions, SQL execution) unverified. Phase 1 must add behavioral protection first.
- **A database behavior harness existed until 2026-09-24.** `25933ba5` removed the `test:stock-db` script and `scripts/qa/quality-stock-db.mjs` (readable at `25933ba5^`). That harness refused non-loopback hosts, created a throwaway database, stubbed `auth.uid()`/`auth.jwt()`/`auth.role()`, the `auth`/`storage` schemas and the Supabase roles, replayed migrations in order, then called RPCs such as `save_base_daily_production_reviewed` and `record_quality_stock_adjustment` as `authenticated` with JWT claims. Local tooling: PostgreSQL 17.11 (`/usr/local/bin/{postgres,pg_ctl,psql}`), Docker CLI, `pg` 8.23.0 installed. No jsdom/happy-dom/Testing Library/Playwright packages are installed; a Playwright Chromium cache exists at `~/Library/Caches/ms-playwright`, and `vite` 8.0.16 is present transitively.
- Browser fixture harnesses exist in `scripts/qa/{challan,navigation,stock,yarn}-browser/` and `scripts/qa/fixtures/base-continuity`. The 2026-09-14 cleanup found `scripts/qa/base-fixed-salary-preview.mjs` BLOCKED (Vite cannot resolve `server-only`). The others were not checked in Phase 0.

## E4. Environment and script hazards (VERIFIED by reading, nothing run)

| Item | Risk | Status |
| --- | --- | --- |
| `.env.production.local` in repo root | `next build`/`next start` load production | Keep. The isolated wrapper plus export copy is the safe path |
| `supabase/config.toml` and `supabase/.temp/*` (tracked since the initial commit) | CLI linked to production; the tracked files show project ref and pooler host (no password in the URL, checked by pattern only) | REVIEW (untrack is a Phase 3/5 hygiene item) |
| `scripts/purge-data.js`, `purge-users.ts`, `purge_data.mjs`, `purge_db_qa.mjs`, `supabase/purge_data.sql` | service-role deletes against `.env.local` (QA) | Do not run. REVIEW for archive or guard |
| `scripts/{apply_migration,check_*,find_owner,inspect_tables,test_*,verify_orders_query,create-admin}.*`, root `test.mjs`, `test_whatsapp.ts`, `test_db.ts` (1 line) | one-off service-role/QA probes, last touched Mar–Jun 2026, no references except docs | REVIEW (Phase 3) |
| `scripts/qa/*` (86 files) | release-evidence probes; `provisioning-smoke`, `batch7-release-runtime-evidence` and several fixture `actions.ts` are referenced by tests | Keep; do not run without approval |
| `output/` (29 MB, 338 tracked files), `outputs/`, `qa-artifacts/`, `audits/` | tracked QA evidence; repository weight | KEEP as evidence; archive policy is a Phase 5 decision |
| Git state | 17 stashes, ~28 worktrees (6 prunable under `/private/tmp`), about 100 local branches | user-owned. Never touch |

## E5. Maintainability leads (VERIFIED facts, candidate actions)

| ID | Evidence | Why it matters | Candidate phase/type |
| --- | --- | --- | --- |
| M1 | `app/(dashboard)/owner/estimator/EstimatorClient.tsx`: 8,228 lines, 519 KB, 53 imports, ~84 state hooks, 25 effects, 44 memo/callbacks, 3 exhaustive-deps suppressions (`:3561`, `:4105`, `:4231`); shared by `/owner/estimator` and `/free` (`app/free/FreeClient.tsx`) | the highest-risk file, hardest to change, pinned by 53 text tests | P1 protection first, then P2 decomposition in small slices |
| M2 | `estimator/actions.ts` 2,809 lines; `QuotesClient.tsx` 2,495; `RatesClient.tsx` 2,323; `production/actions.ts` 1,268 | the same pattern | P2 after P1 |
| M3 | Seven tour components `components/tours/{Configuration,Machines,Workers,Payroll,Production,Stock,Dispatch}Tutorial.tsx` (~145–170 lines each) plus `SavedCostingsTutorial`. `diff Machines Workers` shows 54 changed lines; each has its own `makeInert` MutationObserver | ~900 lines of near-duplicate focus/scroll/inert logic | P2 (shared tour runner). Tours anchor to DOM; needs P1 tour checks |
| M4 | 9 `window.confirm` calls (`BaseDailyProductionSheet.tsx` ×6, `BaseAssignmentWorkspace.tsx:293`, `MachineEditor.tsx:51`, `WorkerEditor.tsx:57`) while `components/ConfirmActionDialog.tsx` exists | inconsistent, unstyled, not localized consistently on mobile | P2 UI consistency; separately approved because the UX changes |
| M5 | Hindi/Gujarati: `lib/i18n/context.tsx` `LegacyTextLocalizer` walks `document.body` and observes all mutations (childList, characterData, attributes) when not English. Phrase maps: `legacy.ts` (1,794 lines), `legacy-generated.ts` (2,245), `runtime.ts` (1,368), plus typed locale dictionaries (~1,515 lines each) and 13 feature phrase files | two translation systems; the DOM rewrite can fight React reconciliation and costs work on every keystroke-driven DOM change | P4 measure (hi/gu vs en INP) before any P2 change. High risk |
| M6 | 55 non-entry source files with no application importers (`orphans.tsv`). Examples: `lib/commercials/*`, `lib/actions/order-assignment.ts`, `lib/generate-payslip.ts`, `lib/owner-analytics.ts`, `lib/dashboard-trend.ts`, `lib/factory-today-checklist.ts`, `lib/whatsapp*.ts`, `lib/payroll-{statutory,read-models,manual-adjustments}.ts`, `components/settings/{factory-cost-profile,template-manager}.tsx` (orphaned by `25933ba5`, still asserted by 9 and 2 test files), `components/ui/{avatar,calendar,checkbox,form,input-otp,radio-group,scroll-area}.tsx` | dead weight and misleading tests; overlaps the prior cleanup's C07–C14 | P3, deletion protocol per batch. Import-graph evidence alone is insufficient |
| M7 | `qrcode`, `qrcode.react`, `@types/qrcode`: no source imports (prior cleanup; not re-verified) | dependency weight | P3 dependency batch |
| M8 | Lint baseline: 3 errors, 81 warnings; no CI gate | new warnings can land unnoticed | P1 (changed-files gate) or a separately approved fix of the 3 hook errors |

## E6. Performance baseline and leads (lab, local build; not field data)

Page-entry JS is measured with `application-bundle-report.mjs`: deduplicated page-entry chunks, gzip per file, excluding layout-only and async chunks. This is not observed transfer.

| Route | Raw bytes | Gzip bytes | 2026-09-11 gzip (`bundle-after.json`) |
| --- | --- | --- | --- |
| `/free` | 2,011,825 | 574,845 | 561,732 |
| `/owner/estimator` | 1,854,785 | 523,033 | 510,080 |
| `/owner/payroll` | 1,048,979 | 291,474 | 369,267 |
| `/owner/production` and `/daily-sheet` | 1,031,480 | 287,561 | 218,709 |
| `/owner/assignments` | 982,498 | 273,277 | — |
| `/owner/quotes` | 855,396 | 244,909 | 230,621 |
| `/owner/settings` | 786,421 | 225,290 | — |
| `/owner/rates` | 660,634 | 188,577 | 177,063 |
| `/login` | 547,798 | 160,843 | 152,962 |
| `/plans` | 434,370 | 122,309 | 112,452 |

**P-LEAD-1 (VERIFIED chain, the size saving is INFERRED):** chunk `static/chunks/b44f3945-…js` (325,709 raw / 100,429 gzip) is Next's browser `crypto` fallback (crypto-browserify). It contains pbkdf2, secp256k1, createCipheriv, publicEncrypt, DiffieHellman, RIPEMD and asn1/bignum. It appears only on `/owner/estimator` and `/free`. The chain: `EstimatorClient.tsx:151` imports the pure `summarizeCostingInputChanges` from `lib/costing-save-trust.ts`, whose line 1 is `import crypto from 'crypto'`. That import exists only for the server-side `buildCostingInputFingerprint` (`:71` sha256), which `estimator/actions.ts:20` uses. The expected saving is about 100 KB gzip on the two heaviest routes; this needs a before/after build to confirm. Behavior-preserving fix: move the fingerprint function behind a server-only module and keep both exports' contracts. Covered by `costing-save-trust.test.ts`, `lite-historical-immutability.test.ts`, `lite-quick-detailed-parity.test.ts` and `sprint17-costing-quotation-hardening.test.ts` (text assertions will need a deliberate update).

**P-LEAD-2:** `/owner/production` grew by 68,852 gzip bytes since 2026-09-11. The contributing chunk is not identified yet (chunk `7020-…` 57,931 gzip contains radix plus estimator/payroll strings).

**P-LEAD-3:** the hi/gu DOM localizer (M5). The per-mutation cost during typing is UNKNOWN; measure with a fixture before changing anything.

**P-LEAD-4:** EstimatorClient render cost per keystroke is UNKNOWN. The 2026-09-11 audit measured engine CPU only (3.11 ms median per input after the fix), not React render/INP.

**Field Web Vitals (production, read 2026-09-26 with user approval).** Three read-only aggregate `SELECT`s ran via the Supabase connector against project `vzhwahudircrpgtitwzd` (Postgres 17.6.1.063): the column list, then aggregates grouped by metric/route/device/language/tier and by metric/segment. No row-level data or ids were retrieved.

- **Scale:** 408 samples from **8 orgs**, 2026-08-31 … 2026-09-25. All samples are `scope = document` on route **`/owner/estimator` only**; only `lib/web-vitals.ts` in `EstimatorClient` reports.
- **Composition:** almost all `en`, one `gu` sample. Tiers include `lite`, `base` and retired `premium`.
- **No `/free` samples exist**, consistent with AS-09 (the CHECK constraint rejects `plan_tier = 'free'`). This is INFERRED; it could also mean no Free usage.

| Metric | Segment | n | orgs | p75 | share rated good | Target (p75) |
| --- | --- | --- | --- | --- | --- | --- |
| LCP | desktop + tablet | 176 | 8 | **3,772 ms** | 0.66 | ≤ 2,500 ms |
| LCP | mobile | 25 | 3 | 2,304 ms | 0.84 | ≤ 2,500 ms |
| INP | desktop + tablet | 119 | 8 | **1,996 ms** | 0.52 | ≤ 200 ms |
| INP | mobile | 20 | 3 | 112 ms | 0.90 | ≤ 200 ms |
| CLS | desktop + tablet | 64 | 7 | 0.081 | 0.75 | ≤ 0.1 |
| CLS | mobile | 4 | 2 | 0.000 | 1.00 | ≤ 0.1 |

Per-segment extremes: desktop Lite INP p75 2,912 ms (n = 49), desktop Base INP p75 1,704 ms (n = 50), tablet Lite LCP p75 6,348 ms (n = 7).

**Limits:** this is a small, pilot-scale sample from few orgs, possibly including internal QA accounts (UNKNOWN). It covers one route and is mixed across tiers and releases. The p75 values are indicative, not statistically reliable per segment, and mobile counts are too small for conclusions. Still, desktop estimator INP around 2 s at p75 is far beyond target and makes **EstimatorClient interaction cost (P-LEAD-4) the leading Phase 4 target**, ahead of bundle size.

No browser lab timings were captured in Phase 0. Public pages are not the bottleneck candidates, and authenticated pages need an isolated fixture or backend.

## E7. Documentation inventory (preliminary classification for Phase 5)

| Set | Files | Last change | Preliminary class | Note |
| --- | --- | --- | --- | --- |
| Root `CLAUDE.md`, `design.md`, `.agents/rules/*` | 3 | 2026-09-26 | KEEP/UPDATE | CLAUDE.md lists 7 unresolved instruction conflicts; design.md has stale Source Files |
| `docs/general/README.md` | 1 | 2026-09-24 | KEEP (canonical index) | only 16 lines |
| Root `TECHNICAL_ANALYSIS.md`, `TESTING_GUIDE.md`, `USER_WORKFLOWS.md` | 3 | 2026-09-24 (banner only) | ARCHIVE candidates | self-labeled as describing an earlier product |
| Root `SECURITY.md`, `SECURITY_HARDENING_REPORT.md`, `BROWSER_WORKFLOW_QA_REPORT.md`, `WHATSAPP_INTEGRATION_GUIDE.md` | 4 | May–Jun 2026 | REVIEW | security notes may still be partly valid; WhatsApp depends on edge function deployment (UNKNOWN) |
| Root `Vastra_Bug_Testing_Guide.pdf`, `vastra_test_guide.docx` | 2 | — | REVIEW | pre-rebrand ("Vastra"; see migration `20260409000000_rebrand_to_loomi.sql`) |
| `docs/*.md` (25 sprint plans, readiness reports, audits) | 25 | Jun–Sep 2026 | mostly ARCHIVE/REVIEW; KEEP `deployment-typescript-cache-incident.md`, `public-plans-and-policies.md` | many describe superseded sprint scope |
| `docs/features/` | 13 | 2026-09-25 | UPDATE/REVIEW | includes retired scope (orders/market runs, party ledger, supervisor floor dashboard) |
| `docs/pilot-remediation/` (incl. `DOMAIN_INVARIANTS.md`) | 38 | 2026-09-08 | KEEP as history; mine invariants into the current register | mixes retired commercials/orders scope |
| `docs/free-tier/`, `docs/performance/`, `docs/navigation-reorganization/`, `docs/maintenance/cleanup-2026-09-14/` | 56 / 71 / 14 / 13 | Sep 2026 | KEEP (evidence) | logs, JSON and screenshots are bulky but referenced |
| `docs/engineer-handoff/`, `docs/base-plan-simplification/` | 5 / 6 | 2026-09-05 | REVIEW | CLAUDE.md flags parts of engineer-handoff as earlier scope |
| `docs/reference/` (vendor proposal PDF + notes), `docs/legal/`, `docs/qa/` | 2 / 1 / 4 | Jul–Sep 2026 | KEEP | legal runbook is operational |

## E8. Costing invariant and coverage register

Source: a read-only investigator report at `d748008e`. Rows marked ✔ were independently re-checked in code by the lead; the others are the investigator's code readings (VERIFIED by that reading, not re-checked). Coverage types: **a** = independent or literal expected values; **b** = circular/tautological; **c** = source text; **d** = none.

| ID | Invariant (current code) | Evidence | Coverage |
| --- | --- | --- | --- |
| C-INV-01 | Warp kg/100m = ends × denier × 100 / 9,000,000 | `lib/estimator.ts:608` `calcWarpYarnKg` | a `estimator.test.ts` |
| C-INV-02 ✔ | Weft formula kg/100m uses length **100/N**, N = number of weft rows (deliberate per comment `:1590-1593`); manual rows are not scaled | `estimator.ts:1594-1596`, `:637` | a/b (identical rows only) |
| C-INV-03 | Ne→denier D = 5315/Ne, 0 when Ne ≤ 0 | `estimator.ts:75-85,143` | a |
| C-INV-04 | Yarn cost/100m = baseKg × rate × (1+GST%) × (1+adj%); warp adj = crimp+waste, weft adj = waste | `estimator.ts:722,1554-1561,1610-1617` | a |
| C-INV-05 | Row waste null ⇒ global default; explicit 0 ⇒ 0; no stacking | `estimator.ts:1552-1553,1608-1609` | a |
| C-INV-06 | Manual mode baseKg = max(0, manualKg); manual weft still needs picks | `estimator.ts:1549-1551`; `estimator-validation.ts:364` | a |
| C-INV-07 ✔ | Weave cost uses Σ picks of all weft rows × per-pick rate (named "paisa", used as ₹/pick); worker rate uses the same Σ at 2dp | `estimator.ts:1664-1667`, `:197-218` | a |
| C-INV-08 | Warping/sizing on total warp final kg; legacy defaults asymmetric (missing warpingMode ⇒ outsourced if rate > 0; missing sizingMode ⇒ in_house) | `estimator.ts:1672-1684` | a (explicit modes only), **d** for defaults |
| C-INV-09 | Winding/processing/finishing only when section on; commission/transport when toggle on **or** value > 0 (warning) | `estimator.ts:581-590,1687-1693`; validation `:485-514` | a |
| C-INV-10 | Non-null `overheadOverridePerM` applies in **either** overhead mode; else Σ monthly items / monthlyOutputM (0 if output ≤ 0) | `estimator.ts:833-849,1512-1533,1716-1718` | a |
| C-INV-11 | Price = (P+T)/(1−C−M); landed = P+T+price×C; C+M ≥ 100% ⇒ invalid, price 0; break-even = (P+T)/(1−C) | `estimator.ts:851-948` | a |
| C-INV-12 | Decimal precision 20, ROUND_HALF_UP globally; helpers return JS numbers between stages (not Decimal end to end) | `estimator.ts:89`; `finance.ts:4` | a (golden literals) |
| C-INV-13 | Rounding only in `buildCostingResult`, staged: per-metre 2dp; totals = rounded per-metre × qty re-rounded; profit = rounded S − rounded L; commission/m from unrounded price | `estimator.ts:956-1141` | a (literals); **d** for .xx5 float edges |
| C-INV-14 | Versions `estimator_v3_2026_08`, `INR_HALF_UP_2`, `snapshotSchemaVersion` 2 (missing ⇒ 1) | `estimator.ts:97-98,1067,1394` | a |
| C-INV-15 | Snapshot reader rejects non-finite/negative, production ≤ 0, price ≤ 0, commission ≥ 100, margin outside ±100, cross-field mismatch > 0.02 (0.05 totals/break-even/margin) | `estimator.ts:1355-1501,1182-1190` | a/b |
| C-INV-16 | Engine never validates; `validateEstimatorSnapshot` holds limits (≤20 rows, denier 0.1–5000, width 10–300 cm, crimp ≤ 50, waste ≤ 100, C+M < 100); readiness hides money on boundary failure | `estimator-validation.ts:36-73,400-564,607-748` | a (some c) |
| C-INV-17 ✔ | Paid save: owner role; server recomputes and requires client production cost and price to **equal** server values after 2dp rounding (no tolerance) | `estimator/actions.ts:295-317,1567-1587` | **d** |
| C-INV-18 | New saves always `record_kind = costing`; `canUseProduction` hard-coded false; client value ignored; RPC forces it too | `actions.ts:1498-1504`; `costing-workspace.ts:40-46` | a/c |
| C-INV-19 | Server attestation of exact payload (service role, 10-min, single use); save RPC consumes matching attestation and enforces key allowlist | migration `20260825060131:13-190` | c |
| C-INV-20 | Versioning RPC: owner + paid tier + org not locked; replay by `client_request_id`; stale `expected_updated_at` / newer version errors; advisory lock; `no_change` on equal fingerprint; version = source+1 or latest+1 | migration `20260801174038:189-531` | c |
| C-INV-21 | Immutability trigger blocks DELETE and non-metadata UPDATE; bypass only via `app.account_deletion='true'` | migration `20260808115518:61-110` | c/b |
| C-INV-22 | Legacy readers prefer parsed snapshot, else scalar columns (0 = unavailable); never recompute; reconciliation tolerance 0.01 | `saved-costings.ts:96-153`; `costing-reconciliation.ts` | a |
| C-INV-23 | Customer export shows only price, qty, value, customer/reference/validity, notes, GST notice; breakdown/rates/commission/margin/break-even internal only; export requires `verified` status | `estimator-export.ts:168-222,237-250,384-423` | a/c (labels only, not numbers) |
| C-INV-24 | Quick vs Detailed is view state only; engine unaffected | `EstimatorClient.tsx:3758,3808-3813` | **b** (tautological) |
| C-INV-25 | Drafts: localStorage per org+user, schema v1, discarded on calculation-version mismatch, 7-day max age, `writeSequence` order, `pendingSaveRequest` tied to `clientRequestId` | `estimator-drafts.ts:9-12,173-278` | a |
| C-INV-26 | Free is server-authoritative: strict zod input, server-side validation and warning acknowledgement, same engine, token bound to engine version and inputs, debit+save in one DB transaction | `free-service.ts:66-97`; `free-estimator-input.ts`; migration `20260908205605` | a (mocks) |

**Costing gaps:** C-INV-17 has no test. The save RPC, attestation, `no_change`, stale-version handling and the immutability trigger have text-only coverage. Quick/Detailed parity is tautological. Multi-weft formula vs weave cost is never cross-checked. Reopen mapping (`buildDraftStateFromQuote`) is untested for `warpingMode`/`overheadMode`/override. Half-up rounding at .xx5 float boundaries is untested. The customer export does not assert that internal *numbers* are absent.

**Costing conflicts and suspected bugs** (IDs CS-n; SUSPECTED unless noted; none fixed):

| ID | Severity (guess) | Finding |
| --- | --- | --- |
| CS-1 ✔ | High if multi-weft formula costings are used | Weft kg treats each row's PPI as whole-fabric PPI over 100/N m, while weave cost and worker rate add PPIs across rows (component convention). For N ≥ 2 formula rows one of the two is off by factor N. The old `DOMAIN_INVARIANTS.md` weft formula has no 1/N. **Product decision required**; characterize current behavior, do not change it |
| CS-2 ✔ partial | Medium | Quote payload stores `sizing_mode` but not `warping_mode`, and stores `overhead_override_per_m` only when `overheadMode === 'direct'` (`actions.ts` payload ~`:1645`); the engine applies a non-null override in either mode. Reopen (`QuotesClient.tsx` ~`:275-290`) infers `warpingMode` from rate > 0 and `overheadMode` from override presence. INFERRED: reopen and re-save can change economics without user edits and defeat the `no_change` fingerprint |
| CS-3 ✔ | **Medium, security** | `lib/free-service.ts:32-45` `signing()` falls back to a hard-coded literal key in production when `WEAVLY_FREE_SIGNING_KEYS` lacks the key id. Fails open to a secret visible in the repo. **Owner confirmed 2026-09-26: `WEAVLY_FREE_SIGNING_KEYS` is not set in Vercel production, so production signs Free tokens with the public fallback literal.** The owner is setting a key (guide in STATUS). Impact INFERRED as limited: quota and input binding are enforced server-side in `complete_free_saved_costing` and the server-computed binding, so token forging mainly bypasses issuance/expiry gating. Escalated; separately scoped fix (fail closed) plus a config check by the user |
| CS-4 | Low–Medium | Fingerprint omits calculation version (`costing-save-trust.ts:33-71`); after an engine change, same inputs return the old snapshot as `no_change` (INFERRED) |
| CS-5 | Low | Audit `logisticsCostPerMeter` counts transport only when the toggle is on (`estimator.ts:1802`); price includes it when value > 0. Only the persisted audit is affected |
| CS-6 | Low | `validateCostingExportInput` blocks all non-`verified` statuses first, so the `unreconstructable` exemption and the "review required" branch are unreachable (fails closed) |
| CS-7 | Low | Export "Base yarn calculation" shows rate without GST next to a base cost that includes GST (`estimator-export.ts:374-381` vs `estimator.ts:1560`) |
| CS-8 | Low | Immutability-trigger bypass via `app.account_deletion` (INFERRED not settable by PostgREST clients) |
| CS-9 | Low / product | Attestation tier check is a no-op for the service role (`20260924085030:79-83`); the save RPC does the real check; expired Base subscriptions still satisfy `base` (`:108-122`) — needs a product decision |
| CS-10 | Low | Paid save ignores unacknowledged warnings server-side (Free enforces them); version bump discards drafts including an unconfirmed `pendingSaveRequest`; template saves compare `updated_at` as strings (`actions.ts:1166`) vs parsed dates (`:1794`) |
| Doc drift | Low | `DOMAIN_INVARIANTS.md:192-209` omits GST/1/N/rounding/versions; `estimator.ts` header (`:9-16`), `:296` and `:472` comments are stale; CLAUDE.md says `record_kind` comes "from live entitlement" (it is hard-coded) and gives the RPC pattern `search_path = ''` (these RPCs use `pg_catalog, public`) |

**Costing duplication leads:** D1 the `estimator_quotes` payload is built three times in `actions.ts` (~`:897-990`, `:1622-1694`, ~`:2630-2700`); `requireFactoryWorkflow` (`:291-293`) always errors, and the quotation branch `:1781-1894` is unreachable. D2 estimate-rebuild logic appears in four places (`QuotesClient.buildDraftStateFromQuote`, `saved-costings.buildSavedQualityRecipeState` `:406`, EstimatorClient mappers ~`:300-440`, `normalizeSaved*Rows`). D3 yarn breakdown lines are recomputed in three places. D4 duplicate cross-field tolerance checks (`estimator.ts:1427-1456` vs validation `:598-716`). D5 four divergent validation surfaces (Free zod, `validateEstimatorSnapshot`, RPC allowlist, `validateFactoryCostProfile`). D6 pick sum is computed five times. D7 `ensureCostingSnapshotsForSavedQualities` (`actions.ts:1026`) has only a test consumer (not claimed unused).

## E9. Database behavior capability probe (VERIFIED, 2026-09-26)

Scratch script `…/scratchpad/dbprobe/replay.mjs` (not in the repo). It uses a fresh `initdb` cluster in the scratchpad, trust auth, listening on **127.0.0.1:55432 only** (no Unix socket) under `LC_ALL=C`. Stubs: roles `anon`, `authenticated`, `service_role` (bypassrls), `supabase_auth_admin`, `authenticator`; schemas `auth` (`uid()`, `jwt()`, `role()`, `users`), `storage`, `extensions` (+`pgcrypto`), and no-op `cron.schedule`/`unschedule`/`alter_job`/`job`. Then all migrations are replayed in filename order.

- Result: **296/300 applied in ~2 s**. Skipped: the 4 WhatsApp schedule migrations requiring real `pg_cron`/`pg_net` (`20260401030000`, `20260402090000`, `20260402100000`, `20260402120000`). The final schema has 127 public tables, **all 127 with RLS enabled**, and 174 public functions.
- Local PostgreSQL 17.11 vs hosted 17.6.1.063 (`supabase/.temp/postgres-version`).
- Limits: PostgREST pre-request hooks (`ALTER ROLE authenticator SET pgrst.db_pre_request`), JWT verification, `pg_net` and real cron do not execute. The cluster was stopped and its data directory deleted after the probe.
- Conclusion: RPC/RLS/trigger behavior tests with synthetic data are feasible locally with no new dependency (`pg` 8.23.0 is installed).

## E10. Base operations invariant and coverage register

Source: a read-only investigator report at `d748008e` (it ran 12 existing tests in 2 files, all passing). ✔ = re-checked by the lead. Migration references use date prefixes (e.g. `0920` = `20260920000000_unified_inventory_audit_architecture.sql`).

| ID | Invariant (current code) | Evidence | Coverage |
| --- | --- | --- | --- |
| O-INV-01 | Every ops RPC derives org from `profiles(auth.uid(), role='owner')`. Production/payroll gate on `private.base_production_core_access` (owner + Base); stock/challan/yarn on `private.quality_stock_access` (also checks `access_revoked_at`) | `20260831150000`; `20260908171502:51-57` | c |
| O-INV-02 | Stock/yarn/challan/audit RPCs call `assert_org_not_locked`; production/payroll/assignment RPCs do **not** and rely on `requireWritableOrg` in the server action | `production/actions.ts:217`; migrations 0830100000, 0901110004, 0903155014, 0913–0915 | **d** |
| O-INV-03 | Fabric metres are added at production commit via deferred constraint trigger `quality_stock_sync` → `reconcile_quality_stock` (delta vs `production_meters` baseline); negative balance rejected (22023) | `20260908171502:107-198`; `0920:342` | c |
| O-INV-04 | Since `0920`, **yarn is deducted at production**, not dispatch: `round(Δm × kg_per_100m / 100, 9)`; all yarns checked before any deduction; `production_stock_lots` row created; dispatch yarn trigger dropped | `0920:110,342-470`; `lib/i18n/yarn-stock.ts:4` | c |
| O-INV-05 | Quality activation requires every recipe yarn to exist with > 0 kg; freezes `yarn_recipe_snapshot`; idempotent per costing (advisory lock) | `0920:201-340` | c |
| O-INV-06 | Dispatch confirm: draft only → reconcile → atomic `meters >= sent` decrement → FIFO lot allocation + movement. Receipt/payment/refund/adjustment never move stock. `reverse_dispatch` needs `sent`, no financial events, `stock_present`; restores fabric and lots, not yarn | `20260922135042:60-88,128-144` | d (RPC) |
| O-INV-07 | Challan: client UUID `id`; `number` = 'DC' + 12-digit **global** sequence at first draft save (not per tenant, gaps possible); `version` optimistic lock (40001); `request_id` unique per org with payload match | `20260908235614:5-8,55-60` | a (lib only) |
| O-INV-08 | Challan `balance` generated = `round(chargeable × rate, 2) + adj − paid`; paid/charges ≥ 0; refund ≤ credit; each entry reversible once | `0908:19,29`; `0922:113-127,149` | d (RPC) |
| O-INV-09 | Fabric opening once; correction is an absolute total checked against expected balance (40001); 2dp; request id required | `0908:200-238` | a/c |
| O-INV-10 | Yarn opening once; receipt > 0; correction checks `expected_kg`; 3dp input, numeric(24,9) storage; request id required | `20260912131633:80-125` | a |
| O-INV-11 | Stock/yarn movements, challan events and audit tables are append-only for `authenticated` (SELECT only); writes via SECURITY DEFINER RPCs | `0908:62`; `0912:50-57`; `0920:99-106` ✔ | c |
| O-INV-12 | Daily sheet: one batch per (org, date, shift), one entry per (batch, worker), one allocation per (entry, machine, job); date ≤ Surat today; request receipt + `expected_updated_at` (40001) + advisory lock | `20260830100000`; `0901110004:453`; `0903155014` | c/a |
| O-INV-13 | Paid work is frozen: rows of paid workers immutable; backdated inserts rejected; a batch finalizes when **any** worker in it is settled; reversal un-finalizes only if no paid worker remains | `0901110004:600-633,1007`; `20260830120000`; `0903155014` | c |
| O-INV-14 | Piece rate gross = Σ metres × `worker_rate_snapshot` rounded once to 2dp; snapshot = job rate or worker rate if 0. Fixed salary = Σ per month/rate segment `round(salary × days / month_days, 2)`. The TS mirror lives in `lib/base-production-core.ts:448`, `lib/base-salary.ts:24` | `settle_base_worker_payroll` (0901110004 rewritten by a DO block in 0903162305); `base_salary_lines` | a (TS mirror only) |
| O-INV-15 | Period start = last paid `period_end` + 1, else LEAST(month start, first production) for piece rate or `start_date` for fixed salary; `period_end` ≤ Surat today and must advance | `0901110004:143,196-219` | a (TS) |
| O-INV-16 | Advance recovery capped at `round(50% × gross, 2)`, FIFO by `created_at`, per-advance receipt; net floored at 0. **Deductions are stored as advances** with a `[Deduction]` prefix, so the cap and FIFO apply to them | `0901110004:258,278`; `production/actions.ts:980-993` | a (TS)/c |
| O-INV-17 | Settlement concurrency: partial unique index (org, worker, start, end) WHERE paid + per-worker advisory lock; reviewed wrapper re-compares reviewed amounts (40001) | `0901110004:15,151`; `0913:212-276` | **d** |
| O-INV-18 | Reversal only for the latest paid settlement; needs `payment_not_made`, a 3–240 char reason and complete recovery receipts; restores each advance with compare-and-set | `0901110004:55-104` | **d** |
| O-INV-19 | One current worker per machine+shift and one current job context per machine (partial unique indexes); worker/machine active; shift availability is checked only in TS | `0830100000:58-93`; `0905090000`; `production/actions.ts:350` | c |
| O-INV-20 | Period completion: per-period lock, idempotent once settled; totals summed from paid settlements; snapshot and worker count come from the client (`z.any()`) | `20260913180000:58-156`; `production/actions.ts:129` | **d** |
| O-INV-21 | Surat time: SQL `(now() AT TIME ZONE 'Asia/Kolkata')::date`; yarn/audit cutoff IST midnight of date+1; TS `getSuratTodayString`; payroll cycle engine uses UTC arithmetic on YYYY-MM-DD strings | `lib/time.ts`; `0912:173-174`; `lib/payroll-cycle-engine.ts:148-166` | a |
| O-INV-22 | Precision: metres numeric(14/16,2); money numeric(12–20,2); yarn numeric(24,9); TS Decimal precision 20, half-up | migrations; `lib/finance.ts:4` | a |

**Ops coverage gaps.**
- The deployed body of `settle_base_worker_payroll` only exists after a string-replacing DO block in `0903162305`, so text tests of `0901110004` don't reflect it.
- Yarn/lot accounting, challan FIFO and the audit RPCs (`0920`/`0922`) have text-only coverage.
- Payroll period complete/reopen, cycle updates and settle→reverse round trips have none.
- The existing PGlite and loopback QA scripts (`scripts/qa/base-payroll-continuity-sql.mjs`, `base-fixed-salary-sql.mjs`, `verify-base-machine-register.mjs`, `challan-payment-terms-regression.mjs`) stop at migrations ≤ `0903162305`/`0922`, or need an uninstalled package. `challan-db-scenarios.mjs` and `yarn-stock-db-scenarios.mjs` are orphaned (their harness was deleted) and test the old yarn-at-dispatch behavior. **No harness covers `0913`, `0914`, `0915`, `0920` or `0922`.**

**Ops suspected defects** (IDs OS-n; SUSPECTED unless ✔; none fixed):

| ID | Sev. (guess) | Finding |
| --- | --- | --- |
| OS-1 ✔✔ | **High** | **Inventory audit cannot load.** `get_inventory_audit_data` (plpgsql, SECURITY DEFINER) runs `jsonb_agg(jsonb_build_object(… sum(m.kg_delta) …)) … GROUP BY y.id` (`0920:710-721`; the fabric block `:731-742` has the same shape). **Reproduced on the E9 disposable schema: preparing that statement fails with `42803 aggregate function calls cannot be nested`.** The hosted DB is also Postgres 17. `owner/stock/audit/page.tsx` throws on the RPC error, and `finalize_inventory_audit` calls the same function |
| OS-2 ✔ | **High** | **Audit writes cannot succeed.** `createInventoryAuditAction`/`saveAuditPhysicalCountAction` (`stock/audit/actions.ts:47-50,82-84`) insert/update `inventory_audits`/`inventory_audit_lines` with the session client, but `0920:99-104` grants `authenticated` SELECT only with a SELECT-only policy. These actions use only `requireRole(['owner'])`, with no `requireWritableOrg` or plan check. `createInventoryAuditAction` has no UI consumer (investigator) |
| OS-3 ✔ | High (functional) | **Challan auto-archive lost.** `mutate_delivery_challan` sets `archived_at` in `20260908235614` and `20260909045727` (2 occurrences each); its redefinitions in `0920` and `20260922135042` have 0, and no later migration adds it. Settled/reversed challans no longer reach History (`challan-actions.ts:33-35`), contradicting `docs/features/standalone_delivery_challans.md:13` |
| OS-4 ✔ partial | Medium | **Payroll payment request idempotency regressed.** `20260913180000` has 0 references to `client_request_id` / `base_payroll_payment_requests` (vs 8 in `0901110004`). TS still sends the id (`lib/base-payroll-review.ts`). Duplicate paid settlements for the same period stay blocked by O-INV-17, so the likely effect is error-instead-of-replay on retry (INFERRED) |
| OS-5 | High (compliance) | **Data export incomplete.** `settings/data-export.ts:186-277` omits Base machines, assignments, batches, entries/allocations, revisions, settlement lines, recoveries, reversals, periods, cycle configs, challans/events, production lots and audits. It uses unpaginated `select('*')` (`:192`), so large tables may truncate at the PostgREST row cap (INFERRED). The page promises complete organization data. Not re-checked by the lead |
| OS-6 | Medium | Lot and yarn drift: on downward corrections, yarn is restored using the *current* recipe and only the latest lot is reduced via `GREATEST(0,…)` (`0920:506-516`); opening/correction/audit adjustments never touch lots |
| OS-7 | Medium | Reconcile prefers `yarn_stock_recipes` (latest activation) over the job's frozen `yarn_recipe_snapshot` (`0920:380-395`), contradicting that migration's own comment |
| OS-8 | Medium | Settlement reversal does not update `base_payroll_periods`; re-completion overwrites the snapshot; owners can write periods directly (`0913:37-50`); the client snapshot is unvalidated (`z.any()`) |
| OS-9 | Medium | Backdated corrections fail with 23503 after a quality switch or assignment removal (dated lookups require `active IS TRUE`) (INFERRED) |
| OS-10 | Medium | Production/payroll/assignment RPCs lack their own locked-org check (O-INV-02); TS guard only |
| OS-11 | Medium | `saveBasePayrollCycleConfig` (`production/actions.ts:1149-1197`) falls back to non-transactional direct writes on any RPC error and ignores the close-old-config error |
| OS-12 | Low–Med | Advances/deductions have no idempotency key; double submit duplicates them (`production/actions.ts:941,985`) |
| OS-13 | Low | One worker's settlement finalizes the whole shift batch, locking unpaid co-workers (UI and DB agree; may be intended) |
| OS-14 | Low | `loaders.ts:250-256` swallows payroll-period load errors; each production/payroll/assignment load reads ~16 tables of full history |
| OS-15 | Low | Settlement lines rounded per line vs header rounded once (cent differences); history sums use JS floats (`lib/base-payroll-history.ts:72`) |
| OS-16 | Low | Reversing a pre-`0920` dispatch no longer restores yarn deducted at dispatch |
| OS-17 | Low | Default challan date uses the browser's local date (`ChallansClient.tsx:58,249`); one global challan sequence across tenants |
| Doc drift | Low | Old register blocks zero received metres; current receipt accepts 0 (`0922:97`). `docs/features/yarn_inventory.md` cites the deleted harness. Cleanup C13/final-pass cite `LegacyMachinesPage.tsx`, `dispatches/legacy/page.tsx` and `payroll/PayrollClient.tsx`, none of which exist |

**Ops duplication leads.**
- Payroll math exists in both TS and SQL; the only drift guard is the 40001 reviewed-amount comparison.
- `mutate_delivery_challan` was copied in full 4 times, and that copy drift caused OS-3.
- There are two settle UIs (`BaseProductionClient.tsx:446-458,918-926` and `BasePayrollSettlementWorkspace.tsx:225-228`).
- The large client components mix data access and UI (BasePayrollSettlementWorkspace 1,160 lines, ChallansClient 1,133, BaseDailyProductionSheet 1,083, BaseAssignmentWorkspace 1,072, BaseProductionClient 970, InventoryAuditClient 918), and one loader feeds four routes.
- Code with no consumer: `recordBaseProduction` (`production/actions.ts:835`) is an exported action with no consumer; `BaseSetupWorkspace.tsx` is "rollback only"; the C06/C07 register panels; test-only lib modules (`payroll-cycle`, `machine-operator-payroll`, `production-log-validation`, `dispatch/archive`).
- `lib/challan-payment-terms.ts:2 businessDate` duplicates `getSuratTodayString`.

**Old `DOMAIN_INVARIANTS.md`: what still applies.**
- Security/tenant authority and audit/export rules apply (export completeness is violated by OS-5).
- Locked tenants apply partly.
- Production-log gross equation applies (order/market context retired).
- Generated stock: the "same transaction" rule applies; the old equations are superseded by quality metre stock.
- Stock-and-sale and dispatch-and-receipt sections are retired (legacy writes rejected at `0908:253-269`).
- Payroll: only the no-bypass-RPC rule applies.
- Idempotency applies, partially regressed (OS-4, OS-12).

## E11. Access, tenancy, entitlement, quota and billing register

Source: read-only investigator report at `d748008e`. ✔ = re-checked by the lead.

**Configured rules (from code and migrations, not docs):**

| Item | Value | Source |
| --- | --- | --- |
| Tiers | `none \| free \| lite \| base` | `lib/subscription-access.ts:2` |
| Free capabilities | estimator, account_settings, saved_costings, export_document | `subscription-access.ts:49` |
| Lite / Base capabilities | Lite: estimator, saved_costings, qualities, rate_book, existing_costing_tools, account_data, account_settings, costing_defaults, export_document. Base adds production, production_management, production_tracking, production_linked | `:24-42` |
| Current paid row | status in {active, authenticated, pending, paused, halted, cancelled, completed}; start ≤ now; end + **24 h grace** ≥ now; highest tier wins. SQL mirror `org_has_subscription_tier` | `:72-80,131-175`; `20260924085030:70-128` |
| Base expiry | Falls back to Lite when paid Base history exists | `subscription-access.ts:96-122`; SQL `:108-124` |
| **Free allowance** | **2 successful calculations per calendar month, Asia/Kolkata, no carryover.** The number is DB data: `free_quota_policies` seed, v2 `period_unit='month'`, `free_rollout.policy_version=2`. Live values UNKNOWN | `20260908182417:10`; `20260912130854:20-29` |
| Free rollout | `enrollment_enabled`/`estimation_enabled` default false; live values UNKNOWN | `20260908182417:15-16` |
| Prices (paise, incl. 18% GST) | Lite 299,900 first year / 149,900 renewal; Base 999,900 / 499,900 | `lib/billing-constants.ts:12-37` |
| Term | 365 days; renewal opens 30 days before end; a lapsed plan can always renew | `billing-constants.ts:76-79`; `billing-lifecycle.ts:72-83` |
| Checkout | lite/base only; Lite blocked while Base active; renewal price only with same-tier paid history; readiness gate on keys and GST supplier config | `api/billing/create-order/route.ts:65-81`; `billing-lifecycle.ts:150-211` |
| Legacy tiers | TS maps others to `none`; DB trigger rejects non-lite/base rows; `assert_premium_rpc_access` always raises; `/api/subscriptions/create` returns 410; webhook still applies `subscription.*` events to legacy rows | `20260924085030:49-68` |
| Rate limits | Auth/signup 200 per 15 min per IP (bounded in-memory fallback); access codes 5 per 10 min, fail closed; "destructive" 100/60 s (comment says 20); public POST 120/60 s; generic `checkRateLimit` fails open; Redis revocation flag 1 h TTL, fails open | `lib/rate-limit.ts:43-48,128,148,160-182,371-378` |
| Idle timeout | 1 hour | `proxy.ts:284-304` |

**Invariants:**

| ID | Invariant | Evidence |
| --- | --- | --- |
| A-INV-01 | Server role/org come from the `profiles` row (admin read) keyed by `auth.getUser()`; null when role/org missing or `access_revoked_at` set | `lib/auth.ts:107-163` |
| A-INV-02 | RLS reads `user_role`/`org_id` JWT claims minted by `custom_access_token_hook` from `profiles` (dropped when revoked); stale until token refresh (INFERRED) | `20260718090000:21-65`; `20260710054420:131-195` |
| A-INV-03 | Signed-in users cannot write `profiles.id/role/org_id` (column grants + trigger) | `20260625195248:7-61` |
| A-INV-04 | `org_subscriptions` not writable by anon/authenticated; activation/claim RPCs service-role only | `20260601233631:179` |
| A-INV-05 | Proxy is optimistic: strips the internal revocation marker; JSON 401 for `/api/*` | `proxy.ts:113-117,165-176,276-278` |
| A-INV-06 | `requireRole` sends Free/`freeAccount` users to `/free` (unless `allowFreeAccount` or admin); it does **not** block tier `none` | `auth.ts:193-196` |
| A-INV-07 | Lock checks fail closed on lookup errors | `auth.ts:214-219`; `owner/layout.tsx:96-111` |
| A-INV-08 | Plan resolution throws on DB error, never silently downgrades | `subscription.ts:50` |
| A-INV-09 | Estimator quotes/templates/factory cost profile RLS: owner + org match + `org_has_subscription_tier(org,'base')` (= Lite or Base) + not locked | `20260710054420:131-195` |
| A-INV-10 | `org_has_subscription_tier` returns true for **any service_role caller**, so plan checks inside service-role RPCs are no-ops | `20260924085030:82` |
| A-INV-11 | Free boundary: RESTRICTIVE RLS on tables with `org_id`/`factory_id` existing by 2026-09-08 + PostgREST `db_pre_request` guard; service role bypasses both | `20260908190537:50-100` |
| A-INV-12 | Razorpay webhook: HMAC-SHA256 over raw body, timing-safe; missing secret rejects | `webhooks/razorpay/route.ts:66-86,155-157` |
| A-INV-13 | Webhook idempotency: `claim_razorpay_webhook_event(id, payload_hash)`, hash-mismatch conflict, reclaim after 300 s, processed/failed marking | `route.ts:128-190,476-495`; `20260714090000:70-138` |
| A-INV-14 | Webhook payloads never grant access directly: payment/order re-fetched from Razorpay; org from server-written notes; catalog re-checked | `route.ts:200-214`; `billing-lifecycle.ts:227-254` |
| A-INV-15 | Payment callback: HMAC over `order|payment` → shared `reconcileBillingOrder`; notes org must equal caller org; exact amount/currency match | `verify-payment/route.ts:65-88`; `billing-reconciliation.ts:51-55,185-225` |
| A-INV-16 | Amount and purchase type come from the server only; one open checkout attempt per org via advisory lock | `create-order:61-177`; `20260831150000:268-291` |
| A-INV-17 | Unique constraints on payment id, captured order, subscription order id | `20260801162646:48-54` |
| A-INV-18 | A duplicate captured first purchase is auto-refunded only when `BILLING_DUPLICATE_REFUND_ENABLED=true`; otherwise `reconciliation_required` | `billing-reconciliation.ts:57-66,101` |
| A-INV-19 | Free debit: DB clock; locks subject then usage row; replay by `request_id` with input-binding check; exhaustion checked before increment; saved costing `ON CONFLICT(id) DO NOTHING`; RPCs service-role only | `20260912130854:67-150`; `20260908205605:18-33` |
| A-INV-20 | Paid users skip Free debit; Free token HMAC-bound to subject and engine version | `free-service.ts:85-87`; `free-request-identity.ts` |
| A-INV-21 | `AccessGate` is render-only: tier `none` → billing, otherwise a wall | `components/billing/AccessGate.tsx:44-56` |
| A-INV-22 | `lib/supabase/admin.ts` is `server-only`; all 34 import sites are server code | `admin.ts:1` |

**Server-side enforcement matrix.** Checks: (a) authenticates, (b) org from profile, (c) role, (d) plan/capability, (e) lock/writable, (f) rate limit.

API routes:

| Route | (a) | (b) | (c) | (d) | (e) | (f) |
| --- | --- | --- | --- | --- | --- | --- |
| billing create-order, verify-payment, status, checkout-state, invoice, receipt; subscriptions/auto-renew | `getUser` | RLS profile read | owner | catalog/HMAC | no | **no** |
| billing/redeem-referral-year; referrals apply/generate | `requireRole` | yes | owner | RPC/env | no | no |
| free calculate, events | `freeContext` | yes | owner | grant + rollout | yes | per subject |
| free status, costings | `freeContext(allowInactive)` | yes | owner | grant | yes | no |
| free/account | `requireRole(allowFree)` | yes | owner | — | **no** | per user |
| analytics/plan-events | `getCachedSession` | yes | owner | — | — | **no** |
| analytics/web-vitals | `getCachedSession` | yes | owner | — | — | fails open |
| webhooks/razorpay | HMAC | from order notes | — | catalog | — | IP, before signature |

Server actions:

| File | Guard | Plan/capability in TS | Lock in TS | Actual enforcement |
| --- | --- | --- | --- | --- |
| estimator/actions.ts | `requireRole` | only in `getEstimatorTemplates` | none | RLS + SECURITY DEFINER RPCs (A-INV-09) |
| rates/actions.ts | `requireRole` + `requireBaseTier` (rate_book); `reconcileLegacyYarnRates` role only | yes | UNKNOWN | RLS |
| production, stock, yarn-actions, challan-actions | `requireWritableOrg` for writes | production | yes | TS + session client |
| stock/audit/actions.ts | `requireRole` only | **none** | **none** | RPC guards; direct writes blocked by grants (OS-2) |
| settings/actions.ts, account-deletion.ts, billing/actions.ts | `requireRole` (some allowFree) | `saveCostingDefaults` only | **no** | admin client |
| onboarding/plans `completePlanSelection` | `requireRole` + `assertOrgWritable` | server-derived | yes | — |
| **onboarding/base/actions.ts** | `requireRole` only | **none** (page gate only) | **no** | admin writes + admin fallback (AS-01) |
| lib/actions/compliance.ts | `requireRole(['admin'])` | — | — | admin client |
| lib/access-codes.ts | **none** | — | — | not imported (AS-11) |

**Access coverage.**
- Behavioral tests with mocks: proxy session recovery, auth rate-limit fallback, Free service, plan selection, web-vitals route, management loaders.
- Pure unit tests: request identity, phase1 scope, navigation, plan boundary, billing orders/trust, Razorpay lifecycle, Free policy.
- Text-only: the token hook, auth boundary/waterfall, session revocation, webhook idempotency, billing readiness, referral, estimator boundary migrations, account deletion, onboarding route guard.
- **No behavioral coverage:** `requireRole`, `getCachedSession`, `assertOrgWritable`, `getOrgPlanAccess`, `AccessGate`, the webhook handler, create-order, verify-payment, `reconcileBillingOrder`, `billing-activation`, referral apply, Base onboarding, inventory audit, data export, and every RLS policy and RPC.

**Access suspected issues** (IDs AS-n; ✔ = lead re-checked; none fixed):

| ID | Sev. (guess) | Finding |
| --- | --- | --- |
| AS-01 ✔ | **Medium, security** | `saveBaseOnboardingPayrollAction` explicitly falls back to the service-role client "if authenticated client had an RLS constraint" (`onboarding/base/actions.ts:~607,635-650,685-701`). With only `requireRole(owner)`, a Lite, tier-`none` or locked owner can write `base_payroll_cycle_configs` for their org, bypassing RPC rules. Other onboarding actions write `organizations` via admin with no lock/plan check (`:223-260,272-296,717-770`); the page checks tier but not lock |
| AS-02 | Medium, product/security | Free "verified owner" is not email-verified: signups are created with `email_confirm: true` + `free_signup: true` (`app/(auth)/actions/auth.ts:155-156`), and `finishFreeProvisioning` force-confirms (`lib/free-account.ts:52-58`). The per-account quota is then limited only by the signup IP rate limit; docs/Terms say "verified owner" |
| AS-03 | Low–Med | Auth IP rate limiting is keyed on request path (`proxy.ts:135-139`); `signIn`/`createOrganization` are server actions without their own limiter. Whether POSTs to other paths escape is UNKNOWN (Next 16 action routing) |
| AS-04 = CS-3 ✔ | Low–Med | Free signing-key fallback (see E8) |
| AS-05 | Low–Med / product | Locked orgs can still delete the account (RPC `20260808115518` has no lock check), rename org/profile (`settings/actions.ts:74-110`, `/api/free/account`), save the billing profile and write onboarding data — contradicts `ORG_LOCKED_WRITE_MESSAGE`; intent UNKNOWN |
| AS-06 | Low | A-INV-10 makes plan checks inside service-role RPCs no-ops (e.g. `register_estimator_costing_attestation`, `20260825060131:70`) |
| AS-07 | Low | Seven owner billing routes use `getUser` + RLS profile read and skip `access_revoked_at`; Redis revocation fails open |
| AS-08 | Low | Webhook idempotency key comes from the unsigned `x-razorpay-event-id` header (`route.ts:128-132`); downstream appears idempotent (INFERRED) |
| AS-09 ✔ | Low (functional) | `plan_usage_events` and `web_vital_samples` CHECK `plan_tier IN ('none','trial','lite','base','premium')` (`20260831150000:659`, `20260901110001:59`), unchanged by any later migration. Routes write `subscriptionTier`, which can be `'free'`, so Free owners' inserts fail. `EstimatorClient` (shared by `/free`) emits web vitals |
| AS-10 = OS-2 ✔ | — | see OS-2 |
| AS-11 | Low (latent) | `lib/access-codes.ts` is `'use server'` with unauthenticated `orgId`/`userId` parameters; not imported today (INFERRED not in the action manifest). Re-importing would expose it |
| AS-12 | Low | RESTRICTIVE Free RLS policy not applied to tables created after 2026-09-08 (challans, yarn, payroll periods/configs, audits); REST guard still covers them. create-order/status/verify-payment/plan-events have no rate limit |
| AS-13 | Doc drift | CLAUDE.md `search_path = ''` (4 RPCs) vs ~250 `pg_catalog, public` and ~100 `public`; `record_kind` hard-coded (not "from live entitlement"); destructive-limiter comment says 20/min, code is 100/60 s; `admin.ts` docstring cites the retired supervisor join |

**Access duplication leads.**
- There are six local plan guards: `requireBaseProductionOwner`, `requireStockOwner`, `owner()` ×2, `requireBaseTier` (actually checks rate_book), an inline settings check, and the always-failing `requireFactoryWorkflow`.
- There are four tier resolvers: `getOrgPlanAccess`, `getCachedOrgPlanAccess`, the uncached `getOrgTier` used in hot guards, and `getCachedOrgTier`.
- Paid-history rules exist in five places with different status sets, and the 24 h grace is written three times.
- `getRoleHomePath` is duplicated (`proxy.ts:16`, `auth.ts:20`). There are three claim normalizers and four owner-API auth patterns.
- Error shapes are inconsistent (`{error,state?,code?}`, `{code}`, plain-text 429, and actions that either return `{error}` or throw).
- `production_tracking`/`production_linked` are never used. Navigation uses `production_management` where the layout uses `production`. SQL `'base'` means Lite-or-Base and `'base_production'` means Base.

## E12. Escalations: suspected existing defects ranked (not fixed; each needs a separately approved scope)

Release claims touching these areas are **blocked** until they are resolved or explicitly accepted.

| Rank | ID | Area | Severity | Evidence strength | Proposed handling |
| --- | --- | --- | --- | --- | --- |
| 1 | OS-1 | Inventory audit page/finalize | High | **Reproduced** (42803 on the replayed schema) | New corrective migration after a characterization test on the DB harness. Schema-change approval required |
| 2 | OS-2 | Inventory audit writes | High | Grant text verified | Route writes through an RPC or change grants; schema/authorization approval required |
| 3 | OS-3 | Challan archive | High (functional) | Migration text verified | Corrective migration restoring the archive step; schema approval |
| 4 | OS-5 | Data export completeness | High (compliance) | Investigator only | Verify, then product decision on scope and pagination |
| 5 | AS-01 | Onboarding admin fallback | Medium (security) | Code verified | Remove the fallback / add lock+plan checks; authorization-change approval |
| 6 | CS-3 / AS-04 | Free signing-key fallback | Low–Med (security) | Code verified; prod config UNKNOWN | **User action: confirm `WEAVLY_FREE_SIGNING_KEYS` is set in Vercel production.** Then fail closed; separately approved |
| 7 | CS-1 | Multi-weft costing convention | High if used | Code verified | **Product decision**; characterize meanwhile |
| 8 | CS-2 | Reopen/re-save drift | Medium | Partly verified | Characterize; fix may need persisting `warping_mode`/`overhead_mode` (contract change) |
| 9 | OS-4, OS-12 | Payroll/advance idempotency | Medium | Partly verified | DB harness tests, then separate fix |
| 10 | AS-02, AS-05 | Free email verification; locked-org writes | Medium / Low–Med | Investigator | Product decisions |
| 11 | OS-6…OS-11, AS-03, AS-06…AS-12, CS-4…CS-10 | various | Low–Med | mixed | Backlog, after the harness exists |

## E13. Scored backlog

Score = (Impact + Risk) × (6 − Effort), each 1–5 (tech-debt skill). Type: PROT = protection/tests, REF = behavior-preserving refactor, DEL = deletion, PERF, DOC, BUG = separately proposed fix, DEC = decision needed.

| # | Item | Type | I | R | E | Score | Depends on |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Costing characterization fixtures (independent values; staged rounding incl. .xx5; multi-weft CS-1; legacy mode defaults; C-INV-17 exact-match; reopen mapping CS-2; export internal-number boundary) | PROT | 5 | 5 | 2 | 40 | — |
| 2 | Free signing-key production config check (user) | DEC | 3 | 4 | 1 | 35 | user |
| 3 | Disposable DB harness (E9) + RPC/RLS characterization: costing save/versioning/immutability, Free debit, locked-org, tenant isolation, OS-1/2/3/4 reproduction | PROT | 5 | 5 | 3 | 30 | approval for a `test:db` script |
| 4 | Remove the browser `crypto` fallback from `/free` + `/owner/estimator` (P-LEAD-1, ~100 KB gzip) | PERF | 4 | 2 | 1 | 30 | #1 |
| 5 | CI gate: tsc + vitest (+ changed-file lint) on GitHub Actions | PROT | 4 | 3 | 2 | 28 | approval (external service, push) |
| 6 | AS-01 onboarding fallback removal | BUG | 3 | 4 | 2 | 28 | #8, authorization approval |
| 7 | OS-1/OS-2/OS-3 corrective migrations | BUG | 5 | 4 | 3 | 27 | #3, schema approval |
| 8 | Access boundary behavior tests (auth helpers, billing routes with mocks, onboarding, webhook) + recover coverage lost in `25933ba5` | PROT | 4 | 4 | 3 | 24 | — |
| 9 | Base ops lib fixtures (payroll TS mirror, stock, challans) vs the SQL via the harness | PROT | 4 | 4 | 3 | 24 | #3 |
| 10 | Dedupe `estimator_quotes` payload builders and rebuild logic (D1/D2) | REF | 3 | 3 | 3 | 18 | #1 |
| 11 | hi/gu localizer INP measurement | PERF | 3 | 3 | 3 | 18 | fixture |
| 12 | Graph orphans / retired-scope modules / `qrcode` deps / hazardous one-off scripts, in batches | DEL | 2 | 2 | 2 | 16 | protocol + approvals |
| 13 | Fix the 3 lint errors (react-hooks) | REF | 2 | 2 | 2 | 16 | #1 for FreeUsageCard |
| 14 | Shared tour runner for 7 near-duplicate tours | REF | 2 | 2 | 3 | 12 | tour checks |
| 15 | `window.confirm` → `ConfirmActionDialog` | REF/UX | 2 | 1 | 2 | 12 | UX approval |
| 16 | Docs archive/consolidation (E7) + CLAUDE.md drift (AS-13, CS doc drift) | DOC | 2 | 1 | 2 | 12 | P5 |
| 17 | EstimatorClient decomposition (8,228 lines; 53 text-contract tests) | REF | 4 | 4 | 5 | 8 | #1, #3, text-contract migration |

## E14. Phase 1 results (2026-09-26)

### Package 1F — CI gate

- **Files:** `.github/workflows/ci.yml`, `scripts/ci/lint-changed.mjs`, `__tests__/ci-lint-changed.test.ts`.
- **Workflow:** runs on pull requests, pushes to `main` and manual dispatch. Permissions are `contents: read`; there are no secrets. Steps: `npm ci`, tsc, vitest (both through `isolated-command.mjs`), and a lint ratchet that fails only on diagnostics a change introduces, compared against each changed file's base version by rule, severity and message.
- **Why a ratchet:** strict whole-file lint on `29dff41f^..HEAD` would have failed on 26 pre-existing warnings across 42 touched files.
- **Verification:** see the STATUS table. The workflow is **not active** until committed and pushed.

### Package 1A — costing safety net

**Files:** `__tests__/costing-characterization.test.ts` (16 tests), `__tests__/costing-export-boundary.test.ts` (4), `__tests__/costing-save-boundary.test.ts` (4), `__tests__/fixtures/costing-characterization.ts`. Independent reference: `evidence/p1a-independent-costing.py` (Python `decimal`, no app import).

**Coverage change (E8 IDs):**

| Invariant | Before | After 1A |
| --- | --- | --- |
| C-INV-01/04/09/10/13 on a full multi-layer fixture (F1) | a (separate small cases) | **a**: every layer plus staged result values from independent arithmetic |
| C-INV-13 half-up at .xx5 float edges (1.005, 2.675, 0.285, 10.125) | d | **a** |
| C-INV-08 legacy missing-mode defaults | d | **a** |
| C-INV-10 override applies in monthly mode (CS-2 related) | a | **a, labeled CHARACTERIZATION** |
| C-INV-05 explicit 0 vs null waste | a | a (source tag also asserted) |
| C-INV-03 Ne conversion | a | a |
| C-INV-11 invalid C+M ≥ 100 (price 0, break-even still computed) | a | a |
| C-INV-14 version identities | a | a |
| C-INV-15 snapshot JSON round trip; tampered total rejected | a/b | a/b (round trip labeled CHARACTERIZATION) |
| CS-1 warp additive and weft 100/N shared run | a/b (identical rows only) | **a, INVARIANT (owner decision 2026-09-26)** |
| CS-1 weave cost and worker rate sum PPI | a | **a, CHARACTERIZATION (open question)** |
| Manual weft row counts toward N but is not scaled | d | **a, CHARACTERIZATION** |
| **C-INV-17** save rejects a client/server total mismatch | **d** | **a**: the real server action with mocked auth/Supabase; ±0.01 on cost or price is rejected before any admin call or revalidation; unrounded values that round equal are accepted |
| **C-INV-23** customer export leaks no internal *amount* | c (labels only) | **a**: rendered customer HTML and the share message contain price/quantity/value and none of the production, break-even, landed, commission, profit, weave or overhead amounts; the internal sheet does show them |

**Mutation check** (disposable export copy; source restored and re-verified). Each mutation was detected:

| Mutation | Tests failed |
| --- | --- |
| M1: weft length 100 per row instead of 100/N | 2 |
| M2: HALF_EVEN rounding | 1 |
| M3: weave uses max picks instead of the sum | 1 |
| M4: commission obeys the toggle only | 1 |
| M5: save tolerance 0.05 instead of exact | 1 |
| M6: customer export adds production cost | 1 |

The restored copy passed 24/24.

**Remaining costing gaps** (not closable without a source change or a DB harness):
- **CS-2 reopen mapping:** `buildDraftStateFromQuote` is private to `QuotesClient.tsx`; testing it needs an export or extraction, which is a source change.
- **C-INV-24:** Quick/Detailed UI parity needs a DOM or browser harness (1E).
- **C-INV-19/20/21:** attestation, versioning RPC and the immutability trigger need the DB harness (1B).
- **C-INV-25/26:** drafts and Free are covered by existing tests (a/mocks) and were not re-derived.

## E15. Multi-weft picks: research and consistency check (2026-09-26)

**Question from the owner:** should weave cost and worker rate keep adding PPI across weft rows?

**External sources** (general costing formulas; none found gives an explicit multi-weft worked example):
- [Textile Learner, weaving cost](https://textilelearner.net/calculate-weaving-and-knitting-cost/): the weaving charge is priced per pick of the fabric.
- [Warped Fibers, PPI](https://warpedfibers.com/ppi/): each pass of any weft yarn counts as one pick toward the fabric's PPI, including pick-and-pick with two yarns.
- [Textiles Bar weft formula](https://textilesbar.com/yarn-consumption-calculator-woven-fabric/) and [Textile Calculations](https://www.textilecalculations.com/yarn-consumption-for-a-fabric/): single-yarn weft formulas using that yarn's picks over the full fabric length.
- Search-engine summaries of costing guides describe splitting the fabric's picks between weft yarns by ratio, each computed over the full length. That is not confirmed by a fetched page (INFERRED).
- No source found divides the fabric length by the number of weft yarns.

**Internal consistency** (VERIFIED in code at `d748008e`):

| Place | What a weft row's PPI means | Evidence |
| --- | --- | --- |
| Weft yarn kg | the **full fabric PPI**; rows share the length (100/N m each) | `estimator.ts:1594-1601`; `20c4546f` test: two rows at 68 PPI must equal one row at 68 |
| Weave cost | **this yarn's own picks**; rows are summed | `estimator.ts:1664-1667` |
| Worker wage rate (feeds Base `worker_rate_per_meter` → piece-rate payroll, O-INV-14) | own picks; summed | `estimator.ts:197-206`; `actions.ts:1591` |
| Quotation weft text ("A + B - N Picks") | own picks; summed | `EstimatorClient.tsx:4190-4199` |

Three of four places, and the external formulas, treat a row's PPI as that yarn's own picks. For any single data-entry habit, multi-weft qualities are mis-costed somewhere.

**Worked example.** Fabric with 68 PPI, two alternating weft yarns (34 picks each), 75 D, 50" costing width, ₹170/kg + 5% GST, 16 paise/pick:
- **Industry reference:** weft 2 × (34 × 50 × 75 × 100 / 9,000,000) = 2.8333 kg/100 m; weave 68 × 0.16 = ₹10.88/m.
- **App, rows typed 34 + 34:** weft kg is halved to 1.4167 (yarn cost about ₹2.53/m too low); weave ₹10.88 ✓; quotation shows "68 Picks" ✓.
- **App, rows typed 68 + 68:** weft kg 2.8333 ✓; weave ₹21.76/m (₹10.88 too high); weaver wage rate doubled; the quotation shows "136 Picks".

**Status:** CS-1 is re-opened as a **product decision**. The 2026-09-26 INVARIANT test for the 100/N split records the owner's statement and stays unchanged until the owner decides. Either fix changes costing results, so it needs a new `COSTING_CALCULATION_VERSION` (saved snapshots stay immutable) and a payroll review for Base jobs activated from multi-weft costings. How many saved qualities have more than one weft row is UNKNOWN (a read-only production count would answer it, with approval).
