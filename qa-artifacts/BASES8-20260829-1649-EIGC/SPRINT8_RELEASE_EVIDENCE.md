# Sprint 8 release evidence

- Run ID: `BASES8-20260829-1649-EIGC`
- Captured: 29 August 2026, 17:56 IST
- Scope: Base operational loop — costing, production job, dated machine/worker setup, machine-first daily production, and piece-rate payroll.
- Canonical production URL: `https://textile-accounting.vercel.app`
- Linked Supabase project: `vzhwahudircrpgtitwzd`
- Local repository HEAD and `origin/main`: `879d1c5bc5a221b1dfab7c9eb90008dee2c5d3da`
- Implementation commits: `d7889ce941489c39437dc33e00eb78070b2b9a39` (machine-first loop), `f5a900128a251303be5452b0d88a448efbc1de16` (settled-sheet UI lock), and `879d1c5bc5a221b1dfab7c9eb90008dee2c5d3da` (forward settlement-lock trigger).
- Production deployment: `READY`, deployment `dpl_FmAyWWunHdQGqa19eJNJWfoYPP82`, URL `https://textile-accounting-m702iwhoj-rajpatel86420-9825s-projects.vercel.app`, aliased to `https://textile-accounting.vercel.app`.
- Vercel deployment metadata identifies commit `879d1c5bc5a221b1dfab7c9eb90008dee2c5d3da` on `main`.
- `vercel logs dpl_FmAyWWunHdQGqa19eJNJWfoYPP82 --level error --since 1h --no-follow` returned no error records during verification.

## Current decision

**Conditional Go for the Base Sprint 8 pilot slice; broader pre-pilot guide remains not Go.**

The machine-first Base loop is committed, migrated, deployed, and verified through an authenticated owner QA journey. The remaining broader gate is unchanged: full-audit toolchain advisories, backup/restore, rollback, and unrelated Full Suite scenarios still require separate evidence.

## Automated hardening

| Check | Result | Evidence |
| --- | --- | --- |
| Focused Base/date/localization suite | Pass: 3 files, 16 tests | `npm test -- __tests__/base-production-core.test.ts __tests__/base-plan-localization.test.ts __tests__/date-only-format.test.ts` |
| Base machine-first regression | Pass: 1 file, 8 tests | `npm test -- __tests__/base-production-core.test.ts --reporter=dot` |
| Full Vitest suite | Pass: 169 files, 1,043 tests; 1 skipped | `npm test -- --reporter=dot` |
| TypeScript | Pass | `npx tsc --noEmit` |
| ESLint | Pass: 0 errors, 0 warnings | `npm run lint` |
| Diff check | Pass | `git diff --check` |
| Production build | Pass | `npm run build` — Next.js 16.2.12, 49 static pages, PWA worker generated |
| Lockfile resolution | Dry-run pass | `npm ci --ignore-scripts --dry-run`; one peer-resolution warning from Workbox/Rollup |
| Production-runtime dependency audit | Pass: 0 high, 0 critical | `npm audit --omit=dev --audit-level=high` |
| Full dependency audit | Unresolved toolchain risk: 11 high, 1 moderate | `npm audit --audit-level=high`; current advisories are in development/tooling dependency paths and need formal acceptance or upgrade before a full pilot Go |

The machine-first regression coverage now proves both sides of the key invariant: a worker's payroll uses the sum of machine allocation snapshots, and a later worker-default rate edit does not rewrite historical allocation pay. Job progress counts each allocation once and does not add the worker roll-up again.

## Linked production database

- `supabase_migrations.schema_migrations` ends at `20260830120000 / base_settlement_finalizes_batches`.
- `npx supabase db push --linked --dry-run --yes` returned `Remote database is up to date.` after the migration was applied.
- All ten Base tables are RLS-enabled and have policies: workers, jobs, machines, assignments, job contexts, batches, daily entries, daily allocations, advances, and settlements.
- `base_daily_production_allocations` has one authenticated SELECT policy and no direct INSERT/UPDATE/DELETE table grant.
- Direct RPC execution is limited to the intended authenticated paths: assignment upsert/delete, machine job context, daily batch save, and payroll settlement. Internal allocation validators have no public/anon/authenticated execute grant.
- The allocation and daily-entry integrity triggers are enabled and `DEFERRABLE INITIALLY DEFERRED`.
- Same-organization foreign keys, the allocation uniqueness key `(entry_id, machine_id, job_id)`, positive-meter checks, and allocation-mode checks are present.
- Supabase advisor output contains no Base RLS-without-policy finding. Existing advisor notices include intentional authenticated SECURITY DEFINER RPC warnings and informational Base foreign-key/unused-index observations; these are documented for follow-up and do not replace the tenant/RLS/grant checks above.

## Authenticated production evidence

- The in-app Browser authenticated successfully as the reusable isolated Base QA owner for tenant `Base pilot testing`; no credentials are stored in this artifact.
- The desktop assignment board connected one worker to both run-prefixed machines, with separate active jobs/costings attached to the machine contexts.
- The 390×844 viewport exposed the compact tap-to-assign flow, including both machine choices, without drag or horizontal-scroll dependency. The temporary viewport override was reset afterward.
- The daily machine sheet recorded `100 m` on Rapier A at `₹8.00/m` and `130 m` on Rapier B at `₹8.32/m`. Refresh/reopen retained `230 m` and `₹1,881.60` gross.
- The pre-settlement correction from `120 m` to `130 m` persisted. The reconciled equation is `100 × ₹8.00 + 130 × ₹8.32 = ₹1,881.60`, with one worker entry and two machine allocations totaling `230 m`.
- Job progress refreshed to `100/160 m = 62.5%` and `130/160 m = 81.25%`; no allocation double count was observed.
- Payroll preview showed a `₹1,000` advance, the `₹940.80` 50% recovery cap, and `₹940.80` net pay. The authorized cash settlement completed, the worker displayed `Paid`, `₹940.80` was recovered, and `₹59.20` carried forward.
- The final canonical deployment reload showed `Finalized for 29 Aug 2026 · Day shift. Corrections are locked.` Both machine inputs, the worker status selector, and the save button were disabled; browser console errors/warnings were `[]`.
- Read-only production reconciliation found one saved batch, one machine-breakdown worker entry, two allocations, `230 m` at `₹1,881.60`, one settlement at `₹940.80`, and one `₹1,000` advance with `₹940.80` recovered. The QA settlement predates the forward-only finalization trigger, so its stored batch status remains `saved`; the settlement-derived UI lock and settlement-period server guard still make the batch immutable. No broad historical status backfill was run.

## Open release gates

1. Resolve or formally accept the full-audit development/toolchain advisories: `11 high` and `1 moderate` remain in development/tooling dependency paths.
2. Complete disposable backup/restore and application/database rollback evidence.
3. Run the remaining comprehensive guide scenarios: duplicate/timeout submission, cross-tenant and role-boundary runtime attempts, date-boundary variants, accessibility checks, and Full Suite order/stock/dispatch/commercial journeys.
4. Verify production source-map/Sentry attribution and required environment-variable failure behavior if the broader pilot gate requires them.
