# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

Weavly is a costing and factory-operations PWA for grey-fabric weaving units in India (Surat). Commercial plans are **Free, Lite, and Base** (the older "Full Suite"/Premium tier was retired in `supabase/migrations/20260924085030_retire_full_suite_tier.sql`). UI ships in English, Hindi, and Gujarati.

Many root-level and `docs/` documents (`TECHNICAL_ANALYSIS.md`, `TESTING_GUIDE.md`, `USER_WORKFLOWS.md`, parts of `docs/engineer-handoff/`) describe earlier product scopes. `docs/general/README.md` is the current index. When docs disagree, trust in this order: current route/server-action code and tests → latest migrations → current `docs/` → older planning docs. A route or table existing in the repo does not mean it is active in the current plans.

## Instruction sources

- This file is the Claude entry point. There is no `AGENTS.md`; the shared agent rules live in `.agents/rules/` (currently only `weavly-global-premium-design-principles.md`). Treat them as the shared source and link to them instead of copying them here.
- `design.md` is the token, component, and layout reference.
- `.codex/skills/session-docs-closeout/SKILL.md` is a Codex workflow for reconciling `docs/pilot-remediation/*` after fix batches. Its safety rules (no `supabase db push`, no production data, no invented evidence) apply here too.

## Environments and data safety

Read this before running anything that talks to Supabase or Razorpay. Env files are gitignored; list variable **names** only and never print values.

| File | Loaded by | Supabase project | Razorpay |
| --- | --- | --- | --- |
| `.env.local` | `next dev`, and `next build`/`next start` at lower precedence | QA (`euty…`) | test keys |
| `.env.qa.local` | `npm run qa:provisioning-smoke` only (`--env-file`) | QA (`euty…`) | test keys |
| `.env.production.local` | **`next build` and `next start`** (NODE_ENV=production, overrides `.env.local`) | **production (`vzhw…`)** | test keys |
| `.env.local.estimator-final-backup` | nothing (backup copy) | n/a | n/a |

- `npm run dev` uses the **shared remote QA project**, not a local database. Anything you create while signed in persists there.
- A local `npm run build` or `npm start` is configured against **production**. Don't run them unless the user approves, or unless `.env.production.local` has been moved aside by the user.
- The Supabase CLI is linked to **production**: `supabase/config.toml` `project_id` and `supabase/.temp/project-ref` both point to `vzhw…`. Don't run `supabase db push`, `db pull`, `migration repair`, `functions deploy`, or `db reset --linked`. Migrations are written as files only.
- `.env.local` sets `NEXT_PUBLIC_SITE_URL` to the deployed Vercel URL, so auth emails and redirects triggered from dev point to the deployed site, not localhost.
- `__tests__/finance.test.ts` has a live Supabase test gated by `RUN_LIVE_SUPABASE_TESTS=1`. Leave it unset. With it unset, the live test is skipped (it is the 1 skipped test in the baseline).
- `supabase/purge_data.sql`, `supabase/seed_qa_data.sql`, root `test_db.ts`/`test_whatsapp.ts`/`test.mjs`, and most `scripts/` files act on real projects. Read them first and don't run them without approval.

## Commands

Tooling: **npm** (`package-lock.json`, lockfileVersion 3). No `engines` field and no `.nvmrc`; the baseline was taken on Node v24.11.1 and npm 11.6.2.

```bash
npm run dev                          # next dev: port 3000, QA Supabase (see above)
npm run lint                         # eslint --max-warnings=0 (any warning fails)
npx tsc --noEmit                     # type check
npm test                             # vitest run (whole suite)
npx vitest run __tests__/<file>.test.ts   # single file
npx vitest run -t "<test name>"      # single test by name
npm run build                        # prebuild runs npm test, then reset-build-type-cache + next build --webpack  ⚠ loads production env
npm start                            # next start  ⚠ loads production env
npm run qa:provisioning-smoke        # provisions against QA via .env.qa.local (writes data)
```

- Only use `npm run build` for builds (never bare `next build`). It runs `scripts/reset-build-type-cache.mjs` to delete `.next/cache/.tsbuildinfo`, which works around a Vercel TypeScript stall (see `docs/deployment-typescript-cache-incident.md`). Webpack is required by the PWA plugin.
- Use `npm ci` for lockfile parity; dependency drift has caused misleading local results before.
- Deploys go to Vercel, region `bom1` (`vercel.json`). The only GitHub Actions are the Supabase production backup and restore-drill workflows (`.github/workflows/`, `scripts/backup/`). There is no CI lint/test gate.

### Baseline (2026-09-26, `main` @ `c29dfe15`)

| Check | Status | Result |
| --- | --- | --- |
| `npx tsc --noEmit` | verified | passes (~8s) |
| `npx vitest run` | verified | 228 files, 1988 passed, 1 skipped (~16s) |
| `npm run lint` | verified, **failing** | 3 errors and 81 warnings (58 `no-unused-vars`, 23 `no-explicit-any`) |
| `npm run dev` | found, not run | |
| `npm run build` / `npm start` | found, not run | they load production env |
| `npm run qa:*` | found, not run | they write to QA |

The pre-existing lint errors (all `react-hooks` rules) are:
- `components/estimator/FreeUsageCard.tsx:50`: `preserve-manual-memoization`
- `components/navigation/navigation-disclosure.tsx:30`: `set-state-in-effect`
- `hooks/use-gutter-dock.ts:120`: `set-state-in-effect`

Because of these, lint is red on `main`. When checking a change, compare the lint output for the files you touched against this baseline, and don't expect a clean run.

`npm ls` reports a few extraneous `@emnapi/*`, `@tybys/wasm-util`, and `@img/sharp-wasm32` packages in `node_modules`, which is minor drift from the lockfile.

## Stack

Next.js 16 App Router + React 19, TypeScript strict, Tailwind v4 + shadcn/ui (Radix, `new-york` style, `components.json`), TanStack Query (persisted), zod, Supabase (Auth, Postgres/RLS/RPC, Realtime, Edge Functions), Razorpay billing, Upstash Redis rate limiting, Sentry, `@ducanh2912/next-pwa` with a custom worker in `worker/index.ts`, Dexie for offline queues. Money/costing math uses `decimal.js`. Path alias `@/*` → repo root.

## Architecture

**Request/auth boundary.** `proxy.ts` (Next 16's replacement for middleware) is an *optimistic* layer: route classification, session refresh, JSON 401 for protected APIs, auth rate limiting, role redirects, and archived-route redirects (`lib/phase1-scope.ts` → `/feature-archived`). It is not the authorization boundary. The authoritative checks are in `lib/auth.ts`: `requireRole([...])`, `requireWritableOrg`, `assertOrgWritable` (locked orgs must fail closed). These read the `profiles` row via React `cache()`; the org/role come from the DB profile, never from client input or JWT metadata alone.

**Tenancy.** `org_id` is the tenant key on every business table (`factory_cost_profile` uses `factory_id`). Server actions derive the org from the verified profile; RLS repeats the boundary in Postgres. Supabase clients are split in `lib/supabase/`: `client.ts` (browser), `server.ts` (RSC/actions, cookie session), `admin.ts` (service role, `server-only`, bypasses RLS; use only in actions/route handlers).

**Plan entitlement.** `lib/subscription-access.ts` maps tiers (`none | free | lite | base`) to capabilities (`PLAN_CAPABILITIES`, `hasCapability`); check capabilities, not plan names. Route layouts wrap pages in `components/billing/AccessGate.tsx`, and mutating actions re-check entitlement server-side. Owner navigation per plan lives in `lib/owner-navigation.ts`; prices/checkout in `lib/billing-constants.ts` and `lib/billing-lifecycle.ts`.

**Routes.** `app/free/*` is the Free workspace. `app/(dashboard)/owner/*` holds Lite (estimator, quotes, rates, settings, billing) and Base (adds production, assignments, stock, dispatches, machines, workers, payroll). Each feature folder colocates `page.tsx` (server loader), a `*Client.tsx` (interactive state), and `actions.ts` (`'use server'` mutations). Billing APIs and the Razorpay webhook are under `app/api/`.

**Costing flow.** The estimator computes live totals client-side (`lib/estimator.ts`, `lib/finance.ts`), then the save action recomputes with Decimal on the server, verifies client/server totals match, and persists through a transactional Postgres RPC into `estimator_quotes` (immutable versioned snapshots) and `estimator_templates` (qualities). `record_kind` (`lib/costing-workspace.ts`) is set server-side at creation from live entitlement, never from the client.

**Business logic lives in `lib/`** as mostly pure modules (payroll cycle engine, production core, stock, challans, PDF generation) so it can be unit-tested; UI in `components/<domain>/`. Surat-timezone date helpers are in `lib/time.ts`; use them instead of raw `new Date()` for business dates/shifts.

**Database.** `supabase/migrations/` (~300 files) is the schema source of truth; add new timestamped migrations rather than editing old ones. Security-sensitive RPCs follow the pattern `SECURITY DEFINER` + `SET search_path = ''` + `auth.uid()`-derived org checks + explicit `GRANT`/`REVOKE`. Supabase Edge Functions (Deno) in `supabase/functions/` handle WhatsApp (Meta Cloud API, `_shared/whatsapp.ts`) and scheduled briefs.

**i18n.** `lib/i18n/context.tsx` provides `useTranslation()`; dictionaries in `lib/i18n/locales/{en,hi,gu}.ts` plus feature phrase files in `lib/i18n/`. New user-facing strings need all three languages and layouts that tolerate longer Gujarati/Hindi text.

**Guided tours.** Per-feature tours (`lib/*-tour.ts`, `lib/tours/`, `components/tours/`, `lib/i18n/*-tutorial.ts`) anchor to DOM targets; renaming/moving UI can break them. A tour teaches the REAL page, never a hand-built lookalike: when an account has nothing to show, the tour renders the same page component with sample data (`lib/tours/sample-data/`, `components/*/*SampleWorkspace.tsx`), and the real components open their own dialogs and sheets from `useTourSample()` (`lib/tours/sample-context.tsx`, `tourSurfaceProps` in `lib/tours/sample-surface.ts`). A step's anchor must be a `data-*-tour` attribute on a real component; `__tests__/tour-real-page-guard.test.ts` fails if an anchor disappears or a `*TourPreview` component comes back. A tour never moves or resizes an app modal where the 360px card fits beside it: the modal opens where it always opens and the card adapts (`lib/tours/placement.ts` tries right, then left, even over the sidebar). Squeezing a modal into a reading column is allowed only on viewports too narrow for that, with the rule capped at the width derived in `__tests__/tour-modal-placement-guard.test.ts`, which fails any tour modal rule that applies wider.

## Tests

`__tests__/` (Vitest, node env, globals). Two styles coexist:
- Unit tests importing pure `lib/` modules.
- **Source-contract tests** (over half the suite) that `readFileSync` app/components/migration files and assert on their text (e.g. that a migration contains `SET search_path = ''`, or a page renders a given component). Renaming files, moving code, or rewording strings can break these; search `__tests__/` for the file path or string you are changing and update the contract deliberately. This matters most for UI work: class names, component names, and copy are often asserted.

About a dozen `.tsx` tests render components to static markup with `react-dom/server` `renderToStaticMarkup`. None of them use a DOM, interaction, or browser test. Visual checks require running `npm run dev` against QA.

## UI conventions

Follow `design.md` and `.agents/rules/weavly-global-premium-design-principles.md` ("warm industrial"). Key rules: saffron is reserved for brand/selected accents; primary operational actions use dark ink/navy (`bg-ink text-surface`); one primary surface per workflow, no nested cards; minimal badges and near-invisible shadows (`border-hairline`, `shadow-xs`); radius 8px controls / 12–14px panels; controls 40–44px tall (44px min on mobile); spacing scale 4/8/12/16/24/32/48; explicit row actions instead of row clicks or `...` menus; every data view needs loading/empty/no-results/error states; mobile recomposes rather than shrinking tables.

### Where the shared layout and primitives live

- Tokens and global CSS: `app/globals.css` (Tailwind v4 `@theme`, `--weavly-*` variables, shadow vars, safe-area utilities) and `app/mobile.css`.
- Root layout: `app/layout.tsx`. Segment layouts: `app/(dashboard)/owner/layout.tsx` (owner shell: `BrandBackground` + `OwnerSidebar` + plan provider), `app/free/layout.tsx`, `app/(dashboard)/admin/layout.tsx`, `app/(auth)/onboarding/layout.tsx`, `app/(public)/layout.tsx`, `app/(plan-selection)/layout.tsx`.
- Navigation: `components/navigation/` (`owner-sidebar.tsx`, `mobile-navigation.tsx`, `navigation-link.tsx`, `navigation-disclosure.tsx`, route-loading skeletons, `page-title-layout.ts`); per-plan items come from `lib/owner-navigation.ts`.
- Primitives: `components/ui/`. Route scaffolding (`PageHeader`, `Toolbar`, `SectionHeader`, `StatusBadge`, `EmptyState`) is in `components/ui/page-header.tsx`. `button.tsx` provides the `default` (ink) and `saffron` variants and the sizes `sm` h-9, `default` h-10, and `lg` h-11. The other primitives are `card`, `badge`, `input`, `select`, `sheet`, `dialog`, `table`, `tabs`, and `skeleton`.
- Backgrounds: `components/brand-background.tsx` (variants are chosen per route in the owner layout). Auth shell: `components/auth/auth-layout.tsx`. Landing: `components/landing/`.
- `cn()` is in `lib/utils.ts`.

## Unresolved instruction conflicts

These need a decision from the user. Until then, prefer the stricter `.agents/rules` principle and flag any deviation.

1. **Control height.** The rules require 40–44px controls and a 44px minimum on mobile, but `design.md` and `button.tsx` define `sm`/`icon-sm` at 36px (h-9) and `icon-xs` at 24px.
2. **Shadows.** The rules ask for `shadow-xs` or the softest card shadow, while `design.md` and `card.tsx` use `shadow-[var(--shadow-card)]` and list stronger panel and modal shadows.
3. **Saffron actions.** `design.md` presents the `saffron` button as a normal variant ("orange brand action"). The rules say saffron is only for occasional highlighted actions and that primary actions are ink/navy.
4. **Nested cards.** CLAUDE.md says "no nested cards". `design.md` allows them "when there is a clear repeated item or modal-like sub-surface".
5. **Stale `design.md` Source Files.** It lists `components/navigation/supervisor-nav.tsx`, `app/(dashboard)/supervisor/*`, and `app/(dashboard)/owner/today/FactoryTodayClient.tsx`, none of which exist.
6. **Build guidance and safety.** "Always build via `npm run build`" conflicts with the fact that a local build loads `.env.production.local`. Decide whether local builds are allowed, or whether that file should be moved out of the repo root.
7. **Lint policy vs. reality.** `--max-warnings=0` is the stated gate, but `main` currently fails it (see Baseline). Decide whether to fix the baseline first or allow per-file comparison during the redesign.

## Repo hygiene

`scratch/`, `tmp/`, `.playwright-cli/`, `scripts/sql/` are gitignored scratch areas. `output/`, `outputs/`, `qa-artifacts/`, and `audits/` are tracked QA evidence, not app code. Many `scripts/*.ts|mjs` are one-off diagnostics against real Supabase projects; read before running. Don't commit, push, or deploy unless asked.
