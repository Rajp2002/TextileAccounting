# Sprint 8 release evidence

- Run ID: `BASES8-20260829-1649-EIGC`
- Captured: 29 August 2026, 17:12 IST
- Scope: Base operational loop — costing, production job, dated machine/worker setup, machine-first daily production, and piece-rate payroll.
- Canonical production URL: `https://textile-accounting.vercel.app`
- Linked Supabase project: `vzhwahudircrpgtitwzd`
- Local repository HEAD and `origin/main`: `86a75c7c312c54ac744d8d4cb7f80d6cedbc6414`
- Deployment status: pending. The Base implementation and migration files remain uncommitted in the local worktree, so the production deployment is not evidence for this run.

## Current decision

**Conditional Go for local implementation verification; production pilot gate remains blocked.**

The local implementation is ready for release review. The authenticated production golden journey, responsive assignment proof, live persistence/reconciliation, and release attribution must be rerun after the intended commit is deployed. No production runtime result below is used as proof of the local changes.

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

- `supabase_migrations.schema_migrations` ends at `20260830110000 / base_machine_first_production`.
- `npx supabase db push --linked --dry-run --yes` returned `Remote database is up to date.`
- All ten Base tables are RLS-enabled and have policies: workers, jobs, machines, assignments, job contexts, batches, daily entries, daily allocations, advances, and settlements.
- `base_daily_production_allocations` has one authenticated SELECT policy and no direct INSERT/UPDATE/DELETE table grant.
- Direct RPC execution is limited to the intended authenticated paths: assignment upsert/delete, machine job context, daily batch save, and payroll settlement. Internal allocation validators have no public/anon/authenticated execute grant.
- The allocation and daily-entry integrity triggers are enabled and `DEFERRABLE INITIALLY DEFERRED`.
- Same-organization foreign keys, the allocation uniqueness key `(entry_id, machine_id, job_id)`, positive-meter checks, and allocation-mode checks are present.
- Supabase advisor output contains no Base RLS-without-policy finding. Existing advisor notices include intentional authenticated SECURITY DEFINER RPC warnings and informational Base foreign-key/unused-index observations; these are documented for follow-up and do not replace the tenant/RLS/grant checks above.

## Browser evidence

- The in-app Browser connected successfully.
- Logged-out production smoke checks for `/owner/production`, `/owner/inventory`, `/owner/ledger`, `/owner/settings/audit`, and `/owner/system-health` all returned the login screen. A synthetic `/track/BASES8-smoke` request did not expose page content.
- The local build was started at `http://127.0.0.1:3000` using `.env.local`, but no QA password was entered and no authenticated mutation was performed.
- The authenticated production walkthrough is not recorded as pass because the current worktree is dirty and the deployment cannot be aligned to this exact implementation until release authorization is provided.

## Open release gates

1. Authorize and complete the normal release path: commit the intended changes, push, merge to `main`, deploy, and verify the deployed commit and migration head.
2. Run the authenticated Base journey with an isolated QA owner: costing → production job → machine/worker assignment → daily machine sheet → payroll preview/settlement.
3. Capture refresh/reopen persistence, duplicate-submit/idempotency, date-boundary, correction-lock, desktop connector, and 320–480px tap-assignment evidence.
4. Reconcile machine metres, worker roll-up, allocation rates, job progress, and persisted payroll rows from the isolated QA tenant.
5. Resolve or formally accept the full-audit development/toolchain advisories and complete backup/restore and rollback evidence before declaring the broader pre-pilot guide Go.
