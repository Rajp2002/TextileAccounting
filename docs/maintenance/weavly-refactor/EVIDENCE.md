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
| 1 | OS-1 | Inventory audit page/finalize | High | **Reproduced** (42803 on the replayed schema) | **Fixed in F1 (E20)**; awaits application to QA/production |
| 2 | OS-2 | Inventory audit writes | High | Grant text verified | **Fixed in F1 (E20)** via owner RPCs, plus OS-2b draft creation in the UI |
| 3 | OS-3 | Challan archive | High (functional) | Migration text verified | **Fixed in F1 (E20)**; optional backfill awaits a decision |
| 4 | OS-5 | Data export completeness | High (compliance) | Investigator only | Verify, then product decision on scope and pagination |
| 5 | AS-01 | Onboarding admin fallback | Medium (security) | **Reproduced (E21)** | **Fixed in F2 (E21)**; app only, takes effect on deploy |
| 6 | CS-3 / AS-04 | Free signing-key fallback | Low–Med (security) | **Reproduced (E21)**; prod config UNKNOWN | **Fixed in F2 (E21)** (fails closed). Deploy precondition: a valid production keyring, owner to confirm |
| 7 | CS-1 | Multi-weft costing convention | High if used | Code verified | **Product decision**; characterize meanwhile |
| 8 | CS-2 | Reopen/re-save drift | Medium | Partly verified | Characterize; fix may need persisting `warping_mode`/`overhead_mode` (contract change) |
| 9 | OS-4, OS-12 | Payroll/advance idempotency | Medium-Low | **OS-4 narrowed and reproduced (E19):** only a replay after reversal re-settles; plain retries are idempotent | **OS-4 fixed in F2 (E21)**; migration awaits production approval. OS-12 open |
| 10 | AS-02, AS-05 | Free email verification; locked-org writes | Medium / Low–Med | Investigator | Product decisions |
| 10b | OS-13 | Payroll cycle settings fallback | **Low** (corrected, E25) | Reproduced in the harness (E25) | **Fixed (E25):** `saveBasePayrollCycleConfig` is RPC-only |
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

**Owner decision (2026-09-26, after E15):** two alternating weft yarns in a 68-pick fabric are entered **34 + 34**; each row holds that yarn's own picks. So summing picks for weave cost, wage rate and quotation text is correct (INVARIANT), and the **weft 100/N length split is a defect (CS-1, High)**: it halves weft yarn kg and cost for 2-row formula qualities (a third for 3 rows).

- **Extra impact (VERIFIED):** Base yarn recipes take each layer's `finalKgPer100m` from the saved costing snapshot (`private.yarn_costing_recipe`, `20260912131633`) and freeze it at activation (`0920`). Activated multi-weft qualities therefore under-deduct weft yarn stock at production by the same factor.
- **Fix:** needs its own approved package:
  - formula rows use the full 100 m;
  - new `COSTING_CALCULATION_VERSION`;
  - deliberate updates to the `20c4546f` test in `__tests__/estimator.test.ts` and to the Package 1A characterization test;
  - a decision on already-saved costings (immutable snapshots stay) and on already-activated yarn recipes.
- **Side effects:** a version bump discards unsaved estimator drafts (C-INV-25) and re-issues Free tokens (engine-version binding).
- **Prevalence:** the number of affected saved costings and activated jobs in production is UNKNOWN; answering it needs an approved read-only count.

## E16. First CI run failed: pre-existing lockfile inconsistency (2026-09-26)

- **Trigger:** at 16:02 IST, commit `9f12af19` (UI rails, author Raj Patel; not this program) was made in this checkout. `main` was then fast-forwarded to the refactor branch and pushed. `main` and `origin/maintenance/weavly-refactor` both point to `9f12af19`, so this program's three commits (`e6bbb7ba`, `9c682ace`, `797fe98e`) are on `main`. They contain no application code, so runtime behavior is unchanged by them.
- **Symptom:** CI run `36236128674` (push to main, `9f12af19`) failed at **Install dependencies**. `npm ci` returned EUSAGE: "package.json and package-lock.json … not in sync. Missing: @emnapi/core@1.10.0 … @emnapi/runtime@1.10.0". Type check, tests and lint were skipped. The runner used Node 24.21.0.
- **Root cause (VERIFIED, reproduced):** the optional dev dependency `@rolldown/binding-wasm32-wasi` (via Vite 8/rolldown) pins `@emnapi/core` and `@emnapi/runtime` to exactly `1.10.0`. The lockfile provides only the hoisted `1.11.2` and no nested `1.10.0` entries. npm **11.20.0** rejects this (`npm ci --dry-run` exit 1); npm **11.6.2**, the local baseline, accepts it (exit 0). The lockfile was last changed in `b1ee8719`, before this program, so this is a pre-existing defect that CI exposed. Anyone on current npm cannot `npm ci` this repo.
- **Minimal fix (verified in scratch, not applied):** add the two npm-generated nested entries `node_modules/@rolldown/binding-wasm32-wasi/node_modules/@emnapi/{core,runtime}@1.10.0` (taken from `npm@11.20.0 install --package-lock-only`; 23 added lines, nothing else changed). Both npm 11.6.2 and 11.20.0 then pass `npm ci --dry-run`. A full regeneration would also flip `peer` flags on 72 entries (no version changes), so the minimal variant is preferred for review. The package is optional and only for wasm32, so it is not installed on macOS or Linux x64 and nothing installed on Vercel changes. Approval is needed (lockfile change, and it reaches production via `main`).
- **Also noted:** GitHub warns that `actions/checkout@v4` and `actions/setup-node@v4` target the deprecated Node 20 runtime; they were forced to Node 24. A follow-up bump to their current major versions is optional.

## E17. Package 1B-1 — disposable database harness (2026-09-26)

**Files:**
- `scripts/test-db/cluster.mjs` (harness)
- `vitest.db.config.ts`
- `__tests__/db/{global-setup,helpers}.ts`
- `__tests__/db/{harness,tenant-and-lock,known-defects,free-debit,costing-immutability}.dbtest.ts` (24 tests)
- `package.json` script `test:db` (`vitest run --config vitest.db.config.ts`)

`npm test` does not match `*.dbtest.ts` (the default suite stays at 232 files). CI is unchanged.

**How it works:**
- `initdb` runs in the OS temp dir on a free port, 127.0.0.1 only, with no Unix socket and trust auth; fsync is off because the cluster is disposable.
- A loopback guard refuses every other host.
- It creates the Supabase roles and installs stubs (`auth.uid()`/`jwt()`/`role()`, `auth.users`, `storage`, `extensions.pgcrypto`, no-op `cron`), plus Supabase's documented default privileges for existing projects: tables and functions created in `public` are granted to `anon`, `authenticated` and `service_role`, and migrations revoke selectively.
- It replays all migrations except the four pg_cron/pg_net schedules into a template database. Each test file clones the template, and teardown stops the cluster and deletes its directory.
- Tests switch identity with `SET ROLE` plus the JWT claims `custom_access_token_hook` would mint.
- **Fidelity assumption (INFERRED):** the production project has those default privileges (created 2026-02, an "existing project" under Supabase's docs). The first run without them failed with `permission denied for table organizations` for `service_role`. Confirming it needs a read-only `pg_default_acl` query on production (not run).
- **Not exercised:** PostgREST pre-request hooks, real JWT verification, `pg_net` and cron.

**Results** (`npm run test:db`: 5 files, **24 passed**, about 6 s; afterwards no process or data directory remains):

| Area | Tests (label) | Outcome |
| --- | --- | --- |
| Harness | migrations replayed = total − 4 hosted-only (≥ 296); all public tables have RLS; loopback guard; TCP-only listener (INVARIANT) | PASS |
| Tenancy/plan/lock (quality stock RPCs) | owner writes only own org; other org cannot read by table or board RPC; request replay counted once; changed-detail replay → 40001; Lite owner → 42501; locked org → "organization is locked", balance unchanged (INVARIANT O-INV-01/02/09, A-INV-07) | PASS |
| **Known defects, now reproduced by execution** | **OS-1** `get_inventory_audit_data` → `42803 aggregate function calls cannot be nested`. **OS-2** owner `INSERT inventory_audits` → `42501 permission denied for table inventory_audits`. **OS-3** save → confirm → reverse_dispatch leaves `archived_at` NULL (the fabric is correctly restored to 100 m) | KNOWN DEFECT, asserting current behavior |
| Free debit | migrated policy 2/month Asia/Kolkata (CHARACTERIZATION); new request debits once and saves; replay returns same result, no second debit; same id + different inputs → `FREE_REQUEST_CONFLICT`; exhausted → `FREE_QUOTA_EXHAUSTED` with nothing saved; locked org → `FREE_ACCESS_DENIED`; `authenticated` cannot call the debit (42501) (INVARIANT A-INV-19) | PASS |
| Costing immutability | owner cannot change economics; archive metadata can change; service role also bound, delete refused (INVARIANT C-INV-21); legacy `quotation` rows unprotected (CHARACTERIZATION); **CS-8 reproduced**: any SQL session that sets `app.account_deletion='true'` bypasses the trigger (CHARACTERIZATION; PostgREST clients cannot run `SET`, INFERRED) | PASS |

**Mutation check** (disposable copy, one extra migration each; restored copy 24/24):

| Mutation | Tests failed |
| --- | --- |
| Estimator triggers disabled | 2 (C-INV-21) |
| `assert_org_not_locked` made a no-op | 1 (lock) |
| INSERT granted on `inventory_audits` | 1 (OS-2 flips) |
| Free limit 3 | 2 |
| RLS off on `quality_stock` | 4 |

**Gates at worktree state** (`main` @ `09213fde` + 1B-1):
- default vitest 232 files / 2,019 passed / 1 skipped;
- tsc PASS;
- new files lint 0/0;
- full lint 3 errors / **80** warnings. The drop of one from the 81 baseline is the unused `ChevronDown` import in `BaseDailyProductionSheet.tsx`, removed by UI commit `9f12af19`, not by this package.

**Deferred to 1B-2:** the paid-save chain (`register_estimator_costing_attestation` → `save_estimator_costing_revision_v2`: replay, `no_change`, stale version) and OS-4 payroll request idempotency.

## E18. Harness fidelity vs production privileges (read-only check, approved 2026-09-26)

Metadata-only queries were run against production `vzhwahudircrpgtitwzd`: `pg_default_acl`, and `has_function_privilege`/`has_table_privilege` for `anon`, `authenticated` and `service_role` on every public function and table. No table data was read.

- **Production default ACL for objects created by `postgres` in `public`:**
  - tables `anon`/`authenticated`/`service_role` = `arwdDxtm` (ALL);
  - sequences = `rwU` (ALL);
  - functions = `postgres`, `service_role` only (no PUBLIC, `anon` or `authenticated`).
- **Comparison with a freshly replayed harness.** Rows were compared by md5 in 16 buckets, then row by row for the mismatched buckets:

  | Side | Rows |
  | --- | --- |
  | Harness | 311 (174 functions, 137 tables/views) |
  | Production | 314 |

  Every table and view matches on DELETE/INSERT/SELECT/UPDATE for all three roles. Functions match for 170 of the 171 present in both. Differences:
  1. **Schema drift (VERIFIED):** production has three functions that no migration creates: `rls_auto_enable()` (`--s`), `get_user_org_id()` (`-us`) and `get_user_role()` (`-us`). Migrations only touch them conditionally. `supabase/migrations` is therefore not a complete description of production.
  2. `custom_access_token_hook(jsonb)`: production `--s` vs harness `-us`. Migrations revoke only PUBLIC, and production's grants were narrowed outside migrations (INFERRED: the Auth hook configuration).
- **Interpretation:** production's *current* function default (service_role only) is newer than almost all existing functions, which were created under the broader default the harness uses. **Gap:** a future migration that adds an RPC without an explicit `GRANT EXECUTE … TO authenticated` would work in the harness but fail in production. New migrations should grant explicitly; the harness cannot catch a missing grant.
- The harness now grants ALL on tables and sequences, matching production. The 1B-1 results are unchanged.
- **OS-2 confirmed in production:** `authenticated` has only SELECT on `inventory_audits`.

## E19. Package 1B-2 — paid save chain and payroll settlement (2026-09-26)

**Files:**
- `__tests__/db/supabase-adapter.ts`: a minimal Supabase-client stand-in. `.rpc()` and `.from().select().eq()/.in()/.is()/.order()/.limit()/.maybeSingle()/.single()` run in PostgreSQL as the owner or service role; unsupported calls throw.
- `__tests__/db/costing-save.dbtest.ts` (8 tests)
- `__tests__/db/payroll-settlement.dbtest.ts` (4 tests)
- `scripts/test-db/cluster.mjs`: timestamps returned as strings like PostgREST; production-matching table and sequence defaults.

**Paid save, end to end.** The real `saveEstimatorQuoteV3` runs with only auth mocked. Prices come from the independent Python reference (production 26.23; price 31.44/31.82/32.20/32.60/33.00 at 12–16% margin).

| Test | Result |
| --- | --- |
| New costing: `service:register_estimator_costing_attestation` then `user:save_estimator_costing_revision_v2`, version 1, row attested, attestation consumed (INVARIANT C-INV-19/20) | PASS |
| Same request retried: same row, `idempotentReplay` (C-INV-20) | PASS |
| One-paisa total mismatch refused before any RPC (C-INV-17) | PASS |
| Unchanged inputs as a revision: `noChange`, no new version (CHARACTERIZATION) | PASS |
| Stale source → "This costing changed in another tab…", raised by the RPC | PASS |
| Payload altered after attestation → "The costing payload was not verified by the server…" (C-INV-19) | PASS |
| Other org revising → "The costing being edited no longer exists." (SECURITY DEFINER RPC scopes to the caller's org) | PASS |
| Unpaid org → "…required to save costings." **CS-9 / AS-06 confirmed by execution:** the service-role attestation succeeds for an unpaid org and the row stays unconsumed; only the owner-side RPC enforces the plan | PASS (CHARACTERIZATION) |

**Payroll settlement** (100 m × ₹2 = ₹200 via `save_base_daily_production_reviewed`, then `settle_base_worker_payroll_reviewed`):

| Test | Result |
| --- | --- |
| Gross = metres × snapshot rate, one paid settlement (O-INV-14) | PASS |
| Retry for the same period returns the same `settlement_id` with `idempotent: true` (O-INV-17) | PASS |
| Reviewed amounts differing from computed → 40001, nothing saved (O-INV-17) | PASS |
| **OS-4, narrowed and reproduced (KNOWN DEFECT):** after a reversal, re-sending the original request (same `client_request_id`) creates a **new paid settlement** | reproduced |

On OS-4: the 2026-09-01 function refused this with "This payment request was reversed. Reload payroll before recording another payment." (`20260901110004:358`); the 2026-09-13 reviewed wrapper never reads `client_request_id`. **The original OS-4 claim (plain retries broken) is not supported;** plain retries are idempotent by period. Severity: Medium-Low. It needs a stale retry arriving after an explicit reversal, and it re-pays a worker the owner just reversed.

**Mutation check** (disposable copy; restored 36/36):

| Mutation | Tests failed |
| --- | --- |
| `org_has_subscription_tier` always true | 2 (Lite stock access, unpaid save) |
| Owner EXECUTE revoked on the save RPC | 7 (every end-to-end save test that reaches the RPC) |

**Gates** (worktree = `main` @ `28c00db0` + 1B-2):
- `npm run test:db` 7 files / 36 passed, no cluster left;
- default vitest 232 files / 2,019 passed / 1 skipped;
- tsc PASS;
- changed/new files lint 0/0;
- full lint 3 errors / 80 warnings (unchanged from 1B-1).

## E20. Fix package F1 — inventory audit and challan archive (2026-09-26)

**Migrations** (new files; no applied migration edited; not applied to any hosted project):

| File | Fixes | Change |
| --- | --- | --- |
| `20260926132159_repair_inventory_audit_board.sql` | **OS-1** plus a latent second bug | Re-creates `get_inventory_audit_data` from the `0920` definition with three edits (diff-verified): the yarn and fabric lists aggregate per item in a subquery and then build the same JSON (same keys, rounding and order); `v_audit` is a row type; with no audit id, the latest draft for the date is loaded, as the function's own comment intended. **Second bug, verified:** with only the aggregate fix, the no-id page load still fails with `record "v_audit" is not assigned yet` |
| `20260926132310_inventory_audit_owner_writes.sql` | **OS-2** | Adds `create_inventory_audit_draft(date, title, notes)` and `record_inventory_audit_count(audit, type, item, count, notes)`, both SECURITY DEFINER with explicit `GRANT EXECUTE … TO authenticated` (needed since production's function default is service_role only, E18). Same owner, Base stock access, locked-org and finalized checks as `apply_inventory_audit_adjustment`. One reusable draft per org and date (advisory lock). No future dates. Labels and system quantities are derived server-side as of the audit date. A count already applied to stock cannot be re-recorded. Direct table writes stay revoked |
| `20260926132412_restore_challan_auto_archive.sql` | **OS-3** | Re-creates `mutate_delivery_challan` from `20260922135042`, diff-verified identical except the restored `20260909045727` archive statement before the event insert |

**App changes:**
- `app/(dashboard)/owner/stock/audit/actions.ts`: `createInventoryAuditAction` and `saveAuditPhysicalCountAction` call the new RPCs instead of writing tables (the client-supplied label and system quantity are no longer stored).
- `InventoryAuditClient.tsx` (**OS-2b, product-visible**): the first count for a date creates or reuses that date's draft instead of showing "Draft audit record is required to record counts." No UI path created drafts before (`createInventoryAuditAction` had no caller). The draft title is the table default "Stock Audit", which is not displayed.

**Tests:**
- `__tests__/db/known-defects.dbtest.ts` is replaced by `inventory-audit.dbtest.ts` (9) and `delivery-challans.dbtest.ts` (5). These assert the fixed behavior plus unchanged invariants: stock restored on reversal, direct writes denied, partial payments and short receipts stay open, reversing the settling payment un-archives.
- **Pre-fix proof:** on the schema without the three migrations, 10 of the 14 new tests fail with the defect signatures (`aggregate function calls cannot be nested`, missing functions, `archived_at` not set). The other 4 are invariants that hold either way.

**Gates** (worktree = `main` @ `2aa3d6c7` + F1):
- `npm run test:db` 8 files / **47 passed**;
- default vitest 232 files / 2,019 passed / 1 skipped;
- tsc PASS;
- full lint 3 / 80 (unchanged);
- lint ratchet on the changed app files: `InventoryAuditClient.tsx` 4 pre-existing / 0 new, `actions.ts` 0 / 0.
- **NOT RUN:** a browser check of the audit page and challan History, which needs the migrations applied to QA.

**Deploy order is safe either way.**
- If the app deploys first, draft creation returns an RPC-missing error and the page still fails, as it does today; no regression.
- If the migrations are applied first, the page loads and challans archive; counts wait for the app deploy.
- Recommended: apply to **QA**, check the audit page (load, count, finalize) and one settled and one reversed challan, then **production**. Applying migrations is the owner's action.

**Optional backfill (not included as a migration; production data write, needs a decision).** Challans settled or reversed while the archive step was missing keep `archived_at` NULL until their next change. One idempotent statement applying the same rule would move them to History:

```sql
UPDATE public.delivery_challans SET archived_at = clock_timestamp()
WHERE archived_at IS NULL
  AND ((delivery_status = 'received' AND difference_status IN ('none','accepted') AND balance = 0)
       OR delivery_status = 'reversed');
```

### F1 applied to production (2026-09-26, owner-approved)

- **Pre-checks:**
  - Production migration history had 300 rows, whose versions and names match the local files (latest `20260924085030`).
  - `md5(prosrc)` of the four existing audit and challan functions in production equals a pre-F1 replay (no drift).
  - Delivery challans in production: 1 total, **0 matching the archive rule**. The owner delegated the backfill decision and **it was skipped** (nothing to change).
- **Applied** with the Supabase connector `apply_migration`, in order and without the files' `BEGIN;`/`COMMIT;` lines. Recorded versions: `20260926132159 repair_inventory_audit_board`, `20260926132310 inventory_audit_owner_writes`, `20260926132412 restore_challan_auto_archive`. The local files were renamed to exactly these versions, so history and files stay in sync.
- **Post-checks (VERIFIED):**
  - Production `md5(prosrc)` equals the tested harness build: `get_inventory_audit_data` `5d47b3b5…`, `mutate_delivery_challan` `306ed58a…`, `create_inventory_audit_draft` `c8d1f50a…`, `record_inventory_audit_count` `8d843ab7…`.
  - Unchanged: `apply_inventory_audit_adjustment` `1265f974…`, `finalize_inventory_audit` `d506a5bd…`.
  - All six functions are EXECUTE for `authenticated` only and SECURITY DEFINER.
- **Security advisor after applying:**
  - The new functions appear only in the existing WARN `authenticated_security_definer_function_executable`, alongside 63 existing owner RPCs of the same design.
  - No new search-path finding.
  - Pre-existing findings logged for the backlog: `free_server_time` mutable search_path (WARN); leaked-password protection disabled (WARN, Auth setting); 8 service-role-only Free tables with RLS and no policies (INFO, by design).
- **Rollback:** `docs/maintenance/weavly-refactor/evidence/f1-rollback.sql` restores the prior definitions, drops the two new functions and removes the three history rows.
- **Production UI check (owner-reported, 2026-09-26):**
  - On `/owner/stock/audit` the page loaded, a count was recorded and the audit was finalized.
  - One challan's History showed its transactions.

### F1 commit record (correction)

F1 reached `main` as two commits instead of one. A `git add` error stopped the fix commit, but the docs commit had already been created and was pushed first:

- `eda53bc4`: docs, plus the deletion of `__tests__/db/known-defects.dbtest.ts`. Its CI run was cancelled, superseded by the next push.
- `e3541dfb`: migrations, app changes and tests, pushed a few minutes later. **CI passed.**

For those few minutes, `main`'s docs described fixes whose code had not landed yet. `eda53bc4` changed no app code, so a deploy of it served the same app as before.

## E21. Fix package F2: onboarding fallback, Free signing key, reversed payroll requests (2026-09-26)

Owner-approved scope: AS-01, CS-3 and OS-4. The owner then approved committing and pushing to `main` and applying the migration to production, and confirmed the production signing keyring (see "F2 applied to production" below).

### AS-01: authorization (app only)

In `app/(auth)/onboarding/base/actions.ts`:
- The payroll step calls only `update_base_payroll_cycle`, as the signed-in owner. The RPC checks the owner role and Base access, and it applies same-day edits in place (`20260915120000`). The service-role fallbacks (update, then insert) and the direct table writes are removed.
- All seven mutating onboarding actions use `requireWritableOrg(['owner'])` instead of `requireRole`, so locked orgs fail closed.

**Pre-fix proof (VERIFIED).** Run on a disposable copy of the old code. The test adapter was extended there only, to support the old code's `.insert()`/`.update()` calls.
- A **Lite** owner's save was refused by the RPC, and then by RLS on the user insert.
- The service-role insert then wrote an active `base_payroll_cycle_configs` row, and the action returned `{ success: true }`.
- With F2 the action returns `{ error: 'Failed to configure payroll cycle. Please try again.' }`, writes no rows and never creates the admin client.

**Tests:**
- `__tests__/db/onboarding-payroll.dbtest.ts` (new, 2 tests) runs end to end through the real RPC.
- The "Payroll Persistence Contract" in `__tests__/base-onboarding-payroll-step.test.ts` was **deliberately rewritten**. It used to assert that the fallback existed. It now asserts:
  - the step is RPC-only;
  - no admin client is used;
  - all seven mutating actions have the lock check.

**Visible change:** a locked org, or a non-Base org, now gets an error in onboarding. Before, those writes succeeded through the service role.

### CS-3: Free signing key (app only)

`resolveFreeSigningKeys` in `lib/free-request-identity.ts` is called by `signing()` in `lib/free-service.ts`.

**In production** (`NODE_ENV=production`, which includes Vercel previews), signing is refused with `FREE_SIGNING_KEY_UNAVAILABLE` when the active key is:
- missing;
- unparseable, or not a JSON object;
- shorter than 32 bytes.

What the user and the server see:
- The API answers `503 {"code":"FREE_TEMPORARY_ERROR"}`.
- The server log names the settings only, never key material.
- Older keys in the keyring are still used for verification, so key rotation works.

**Source change:**
- The production fallback literal is removed from the source.
- It stays in git history, so it must never be used as a real key.
- The development and test fallback is unchanged.

**Pre-fix proof (VERIFIED).** Run on a disposable copy in production mode with no keyring:
- A request token minted from the repository key was **accepted and reached the debit RPC**.
- With F2 it is refused before any debit.
- The literal was read at runtime and never printed.

**Tests:**
- 3 resolver tests in `__tests__/free-request-identity.test.ts`.
- 1 service test in `__tests__/free-service.test.ts`. It checks that unset and short keys are refused before the debit, that the log is free of key material, and the 503 mapping.

**Deploy precondition (confirmed by the owner on 2026-09-26; not independently verified by Claude).**
- **Required setting:** production needs `WEAVLY_FREE_SIGNING_KEYS` to be a JSON object that contains the key named by `WEAVLY_FREE_SIGNING_KEY_ID` (default `launch`), at least 32 bytes long.
- **If it is missing:** after deploy, `freeStatus` and Free calculations return 503 for active Free users. Paid plans don't call `signing()` and are unaffected.
- **Previews:** they need their own key, or Free is unavailable there.

### OS-4: reversed payroll requests (schema)

`supabase/migrations/20260926135315_restore_payroll_reversed_request_guard.sql` re-creates `settle_base_worker_payroll_reviewed` from `20260913180000` with three edits (diff-verified):

1. `client_request_id` is required again.
2. A request whose settlement was reversed is refused with `40001`, "This payment request was reversed. Reload payroll before recording another payment." This is the message from `20260901110004`.
3. Each request is mapped in `base_payroll_payment_requests`, with `ON CONFLICT DO NOTHING`.

The signature, SECURITY DEFINER, `search_path` and grants are unchanged.

**Hashes** (`md5(prosrc)`, replayed schema):
- Pre-image `74d7e947012ae1d129959c9fda6acd95`. This is what production should have now; check it before applying.
- Post-image `fc49b5fd7f0b8604f74ec10ae187706a`.
- ACL: EXECUTE for `authenticated` only.

**Proofs:**
- **Pre-fix:** without the migration, both new invariants fail ("statement succeeded"): the replay after a reversal settles again, and a request with no id settles.
- **Mutations:** removing the guard, the mapping insert, or the id requirement each fails exactly one test.

**App compatibility.** The only caller, `settleBaseWorkerPayroll`, validates `client_request_id` as a UUID and always sends one. The migration can be applied before or after the app deploy.

**Limit.** Settlements made while the guard was missing have no mapping, so replays of those requests are not caught. Request ids live only in page memory, so this closes once open pages reload.

**Rollback:** `evidence/f2-rollback.sql` restores the `20260913180000` definition. Verified on a disposable database: the hash returned to `74d7e947…`.

### F2 gates

Worktree = `main` @ `e3541dfb` + F2.

| Check | Result |
| --- | --- |
| `npm run test:db` | 9 files / **50 passed** (+2 onboarding; the OS-4 KNOWN DEFECT became 2 invariants); no cluster left |
| Default vitest | 232 files / 2,023 passed / 1 skipped (+4) |
| tsc | PASS |
| Full lint | 3 errors / 80 warnings (unchanged) |
| Lint, per changed file (HEAD vs working copy, 8 TS files) | 0 new diagnostics |
| CI for the F1 pushes | `e3541dfb` success (`eda53bc4` cancelled, superseded) |
| NOT RUN | Browser checks; anything against QA or production |

### F2 applied to production (2026-09-26, owner-approved)

**Pre-checks** (read-only):
- The latest history row was `20260926132412` (F1), with 303 rows in total.
- `settle_base_worker_payroll_reviewed` matched the tested pre-image:
  - `md5(prosrc)` `74d7e947…`;
  - one overload with the same signature;
  - SECURITY DEFINER, `search_path=pg_catalog, public, private`;
  - EXECUTE for `authenticated` only.
- The functions the guard depends on equal the tested build: `settle_base_worker_payroll` `82501d5b…` and `reverse_base_payroll_settlement` `19ae6e42…`.
- `base_payroll_payment_requests` has the expected columns and `PRIMARY KEY (org_id, request_id)`, with no API-role grants.

**Applied** with the Supabase connector `apply_migration`, exactly as the file reads.
- Recorded version: `20260926135315 restore_payroll_reversed_request_guard`.
- The local file was renamed to that version.

**Post-checks (VERIFIED):**
- `md5(prosrc)` `fc49b5fd…`, equal to the tested post-image.
- Security settings, `search_path` and ACL are unchanged.
- The inner function is unchanged.
- History now has 304 rows.

**Security advisor:** nothing new.
- The function was already listed in `authenticated_security_definer_function_executable`, and the count is the same 65 as after F1.
- The pre-existing findings are unchanged.

**Rollback:** `evidence/f2-rollback.sql`, with the recorded version filled in.

**Not verified in production:** a real settle → reverse → re-send flow. That would write payroll data, which is out of scope. The behavior is covered by the DB tests against the same function source.

## E22. Fix package F3: production drift capture and `free_server_time` search_path (2026-09-26)

**Owner-approved scope:**
- capture the production-only functions (E18) in migrations;
- pin `free_server_time`'s search_path.

The owner then approved:
- committing and pushing to `main`;
- applying the migrations to production;
- dropping the three legacy policies, a separate authorization change (see "F3 applied to production" below).

### Production inventory (read-only metadata)

- **`rls_auto_enable()`** backs the event trigger `ensure_rls`.
  - Owner: `postgres`.
  - It fires on `ddl_command_end` for `CREATE TABLE`, `CREATE TABLE AS` and `SELECT INTO`.
  - It enables RLS on every new table in `public`.
- **`get_user_org_id()`** is the third clause of the `profiles` SELECT policy "Users read own or organization profiles". `20260903115520` adds that clause only when the helper exists.
- **`get_user_role()`** is referenced by no policy, view or function.
- **Both helpers:**
  - SECURITY DEFINER, `search_path=pg_catalog, public`;
  - EXECUTE for `authenticated` and `service_role`;
  - they return only the caller's own org and role.
- **Consequence:** a database built from migrations had no `ensure_rls`, and its profiles policy lacked the live-membership clause.

### Migrations

- **`20260926174334_capture_production_drift_functions.sql`:**
  - the three functions, verbatim from `pg_get_functiondef`;
  - production's grants, restated;
  - `ensure_rls`, created only if missing;
  - the policy clause, added only if missing.

  On production every statement restates what already exists.
- **`20260926174338_pin_free_server_time_search_path.sql`:** `ALTER FUNCTION public.free_server_time() SET search_path = ''`. The body is only `SELECT now()`.

### Proofs

- **Pre-fix:** all 5 tests in `__tests__/db/production-parity.dbtest.ts` fail on the schema without the two migrations:
  - the functions are absent;
  - a member without an `org_id` claim sees only their own profile;
  - new tables don't get RLS;
  - the search_path is unset.
- **With F3:**
  - The replayed functions hash exactly as production's (`a83f8e45…`, `5f3dc6bb…`, `99be2067…`).
  - The profiles policy text is identical to production's.
- **Idempotency:** re-applying both migrations to a database that already has these objects leaves the functions, ACLs, policies and event triggers unchanged. This is the production situation.
- **Rollback:** `evidence/f3-rollback.sql` is verified. It restores the unpinned function with the same source hash.

### Parity after F3 (replayed schema vs production)

| Object | Replayed | Production | Differences |
| --- | --- | --- | --- |
| Functions in `public`, `private`, `weavly_private` | 206 | 206 | `free_server_time`: the pin is not applied yet. The replayed hash equals production's body plus the pin. Legacy `settle_worker_payroll(…, p_month, p_gross_amount, p_is_final_settlement)`: comments and whitespace only (normalized hashes equal, `a6c4fbc9…`) |
| Non-internal triggers | 167 | 167 | none |
| RLS enabled/forced flags | 127 | 127 | none |
| Policies (including `storage`) | 348 | 351 | 3 production-only legacy policies (below) |

Method and caveats:
- Compared by per-object hashes in 16 buckets, then row by row for the mismatched buckets.
- The replayed schema runs Postgres 17.11, production 17.6. Deparsed text matched wherever hashes matched.
- E18 item 2 (`custom_access_token_hook` grants) is unchanged.

### Production-only legacy policies (not captured; decision needed)

**The policies.** All three apply to role `public`, check `org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())`, and have no role or lock checks:
- `machines` "Users can view org machines" (SELECT);
- `production_logs` "Users can view org logs" (SELECT);
- `production_logs` "Supervisors can insert logs" (INSERT).

**Inert today (VERIFIED on a disposable database with the three policies added):**
- The restrictive `requires_premium_subscription` calls `org_has_subscription_tier(org_id, 'premium')`, which has returned false for every tier since `20260924085030`.
- Base owners, locked or not, saw 0 rows.
- An insert was refused by that policy. The table's validation triggers were disabled for the probe only.
- Anonymous users were refused.

**Not captured.** Copying them into migrations would enshrine lock-free policies.

**Dropped (owner-approved authorization change).** `20260926174343_drop_legacy_production_only_policies.sql` drops them with `DROP POLICY IF EXISTS`, which is a no-op on a database built from migrations.
- Test: the policies are recreated as production defined them, the migration file is applied, and they must be gone.
- Mutation check: with the DROP lines removed, the test fails.

### F3 gates

Worktree = `main` @ `87d9d374` + F3.

| Check | Result |
| --- | --- |
| `npm run test:db` | 10 files / **55 passed** (+5 parity) |
| Default vitest | 232 files / 2,023 passed / 1 skipped |
| tsc | PASS |
| Full lint | 3 errors / 80 warnings (unchanged); the new test file 0 / 0 |
| `npm run test:db` after adding the drop migration | 10 files / **56 passed** |

### F3 applied to production (2026-09-26, owner-approved)

**Pre-checks** (read-only; all matched the tested state):
- Latest history row `20260926135315`, with 304 rows.
- Hashes and ACLs of `get_user_org_id`, `get_user_role`, `rls_auto_enable` and `free_server_time` (unpinned).
- Profiles policy `md5(qual)` `02eeced8…`.
- `ensure_rls` enabled.
- The three legacy policies present; 351 policies in total.

**Applied** with the Supabase connector `apply_migration`. The three calls were issued in one batch; they are independent, and history recorded them in the intended order:

| Version | Migration |
| --- | --- |
| `20260926174334` | `capture_production_drift_functions` |
| `20260926174338` | `pin_free_server_time_search_path` |
| `20260926174343` | `drop_legacy_production_only_policies` |

The local files were renamed to these versions.

**Post-checks (VERIFIED):**
- 307 history rows.
- The captured functions' hashes and ACLs, the profiles policy (`02eeced8…`) and `ensure_rls` are byte-identical to before.
- `free_server_time` has `search_path=""`, with the same source.
- The three legacy policies are gone: 348 policies remain, and `machines`/`production_logs` keep only their migration-defined policies.

**Parity (replayed schema vs production), VERIFIED:**
- Policy buckets are identical (16/16).
- Function buckets are identical except the one holding the comment-only legacy `settle_worker_payroll` overload. Substituting production's hash for that line reproduces production's bucket exactly.

**Security advisor:**
- `function_search_path_mutable` is **cleared**.
- Remaining findings are unchanged:
  - the SECURITY DEFINER WARN (65, by design);
  - leaked-password protection (Auth setting);
  - 8 Free tables with RLS and no policy (INFO).

**Rollback:** `evidence/f3-rollback.sql`. It recreates the three policies, unpins the function and removes the two history rows. The unpin was verified on a disposable database.

## E23. Phase 2 plan and package 2A: lint warnings (2026-09-26)

### Phase 2 plan

Phase 2 was started by the owner. It works one subsystem per package, and each package is behavior-preserving and gated.

| Package | Scope | Risk | Extra approval |
| --- | --- | --- | --- |
| **2A** | Clear the 80 lint warnings (unused bindings, `any`) | Low | no |
| 2B | The 3 react-hooks lint errors (`FreeUsageCard`, `navigation-disclosure`, `use-gutter-dock`; the rails shell is protected) | Medium | no |
| 2C | One builder for the `estimator_quotes` save payload (D1, built 3× in `estimator/actions.ts`) | Medium (costing core; 1A/1B tests) | no |
| 2D | Shared tour runner for the 7 near-duplicate tutorials (M3) | Medium (DOM anchors) | no |
| 2E | Native `confirm()` popups (11) → `ConfirmActionDialog` (M4) | Low | **yes, visible UX** |
| 2F | Estimator decomposition in slices (M1/M2), after 2C | High | later |

### Package 2A result

Lint went from **3 errors / 80 warnings to 3 errors / 0 warnings**. The 3 errors are left for 2B. 32 files changed (+79/−130).

**Removed:**
- Unused imports.
- Unused locals, which were pure computations or unused `useState`/`useMemo`.
- Unused destructured props. The prop types are kept, and the callers still pass them.
- Unused parameters:
  - `requireFactoryWorkflow(_orgId)`: 1 definition and 5 call sites.
  - `getSafePayrollCycleEffectiveDateAction(ruleInput)`: 1 caller, whose argument was ignored.
  - `openAppliedProduction(_quote, _order)`.
  - `index` in two `map` callbacks.

**Kept on purpose:**
- `requireRole` calls whose results are unused. Only the destructured binding was dropped.
- `.select('id').single()` on an insert whose data is unused.
- The `includeInactive` name, which a tour contract asserts.

**`any` replaced with exact types:**
- Rows from explicit `.select()` lists: `PayrollPeriodRow`, `PayrollCycleConfigRow`, `ProtectedPeriodSummary`.
- `PayrollCycleRule`.
- Structural error and result types.
- `unknown` for metadata records.
- `BasePayrollPeriod.calculation_snapshot` is now `unknown`. No consumer depended on `any`: tsc passes.

**Error messages:** `catch (error: any)` became `unknown`, with the same `?.message || fallback` expression, so messages are unchanged.

**Tests:**
- Unused imports removed.
- Two unused rule literals in `payroll-cycle-integration.test.ts` now carry `expect(validateCycleRule(...).valid).toBe(true)`. This strengthens the test.
- Two unused file reads were removed. Their files are already covered: one is imported by the test, the other has an explicit `existsSync` assertion (`plan-aware-settings-permissions.test.ts:106-111`).
- No assertion was weakened.

**Checked before removal:** each removed name was searched in `__tests__`. The contract hits (`pendingAdvances`, `ChevronDown`, `accent`, `includeInactive`) refer to other occurrences that remain.

### Observations found while clearing warnings (not changed; behavior preserved)

| ID | Finding | Evidence |
| --- | --- | --- |
| OS-13 | Payroll cycle settings fallback bypasses the RPC and is non-atomic (escalated, E12 row 10b). **Corrected in E25:** the action is `saveBasePayrollCycleConfig`, and table constraints already block the backdating case | See the details below this table |
| P2-O1 | The rate-book tutorial launcher ignores `disabled`, so it stays clickable while a rate change is pending | `RatesClient.tsx:1539` passes `disabled={isPending}`; `RateBookTutorialLauncher` never forwarded it |
| P2-O2 | `BaseMachineBoard` receives `onActivateQualityClick` but never renders an action for it | The parent is `BaseProductionClient.tsx`. Leftover, or a missing entry point (INFERRED) |
| P2-O3 | Base onboarding `Step6Review` receives `readiness` but does not display it | Leftover, or a missing summary (INFERRED) |
| P2-O4 | `BaseAssignmentWorkspace`'s `includeInactive` state has no setter in use (no toggle); only the tour view overrides it | `BaseAssignmentWorkspace.tsx:99` |
| P2-O5 | Job-creation leftovers in `BaseProductionClient` are removed. `BaseMachineJobs.tsx`, `createBaseProductionJob`, `updateBaseProductionJobStatus` and `lib/base-job-summaries.ts` now have no application importers | Phase 3 candidates under the deletion protocol |

**OS-13 details** (as first recorded; corrected in E25):
- **The action:** `app/(dashboard)/owner/production/actions.ts` `updateBasePayrollCycleAction`. **Correction:** the name is `saveBasePayrollCycleConfig`.
- **Where the RPC falls short:** it handles the same-day in-place case itself, but refuses an effective date before the current one.
- **What the fallback does** when the RPC errors: it closes the active config, then inserts a new one, as two separate writes with the user client.
- **Why those writes succeed:** production RLS allows Base owners to write directly (`base_payroll_cycle_configs_owner_write`, ALL, `private.base_production_core_access(org_id)`; `authenticated` has INSERT/UPDATE).
- **Consequence:** the RPC's ordering rule and advisory lock are bypassed on the fallback path. The action's own protected-period check still applies.

### Gates

Worktree = `main` @ `2794f4a0` + 2A.

| Check | Result |
| --- | --- |
| tsc | PASS |
| Full lint | 3 errors / **0 warnings** |
| Default vitest | 232 files / 2,023 passed / 1 skipped |
| `npm run test:db` | 10 files / 56 passed |
| Build | NOT RUN (type-only and dead-binding changes) |

## E24. Package 2B: the three react-hooks lint errors (2026-09-26)

Owner-approved. **Lint is now fully green:** `eslint --max-warnings=0 .` exits 0, the first time in this program. CLAUDE.md conflict #7 (lint policy vs. reality) is resolved in practice.

| File | Rule | Change |
| --- | --- | --- |
| `components/estimator/FreeUsageCard.tsx` | `preserve-manual-memoization` | Reads `quota?.resetsAt` into a local before the `useMemo`, so the inferred and declared dependencies match. Output is identical |
| `components/navigation/navigation-disclosure.tsx` (rails shell) | `set-state-in-effect` | Replaced the effect that set `isClosing` with React's documented "adjust state when a prop changes" pattern. `isClosing` is set during render when `expanded` changes; the 160 ms timer is the only effect. The `wasExpanded`/`closeTimer` refs are gone |
| `hooks/use-gutter-dock.ts` (Free usage card dock) | `set-state-in-effect` | The measurement is now a pure, exported `dockUpdater(container, config)` (the old `updateDock` body, verbatim, returning its state updater). The effect applies `setDockState(dockUpdater(containerRef.current, config))` synchronously, as before. The rule accepts ref-derived values, and its re-run triggers are unchanged. Public API unchanged |

**New test:** `__tests__/gutter-dock.test.ts` (5 CHARACTERIZATION tests) pins the docking rules: 1200px minimum width, 280px minimum gutter, centring, forced docking, and a missing container or window.

### Old-vs-new browser comparison (VERIFIED)

Method:
- The pre-change copies and the new files were bundled side by side into a throwaway page with Vite, in the worktree's ignored `scratch/`.
- Stubs replaced `next/navigation`, `next/link` and i18n.
- The page ran in the built-in browser. It recorded every `hidden` mutation, plus the value sampled at each animation frame, which is what gets painted.
- The harness was deleted afterwards. No console errors.

| Scenario | Old | New |
| --- | --- | --- |
| Expand | visible at 4 ms | visible at 4 ms |
| Collapse (click) | DOM: hidden 2 ms → visible 3 ms → hidden 164 ms. Painted: visible, then hidden from 179 ms | DOM: hidden 164 ms. Painted: visible, then hidden from 179 ms |
| Collapse, re-expand at 80 ms | transient DOM flip; stays visible; no stray hide | no DOM change; stays visible; no stray hide |
| Reduced motion collapse | hidden at 1 ms (painted 22 ms) | hidden at 1 ms (painted 22 ms) |
| Gutter dock: 1400px and 1100px viewports, remounts, 352px vs 252px gutters | identical states in every case | identical |

**Result:** painted behavior is identical. The new disclosure removes an unpainted hidden/visible flip, which is the extra render the rule warns about. For non-click updates, where effects are not flushed before paint, that flip could previously have shown as a one-frame flash; now it cannot.

**Gates:**

| Check | Result |
| --- | --- |
| Strict lint | exit 0 |
| tsc | PASS |
| Default vitest | 233 files / 2,028 passed / 1 skipped |
| `npm run test:db` | 11 files / 59 passed (with OS-13, E25) |

## E25. OS-13 fix: payroll cycle settings are RPC-only (2026-09-26)

Owner-approved as its own package.

**The fix.** `saveBasePayrollCycleConfig` (`app/(dashboard)/owner/production/actions.ts`) now returns `databaseError(rpcError, …)` when `update_base_payroll_cycle` refuses. The direct-write fallback is removed: the same-day update, the close of the active config and the insert. The user-facing message is unchanged: "Failed to save payroll cycle configuration. Your existing settings have not changed."

**Test:** `__tests__/db/payroll-cycle-settings.dbtest.ts` runs end to end through the real RPC, with only auth and tier mocked:
- a later date closes the previous cycle;
- a date before the current cycle is refused and nothing changes;
- a same-day change updates in place.

Every call goes through `user:update_base_payroll_cycle`. The adapter throws on direct table writes, so any fallback write fails the test.

**Pre-fix evidence and severity correction (VERIFIED):**
- On the unfixed code, the refused-backdate case reached the direct `.update()`.
- With a write-capable adapter in a disposable copy, the unfixed code's writes were still rejected:
  - the close by `CHECK base_payroll_cycle_configs_effective_range` (`effective_from <= effective_until`);
  - the second active insert by the unique index `idx_base_payroll_cycle_active`.

  The unfixed code therefore returned the same error with the data unchanged.
- So the ordering rule was **not** bypassable, and OS-13 is **Low**, not Low–Med.
- **What the fix still removes:** an unlocked direct-write path that ran on *any* RPC error, including transient ones. It could leave the org with no active cycle if the insert failed after the close succeeded.
- The E12/E23 entries are corrected, including the action name.

**Not changed (noted):** production RLS still lets Base owners write `base_payroll_cycle_configs` directly through the API (`base_payroll_cycle_configs_owner_write`). Making the RPC the only writer at the database level would be an RLS change needing its own approval. The table constraints above keep such writes consistent.

## E26. Package 2C: one builder for the `estimator_quotes` save payload (2026-09-26)

Owner-approved. Resolves duplication lead D1 (E8) for the live paths.

### Change

- New pure module `lib/estimator-quote-payload.ts`: `buildEstimatorQuotePayload(input)`. It holds the ~60 column mappings of a saved costing row: recipe snapshot, result snapshot, reconciliation, legacy flat fields and worker-rate snapshot.
- The two live call sites now pass only what differs:
  - `saveEstimatorQuoteV3`: record kind, status, template, instructions and quotation document fields from the params; **commercial scalars from the authoritative result**; party name `.trim()`.
  - `saveAsFabricTemplate`: fixed costing/draft values; **commercial scalars from the estimate**; party name `normalizeTemplateName` (collapses inner spaces).
- `meters` is `orderQuantityM ?? 0` in both, as before.
- `actions.ts`: +52/−134 lines (net −82); the builder is 113 lines, most of them the mapping list the two sites used to repeat.
- **Left alone:** the third copy, in `createMarketRunFromEstimator`, is unreachable. It is behind `requireFactoryWorkflow()`, which always refuses. It stays for the Phase 3 deletion protocol.

### Proof of identical behavior (VERIFIED)

- A temporary capture test ran both live actions end to end against the replayed schema, in 5 variants:
  - costing with a party (irregular spacing) and quantity;
  - costing without a party or quantity;
  - new quality with a party and quantity;
  - new quality without them;
  - costing that also updates its saved quality (`save_estimator_costing_revision_v2`).
- It recorded every RPC call and its arguments: 10 calls and 58 KB, including the attested quote payloads and template payloads.
- Before vs after, with keys sorted and run-specific ids and timestamps normalized, the outputs were **identical** (SHA-256 `2057057962e9a132…` both).
- The capture test was not committed.
- Recorded for information: for these inputs the estimate-sourced and result-sourced commercial scalars were equal, and both paths produce the same key set.

### Tests

**New:**
- `__tests__/estimator-quote-payload.test.ts` (5):
  - result and recipe mapping;
  - commercial passthrough and `meters`;
  - direct-mode-only overhead override, with the legacy `overhead_pct` always 0;
  - record-kind extra columns;
  - legacy fallbacks (68 picks, 75 denier, 0 rate).
- `__tests__/db/costing-save.dbtest.ts` gains the first end-to-end test of `saveAsFabricTemplate`: the quality and an attested version-1 costing in one RPC, priced at the independent reference ₹31.44. It also passes on the pre-2C `actions.ts`, so it pins existing behavior.

**Source-contract tests updated deliberately (6 assertions in 4 files).** They asserted the payload's inline text in `actions.ts`, down to spacing:
- `base-p1-remediation`: party, quantity and meters sources.
- `base-estimator-go-readiness`: `factory_profile_updated_at`.
- `batch10-estimator-quote-order-snapshots`: worker rate, landed cost, idempotency key.
- `sprint3-estimator-simplicity`: `overhead_pct` 0.

After the refactor, three of the old strings survived **only in the unreachable market-run copy**, so those assertions would have passed while protecting nothing live. Each now pins the live call site (via `functionBody` where useful) and the builder mapping. The single market-run assertion is scoped to `createMarketRunFromEstimator`, so Phase 3 removes it together with the function.

### Observation

| ID | Finding |
| --- | --- |
| P2-O6 | The two costing saves normalize the party name differently: "save as quality" collapses inner spaces ("Shah Textiles"); a costing save only trims ("Shah   Textiles"). Preserved, and pinned as CHARACTERIZATION in the new DB test. A product decision if they should match |

### Gates

Worktree = `main` @ `ce4c3ff0` + 2C.

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default vitest | 234 files / 2,033 passed / 1 skipped |
| `npm run test:db` | 11 files / 60 passed |

## E27. Package 2D: shared guided-tour hooks (2026-09-27)

Owner-approved. Resolves maintainability lead M3 (E5).

### Change

The seven page tours in `components/tours/` (Configuration, Machines, Workers, Payroll, Production, Stock, Dispatch) each carried two copies of the same effects: the modal trap and the panel placement. These now live in `hooks/use-guided-tour.ts`.

- **`useGuidedTourModal`:**
  - makes the rest of the page inert (including elements added later) and blocks pointer input outside the panel;
  - locks the viewport, keeps focus in the panel with Tab cycling, closes on Escape, and moves steps with arrows and Enter;
  - restores inertness, scroll and focus on close.
- **`useGuidedTourPlacement`:** scrolls the target into view, re-measures for 1.5 s and on resize or scroll, and moves the panel to the left or bottom when it would cover the target, except inside the tour's own preview.
- **Per-tour differences stay explicit in each tour:**
  - the return scroll (`returnScroll` or the scroll position at open);
  - the preview selector;
  - one of three named focus-return strategies (`captureFocusReturn`, exported for tests), each reproducing the pre-merge code exactly:
    - `launcher`: Machines, Workers, Configuration, Stock, Dispatch;
    - `return-focus-at-close`: Payroll;
    - `return-focus-or-launcher`: Production.
- **Kept per tour:** steps, copy, completion rules and panel markup.
- **Hook order:** the hooks are called where the old effects were, so the effect order is unchanged, and each component's `useState` calls keep their relative order. The Dispatch panel test mocks `useState` by call order and passes unchanged.
- **Size:** the 7 tutorials went from 1,077 to 527 lines (+46/−585, git diff). With the 158-line hook, the total is 685.

### Verification

- **Structural (VERIFIED).** A scripted transformation first asserted that each file's two effects were identical to the Machines version, except for the known variant lines (focus capture, scroll source, dependencies) and the preview selector. It aborted on any other difference. None were found.
- **Old vs new in a real browser (VERIFIED).**
  - **Setup:** pre-change copies of Machines, Payroll and Production (one per focus strategy) and the new versions, bundled with Vite in the worktree's ignored `scratch/`. Only `useTranslation` and `persistTourCompleted` were stubbed. The page ran in the built-in browser at a 1280×800 viewport.
  - **Recorded per run:**
    - on open: focus, inert map, blocked outside click;
    - while open: Tab/Shift+Tab cycle; ArrowRight, ArrowLeft and Enter step changes; inertness of a body child added mid-tour; panel corner;
    - on Escape: step, focus target, restored inert map, restored scroll, completion calls.
  - **Scenarios (10):**
    - Machines ×3, plus Machines with the launcher button replaced mid-tour;
    - Payroll with a starting control, and with that control removed and the launcher replaced;
    - Payroll without a starting control;
    - Production without a starting control, with the launcher replaced, and with a starting control.
  - Old and new were run in alternating order.
  - **Result:** all 10 records identical. No console errors. The harness was deleted.
  - **Note:** a first attempt ran with the pane hidden (0×0 viewport). There, one panel-corner reading differed once for each version independently of the change, a measurement artefact. With a real viewport every run matched.

### Tests

- **New:** `__tests__/guided-tour-focus.test.ts` (3) pins the three focus-return strategies with stand-in elements, including disconnected elements and a launcher that re-renders.
- **Source-contract tests updated deliberately (3 tests):** `configuration-tour`, `payroll-tour-preview` and `production-tour-preview` asserted the moved focus and scroll lines inside each tutorial. They now assert:
  - the tutorial's hook call and strategy name;
  - the implementation lines in `hooks/use-guided-tour.ts`.
- All 262 tour tests pass, including the SSR render tests for Stock, Payroll, Production and Dispatch.

### Gates

Worktree = `main` @ `7a15df69` + 2D.

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default vitest | 235 files / 2,036 passed / 1 skipped |
| `npm run test:db` | 11 files / 60 passed |

## E28. Phase 3 inventory and batch 3A (2026-09-27)

Phase 3 was approved by the owner. **Each batch is proposed with its evidence and lands only after its own approval** (BRIEF rule 7).

### Method (VERIFIED)

- **Reachability.** All static imports, re-exports and literal dynamic `import()`/`require()` were resolved (`@/` alias and relative paths), then followed transitively from every framework entry point:
  - `app/**/{page,layout,route,loading,error,not-found,template,default,global-error,manifest,…}`;
  - `proxy.ts`, `instrumentation*`, `next.config.ts`, `sentry.*`;
  - `worker/`.

  Result: 547 source files; **68 unreachable** (~7,750 lines).
- **String references.** For each unreachable file, its path and bare name were searched across every tracked text file, split by area: tests, scripts, app, config, `supabase/`, docs. Over half the suite reads sources by path, so import counts alone are not enough. Config path hits were only tracked QA evidence (`output/qa/*.json`), which is historical and is not edited.
- **Dynamic loading.** No template-string or variable `import()`/`require()` exists in `app`, `components`, `lib`, `hooks`, `worker`, `proxy.ts` or `next.config.ts`.
- **Tooling.** The scripts ran from the scratchpad; they are not committed.

### Inventory and batches

| Batch | Contents | Why separate |
| --- | --- | --- |
| **3A** | No importers anywhere; referenced only by docs or QA evidence; not security, billing, compliance, auth or UI primitives | Lowest risk |
| 3B | Unused `components/ui` primitives, plus any dependencies they free | Dependency change |
| 3C | Dead modules still read or imported by tests or scripts | Their tests and contracts go with them |
| 3D | Offline-sync provider and hooks | PWA and drafts area, test-consumed |
| 3E | Auth, billing, compliance, access codes and tracking tokens | C10/C11; needs owner review |
| 3F *(not in the table)* | Dead branches inside live files: the `requireFactoryWorkflow` callers in `estimator/actions.ts`, including the market-run payload | Symbol-level; needs UI caller analysis |

| File | Lines | Batch | Importers (app/test/script/other) | Path references outside docs and QA evidence |
| --- | --- | --- | --- | --- |
| `app/(auth)/actions.ts` | 10 | 3E | 0/0/0/0 | test: `auth-login-performance.test.ts`, `auth-reset-flow.test.ts`, `bill-008-referral-boundary.test.ts`, `customer-contact-channels.test.ts`; app: `ForgotPasswordForm.tsx`, `login-form.tsx`, `actions.ts`, `page.tsx` |
| `app/(auth)/signup/actions.ts` | 25 | 3E | 0/0/0/0 | none |
| `app/(dashboard)/owner/actions/compliance.ts` | 127 | 3E | 2/0/0/0 | app: `ComplianceNotice.tsx`, `LanguageRequestDialog.tsx` |
| `app/(dashboard)/owner/billing/actions.ts` | 71 | 3E | 1/0/0/0 | app: `BillingProfileForm.tsx` |
| `app/(dashboard)/owner/production/BaseMachineJobs.tsx` | 70 | 3C | 0/0/0/0 | test: `base-production-core.test.ts` |
| `app/(dashboard)/owner/production/BaseSetupWorkspace.tsx` | 12 | **3A** | 0/0/0/0 | none |
| `app/(dashboard)/owner/settings/audit/ComplianceRegistry.tsx` | 183 | 3E | 0/0/0/0 | none |
| `components/AccessCodeBanner.tsx` | 102 | 3E | 0/0/0/0 | none |
| `components/DailyEntry.tsx` | 73 | **3A** | 0/0/0/0 | none |
| `components/RoleBanner.tsx` | 36 | **3A** | 0/0/0/0 | none |
| `components/advances/WorkerExitDialog.tsx` | 95 | **3A** | 0/0/0/0 | none |
| `components/billing/AutoRenewToggle.tsx` | 121 | 3E | 0/0/0/0 | none |
| `components/billing/BillingProfileForm.tsx` | 54 | 3E | 0/0/0/0 | none |
| `components/billing/FreeBillingAction.tsx` | 97 | 3E | 0/0/0/0 | none |
| `components/compliance/ComplianceNotice.tsx` | 182 | 3E | 0/0/0/0 | none |
| `components/compliance/LanguageRequestDialog.tsx` | 112 | 3E | 1/0/0/0 | none |
| `components/cost-analysis-details.tsx` | 351 | **3A** | 0/0/0/0 | none |
| `components/machines/MachineRegisterPanel.tsx` | 95 | **3A** | 0/0/0/0 | none |
| `components/machines/MachineRow.tsx` | 106 | **3A** | 1/0/0/0 | none |
| `components/offline-sync-provider.tsx` | 22 | 3D | 0/0/0/0 | none |
| `components/onboarding/PlanSelection.tsx` | 99 | 3E | 0/0/0/0 | none |
| `components/onboarding/loomi-avatar.tsx` | 44 | **3A** | 0/0/0/0 | none |
| `components/settings/factory-cost-profile.tsx` | 1094 | 3C | 0/0/0/0 | test: `base-p1-coverage.test.ts`, `base-settings-cold-load.test.ts`, `estimator-only-experience.test.ts`, `monthly-overhead-calculator.test.ts` |
| `components/settings/monthly-overhead-calculator.tsx` | 418 | 3C | 1/0/0/0 | test: `monthly-overhead-calculator.test.ts`; app: `factory-cost-profile.tsx`; script: `base-fixed-salary-preview.jsx` |
| `components/settings/template-manager.tsx` | 202 | 3C | 0/0/0/0 | test: `base-settings-cold-load.test.ts`, `sprint7-ux-polish.test.ts` |
| `components/ui/amount.tsx` | 64 | 3B | 1/0/0/0 | app: `WorkerExitDialog.tsx` |
| `components/ui/avatar.tsx` | 110 | 3B | 0/0/0/0 | none |
| `components/ui/calendar.tsx` | 115 | 3B | 0/0/0/0 | none |
| `components/ui/checkbox.tsx` | 28 | 3B | 0/0/0/0 | none |
| `components/ui/form.tsx` | 179 | 3B | 0/0/0/0 | none |
| `components/ui/input-otp.tsx` | 78 | 3B | 0/0/0/0 | none |
| `components/ui/radio-group.tsx` | 45 | 3B | 0/0/0/0 | none |
| `components/ui/scroll-area.tsx` | 59 | 3B | 0/0/0/0 | none |
| `components/workers/WorkerRegisterPanel.tsx` | 99 | **3A** | 0/0/0/0 | none |
| `components/workers/WorkerRow.tsx` | 133 | **3A** | 1/0/0/0 | none |
| `hooks/use-enter-key-navigation.ts` | 30 | **3A** | 0/0/0/0 | none |
| `hooks/use-offline-sync.ts` | 29 | 3D | 1/0/0/0 | test: `sprint22-auth-boundary.test.ts`; app: `offline-sync-provider.tsx` |
| `hooks/use-online-status.ts` | 25 | 3D | 2/0/0/0 | app: `offline-sync-provider.tsx`, `use-offline-sync.ts` |
| `hooks/use-transliterate.ts` | 14 | **3A** | 0/0/0/0 | none |
| `lib/access-codes.ts` | 123 | 3E | 0/0/0/0 | none |
| `lib/actions/order-assignment.ts` | 78 | **3A** | 0/0/0/0 | none |
| `lib/base-job-summaries.ts` | 27 | 3C | 0/1/0/0 | test: `base-job-summaries.test.ts`; script: `job-summaries-benchmark.mjs` |
| `lib/base-plan-policy.ts` | 43 | 3C | 0/1/0/0 | test: `sprint16-billing-language.test.ts` |
| `lib/commercials/date-buckets.ts` | 63 | **3A** | 0/0/0/0 | none |
| `lib/commercials/receivables.ts` | 157 | **3A** | 0/0/0/0 | none |
| `lib/dashboard-trend.ts` | 38 | **3A** | 0/0/0/0 | none |
| `lib/dispatch/archive.ts` | 27 | 3C | 0/1/0/0 | test: `dispatch-archive.test.ts` |
| `lib/estimator-capacity.ts` | 15 | 3C | 0/1/0/0 | test: `estimator-production-readiness.test.ts` |
| `lib/factory-today-checklist.ts` | 125 | **3A** | 0/0/0/0 | none |
| `lib/free-browser-cache.ts` | 20 | 3C | 0/1/0/0 | test: `free-browser-cache.test.ts` |
| `lib/generate-payslip.ts` | 369 | **3A** | 0/0/0/0 | none |
| `lib/machine-operator-payroll.ts` | 285 | 3C | 0/1/0/0 | test: `machine-operator-payroll.test.ts` |
| `lib/market-runs.ts` | 50 | 3C | 0/1/0/0 | test: `market-runs.test.ts` |
| `lib/master-data-loom-guardrails.ts` | 122 | **3A** | 0/0/0/0 | none |
| `lib/owner-analytics.ts` | 302 | **3A** | 0/0/0/0 | none |
| `lib/payroll-cycle.ts` | 179 | 3C | 0/2/0/0 | test: `b10-india-calendar-boundaries.test.ts`, `base-onboarding-payroll-step.test.ts`, `payroll-cycle-engine.test.ts`, `payroll-cycle-integration.test.ts`; app: `actions.ts`, `BaseProductionClient.tsx`, `actions.ts`, `loaders.ts` |
| `lib/payroll-manual-adjustments.ts` | 153 | **3A** | 0/0/0/0 | none |
| `lib/payroll-read-models.ts` | 18 | **3A** | 0/0/0/0 | none |
| `lib/payroll-statutory.ts` | 69 | **3A** | 0/0/0/0 | none |
| `lib/production-drafts.ts` | 53 | **3A** | 0/0/0/0 | none |
| `lib/production-log-validation.ts` | 177 | 3C | 0/1/0/0 | test: `p1-production-log-strictness.test.ts` |
| `lib/production-worker-assignment-policy.ts` | 91 | **3A** | 1/0/0/0 | none |
| `lib/tracking-token.ts` | 10 | 3E | 0/0/0/0 | none |
| `lib/transliterate.ts` | 184 | **3A** | 1/0/0/0 | app: `use-transliterate.ts` |
| `lib/wage-config.ts` | 26 | **3A** | 0/0/0/0 | none |
| `lib/whatsapp-provider.ts` | 15 | **3A** | 0/0/0/0 | none |
| `lib/whatsapp.ts` | 58 | **3A** | 0/0/0/0 | none |
| `lib/worker-validation.ts` | 68 | **3A** | 0/0/0/0 | none |

### Batch 3A (approved by the owner 2026-09-27; deleted)

**30 files, 3,047 lines.**

**Import edges touching the batch are all internal:**
- `MachineRegisterPanel` → `MachineRow`;
- `WorkerRegisterPanel` → `WorkerRow`;
- `use-transliterate` → `lib/transliterate`;
- `factory-today-checklist` → `production-worker-assignment-policy`.

**What the files are:**
- **Superseded register panels:** machines and workers, with their row components. The current registers live in `owner/production/registers/*`. Prior-cleanup lead C07.
- **Pre-Base leftovers:**
  - owner analytics, dashboard trend and the factory-today checklist;
  - the commercials receivables helpers;
  - the order-assignment action;
  - payslip generation, statutory payroll, manual-adjustment and read-model helpers;
  - wage config, production drafts and the loom guardrails;
  - worker validation;
  - WhatsApp payslip sending (the live WhatsApp code is `supabase/functions/_shared/whatsapp.ts`, which is untouched).
- **Unused UI:** `RoleBanner`, `loomi-avatar`, `cost-analysis-details`, `WorkerExitDialog`, `DailyEntry` (still on mock data), `use-enter-key-navigation` (lead C08), and the transliteration hook with its library.
- **`BaseSetupWorkspace.tsx`:** its own comment calls it a "rollback composition only" that canonical routes never mount. Git history covers that rollback. **The owner decided to delete it (2026-09-27).**

**Roles, plans and languages:**
- None of the files is mounted by any route, so no role, plan or language path renders them.
- Server actions in unreachable modules are never referenced by client code, so they are not registered.

**Gates with 3A removed** (worktree = `main` @ `05587ce5` minus 3A):

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default vitest | 235 files / 2,036 passed / 1 skipped (unchanged: no test consumed these files) |
| `npm run test:db` | 11 files / 60 passed |
| Production build (credential-free copy, isolated wrapper) | PASS: compiled in 79 s; 53 static pages generated; PWA custom worker built; exit 0 |

**Recovery:**
- `git revert <3A commit>`;
- or restore single files with `git checkout 05587ce5 -- <path>`.

## E29. Batch 3C: dead modules and the tests that only exercised them (2026-09-27)

Approved by the owner (2026-09-27); deleted.

### Deleted modules (13 from the E28 inventory, plus 3 tooling files)

| Module | Consumers before deletion | Handling |
| --- | --- | --- |
| `owner/production/BaseMachineJobs.tsx` | one text assertion (`base-production-core.test.ts`) | assertion removed |
| `components/settings/factory-cost-profile.tsx` (1,094 lines) | text contracts in 9 test files | dead-file assertions removed (below) |
| `components/settings/template-manager.tsx` | 2 test files | dead-file assertions removed |
| `components/settings/monthly-overhead-calculator.tsx` | 1 test file; QA preview `scripts/qa/base-fixed-salary-preview.jsx` | component tests removed; the preview's `?view=overhead` mode removed (operations and payroll views kept) |
| `lib/base-job-summaries.ts` + `scripts/performance/job-summaries-{benchmark.mjs,fixture.ts}` | its own test and benchmark | removed together |
| `lib/base-plan-policy.ts` | `sprint16-billing-language` | the live locale glossary check is kept, with its 11 terms inlined; the two assertions on the module's own constants removed |
| `lib/dispatch/archive.ts`, `lib/market-runs.ts`, `lib/free-browser-cache.ts`, `lib/payroll-cycle.ts`, `lib/production-log-validation.ts` | their own test files | test files deleted; `b10-india-calendar-boundaries` keeps its `lib/time` cases and loses the two `payroll-cycle` cases |
| `lib/machine-operator-payroll.ts` | `machine-operator-payroll.test.ts` | helper tests removed; the migration contract (historical SQL) kept |
| `lib/estimator-capacity.ts` | one case in `estimator-production-readiness` | case removed; no live loom-output calculation exists |
| `scripts/ci/lint-changed.mjs` | `ci-lint-changed.test.ts` | removed together (CI has used `npm run lint` since `3e8b8725`) |

**Test files deleted (8, 73 tests):**
- `base-job-summaries`, `market-runs`, `free-browser-cache`, `dispatch-archive`, `payroll-cycle`;
- `p1-production-log-strictness` (its "payroll/stock safety" cases asserted local objects only);
- `ci-lint-changed`;
- `ux-007-settings-control-names`.

**Cases removed from kept files: 11.**

**Suite:** 235 → 227 files, 2,036 → 1,952 tests. Every removed test exercised only deleted code.

### Coverage that was illusory (recorded, not re-pointed)

The contracts on `factory-cost-profile.tsx` and `template-manager.tsx` pinned the retired settings screen: accessible labels, save-scope wording ("Save for new Cost Estimates"), the target-margin and yarn-review fields, cold-load retry states, and archive confirmations. Settings has rendered `PlanAwareSettingsView` since `25933ba5`.

**None of the asserted strings exists in live code** (VERIFIED by search), so these tests never protected the current screens.

**Follow-up for Phase 4/6:** check the plan-aware settings cards for the same intents: accessible names on rate inputs and switches, save-scope messaging, and load-error retry states. Add live tests where they are missing.

### Gates with 3C applied

Worktree = `main` @ `6ba75687` + 3C.

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default vitest | 227 files / 1,952 passed / 1 skipped |
| `npm run test:db` | 11 files / 60 passed |
| Production build (credential-free copy) | PASS (compiled 77 s; 53/53 static pages) |
| Remaining path references to deleted files | none outside docs and QA evidence; one explanatory comment in `sprint16-billing-language` |

**Recovery:** `git revert <3C commit>`, or `git checkout 6ba75687 -- <path>`.

## E30. Batch 3B: unused UI primitives and the dependencies they freed (2026-09-27)

Approved by the owner (2026-09-27): deleted and committed in `4de225d0`, including the two `CLAUDE.md` corrections.

### Deleted files (8, 670 lines)

`components/ui/{amount,avatar,calendar,checkbox,form,input-otp,radio-group,scroll-area}.tsx`

Checked before deletion (all VERIFIED):
- **Imports:** the reachability scan was re-run on `16481b76`. None of the 8 files has an importer in app, tests, scripts or other files. After deletion, unreachable files went from 25 to 17 (exactly these 8) and reachable files stayed at 479, so nothing new was stranded. `label.tsx` (imported by `form.tsx`) is still used by the three auth forms.
- **Path and string references:** none outside docs and QA evidence. `amount.tsx`'s last importer, `WorkerExitDialog.tsx`, was deleted in 3A.
- **CSS and config:** no selector targets the deleted `data-slot` values (`avatar*`, `input-otp*`, `scroll-area*`). The `dropdown-menu-checkbox-item` and `dropdown-menu-radio-item` selectors in `app/mobile.css` belong to the live dropdown menu. `components.json`, `next.config.ts`, the PostCSS, ESLint and Vitest configs name none of them.
- **Tests:** no test lists `components/ui` as a directory.

### Dependencies removed

| Package | Only importer | Note |
| --- | --- | --- |
| `react-hook-form` 7.71.1 | `form.tsx` | |
| `@hookform/resolvers` 5.2.2 | none (already unused) | Its peer is `react-hook-form`; left alone, npm would re-install that peer |
| `input-otp` 1.4.2 | `input-otp.tsx` | |
| `@radix-ui/react-avatar` 1.1.10 | `avatar.tsx` | |
| `@radix-ui/react-radio-group` 1.3.8 | `radio-group.tsx` | |
| `@radix-ui/react-scroll-area` 1.2.10 | `scroll-area.tsx` | |

The lockfile also dropped three packages that only these needed:
- `@radix-ui/react-use-is-hydrated` 0.1.0 (from `react-avatar`);
- `use-sync-external-store` 1.6.0 (from `react-use-is-hydrated`);
- `@standard-schema/utils` 0.3.0 (from `@hookform/resolvers`).

Kept, because live code uses them: `@radix-ui/react-label` (`label.tsx`), `@radix-ui/react-slot` (`button.tsx`, `badge.tsx`), `date-fns` (4 app files plus `next.config.ts` `optimizePackageImports`), `lucide-react` and `zod` (19 importers).

### How the lockfile was produced

- **npm 11.6.2 (local), `uninstall --package-lock-only`:** also deleted the two nested `@rolldown/binding-wasm32-wasi/node_modules/@emnapi/{core,runtime}` entries that `09213fde` added so CI's newer npm accepts the lockfile. **Rejected.**
- **npm 11.19.0 (the version in the CI log for run 36266321952):** removed the right 9 entries, but also toggled `peer: true` on 71 unrelated entries (41 on, 30 off). No version or integrity changed.
- **Committed lockfile:** the previous lockfile minus exactly the 9 package entries and 6 root declarations that npm 11.19.0 removed. It equals npm 11.19.0's output apart from the `peer` flags, and the diff is deletions only (168 lines).
- **`npm ci --dry-run`:** npm 11.6.2 installs 1,087 → 1,078 packages; npm 11.19.0 installs 1,084 → 1,075. Both accept the lockfile and both drop exactly 9. The 3-package gap between the two npm versions was already there.

The worktree's `node_modules` is a symlink to the main checkout's, so no install ran in the worktree. All dependency work ran in a credential-free copy (tracked files only, no `.env*`).

### Gates

| Check | Result |
| --- | --- |
| Worktree (`main` @ `16481b76` + 3B): `npm run lint` | exit 0 |
| Worktree: tsc | PASS |
| Worktree: default vitest | 227 files / 1,952 passed / 1 skipped (unchanged from 3C) |
| Worktree: `npm run test:db` | 11 files / 60 passed |
| Clean install in the copy: `npm ci --ignore-scripts` with npm 11.19.0 | 1,075 packages; none of the 6 removed packages present |
| On that install, CI's commands: tsc (`--incremental false`), `npx vitest run`, `npm run lint` | PASS / 227 files, 1,952 passed, 1 skipped / exit 0 |
| On that install: production build (`npm run build --ignore-scripts`) | PASS (compiled 78 s; 53/53 static pages) |
| `package.json` and lockfile committed vs. the tested copy | byte-identical (`cmp`) |

**Recovery:** `git revert 4de225d0` restores the files, `package.json` and the lockfile together; then run `npm ci`.

## E31. Batch 3F: dead factory-workflow server paths (2026-09-27)

Approved by the owner (2026-09-27); committed in `1259c566`.

### Caller analysis (VERIFIED)

`requireFactoryWorkflow()` always returned "This factory workflow is unavailable on Free, Lite, and Base." It guarded five actions:

| Action | Callers | Reachable? |
| --- | --- | --- |
| `getFixedWorkersForOverhead` | `getEstimatorSecondaryData`, only when `canUseProduction`, a local `const … = false` | No |
| `getMonthlyOutputSuggestion` | none | No |
| `convertAcceptedQuoteToOrder` | `QuotesClient` convert dialog. It opens only from `canCreateOrder`, which needs `canUseQuotationLifecycle(…, canUseQuotationWorkflow)`. `quotes/page.tsx` sets `canUseQuotationWorkflow = canUseProduction = false`. | No |
| `startPartyOrderFromEstimator` | `EstimatorClient.handleStartPartyOrder`. Its buttons render only under `canUseProduction && !isStandaloneCostingSession`. | No |
| `createMarketRunFromEstimator` | `EstimatorClient.handleSaveQuote('market')`. Reached only with `mode === 'market'`. Every `setMode('market')` sits under `canUseProduction`; the initial mode is `'quote'` unless `canUseProduction`. | No |

Both renderers of `EstimatorClient` pass `canUseProduction = false`: `owner/estimator/page.tsx` (local constant) and `app/free/FreeClient.tsx` (literal). `isStandaloneCostingSession = !canUseProduction || …` is therefore always true.

`convertQuoteToOrder` was already a retired stub with no callers.

### Change

Deleted from `estimator/actions.ts` (2,727 → 2,138 lines):
- the bodies above, including:
  - the third `estimator_quotes` payload copy (in the market-run path, left by 2C);
  - the `start_party_order_from_estimator_v2` and `convert_accepted_quote_to_order` RPC calls;
  - the direct service-role writes of the market-run path;
- `convertQuoteToOrder`;
- `requireFactoryWorkflow`, `generateTrackingToken`, `getProductionSetupRequirement` and the `executeQuoteConversion` import.

Also deleted: `lib/quotes/convert-accepted-quote-to-order.ts` (190 lines). Its only importer was `convertAcceptedQuoteToOrder`; its other export, `hydrateEstimateStateFromQuote`, had no importers.

**Kept as stubs:** `convertAcceptedQuoteToOrder`, `startPartyOrderFromEstimator` and `createMarketRunFromEstimator`. The hidden UI still imports them, and no UI success branch reads a result field. Each stub calls `requireRole(['owner'])` and returns the same refusal. Batch 3G removes them together with the hidden UI.

**`getEstimatorSecondaryData`:** the workers slot is now `Promise.resolve({ data: [] })`. It resolved to that before, too.

**Left alone:** the two "Party quotations are unavailable in Market Run only mode." checks inside the live `saveEstimatorQuoteV3`. They reject legacy quotation records and are part of the live save; they are reviewed in 3G.

### Behavior proof

New `__tests__/db/retired-factory-workflows.dbtest.ts` (3 tests). For a Base owner, each stub must:
- resolve to exactly the refusal;
- run the owner check once;
- make no `from()` table access and no RPC (both Supabase clients are wrapped);
- leave the row counts of `estimator_quotes`, `orders`, `market_runs`, `order_yarn_requirements` and `machines` unchanged.

| Run | Result |
| --- | --- |
| Against 3F | 3/3 pass |
| Against the pre-3F `actions.ts` and conversion module (disposable copy) | 3/3 pass: the old code already behaved this way |
| Pre-3F code with the guard returning `''` (mutant) | 3/3 fail, e.g. conversion reads the table and returns "Quote not found.": the test detects a live path |

### Contracts updated

- `batch10-estimator-quote-order-snapshots`:
  - assertions on the deleted party-order and market-run bodies removed;
  - the worker-rate snapshot count is now exactly 2, and each live save's derivation is pinned.
- `saved-quality-costing-library`: `template_id:          params.templateId ?? null` existed only in the deleted market-run insert. The contract now pins the live save's `templateId: params.templateId ?? null` and the payload builder's `template_id: input.templateId`. (A search by function name missed this one; the full suite caught it.)

### Gates

Worktree = `main` @ `57bd9b0c` + 3F.

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default vitest | 227 files / 1,952 passed / 1 skipped |
| `npm run test:db` | 12 files / 63 passed |
| Production build (credential-free copy) | PASS (compiled 86 s; 53/53 static pages) |
| Reachability | 17 unreachable (unchanged set: 3D and 3E) |

**Recovery:** `git revert 1259c566`.
