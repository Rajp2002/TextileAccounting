# Sprint 7 — Final UX Polish and Pilot Readiness Closeout

Date: 2026-08-02 IST
Scoped result: `production_release_verified`; exact data-mutating pilot: `blocked_by_qa_entitlement`

## Customer scope

Sprint 7 addressed the remaining adoption friction for Rajesh Patel's grey-fabric weaving unit:

- consistent Cost Estimate, Saved Costing, Fabric Quality, Customer Quotation, Customer (Party), Production Cost / m, Break-even Price / m, Suggested Selling Price / m, Current Yarn Rate, and Yarn Rate Book wording;
- truthful display of unavailable historical money values without recalculating or mutating old costings;
- shared success, error, warning, loading, and update notifications with actionable feedback;
- consequence-based confirmation dialogs for archive, discard, reset, and replace actions;
- visible explanations for blocked estimator actions;
- English, Hindi, and Gujarati language-switch loading/success/failure/fallback feedback;
- mobile layout corrections across the Base owner surfaces.

No costing formula, rounding rule, immutable snapshot contract, tenant boundary, billing lifecycle, or Premium workflow was changed.

## Release identity

- Working branch: `codex/sprint7-final-ux-polish`
- Implementation commit: `9055cda` (`feat: finish sprint 7 base ux polish`)
- Pull request: [#58](https://github.com/Rajp2002/TextileAccounting/pull/58)
- Merge commit on `main`: `93d8bea6554386412affcb66935d3e569ce9de7c`
- Production deployment: `dpl_8nTPXqmMrDXFaDKfdyKSwx6bff1S`
- Production status: `READY`
- Canonical URL: `https://textile-accounting.vercel.app`

The implementation commit is an ancestor of `origin/main`. The current checkout has no staged or tracked changes; the pre-existing untracked `test-artifacts/` directory was not modified or staged.

## Source and automated proof

The implementation touched 28 application/test files, including the estimator, Saved Costings, Rate Book, settings/factory profile, billing/data export feedback, shared confirmations/notifications, i18n resources, and Sprint 7 regression tests.

The following gates passed on the released candidate:

- `npm test -- --run`: 130 files / 849 passed / 1 skipped
- `npx tsc --noEmit`: passed
- `npm run lint`: passed
- `npm run build`: passed
- `git diff --check`: passed

The hosted Vercel build also passed compilation, TypeScript, static generation, and its test/build checks. The only hosted warnings were the existing absent Sentry auth token and stale Browserslist data; neither blocked deployment.

## Database and migration proof

- `npx supabase migration list --linked --output-format json` shows matching local and remote histories through `20260801174038_sprint1_save_trust_v2`.
- Relevant Sprint 1–6 migrations are already present on both sides, including the Sprint 3 factory-profile key, Sprint 4 billing boundary, Sprint 5 rate/audit history, Sprint 6 integrity, and Sprint 1 save-trust migrations.
- `npx supabase db push --linked --dry-run --yes` returned `Remote database is up to date.`
- Sprint 7 has no migration. No migration was applied and no production schema or business data was mutated for this release.

## Production runtime proof

Authenticated production checks verified:

- `/owner/estimator`, `/owner/quotes`, `/owner/rates`, `/owner/settings`, `/owner/billing`, and `/owner/data-export` fit a 390×844 viewport without horizontal overflow;
- legacy zero/invalid persisted costing metrics display `Not available` instead of a misleading ₹0.00/m and do not rewrite historical snapshots;
- Saved Costing and customer quotation terminology is visible on the Saved Costings surfaces;
- switching to Gujarati displays a localized success notification and the selected language remains active;
- the language fallback/retry contract is covered by the Sprint 7 tests; an intentionally failed live translation-resource request was not induced;
- the observed production Saved Costings route had no browser console errors or warnings.

The runtime check did not claim complete translation of every legacy phrase. Some older Gujarati/Hindi Base copy still contains mixed English textile/product terms; this remains a translation-coverage follow-up rather than a language-switch failure.

## Exact pilot journey and data safety

An isolated QA tenant named with the Sprint 7 Patel Weaves prefix was created for the realistic pilot. Production mode `both` was saved. The attempt to add 50 Water Jet looms was rejected by the live entitlement boundary because the disposable account had no Full Suite subscription. Vercel logs recorded the expected `Weavly Full Suite subscription required for production records` database boundary error.

Tenant-scoped reconciliation after the rejected write showed:

- production_mode: `both`
- machines: `0`
- workers: `0`
- payroll_configs: `0`
- estimator_quotes: `0`
- onboarding_complete: `false`

No partial loom, worker, payroll, costing, or quotation row was created. No payment was made and no entitlement or database state was bypassed. The exact 50-loom, Mahavir Traders, 30,000m, yarn-rate, overhead, transport, commission, margin, and 5,000m quotation journey therefore remains blocked until an entitled disposable QA workspace is available.

## Formal readiness disposition

Sprint 7 is a scoped production release closeout. It does not change the formal pilot matrix, `DOMAIN_INVARIANTS.md`, `PILOT_READY_DEFINITION.md`, or the overall No-Go decision. The canonical formal totals remain 368 pass, 0 fail, 6 blocked, and 3 not applicable; the existing `TECH-011` and `GOLDEN-A-03` gates remain unchanged.

Next safe action: use an existing entitled disposable QA workspace, rerun the exact customer journey, inspect customer-output privacy, and reconcile the tenant to zero. Do not purchase a production plan or use a live customer tenant merely to satisfy this evidence gap.

## Reproduction commands

- `git status --short --branch`
- `git rev-parse origin/main`
- `npm test -- --run`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`
- `npx supabase migration list --linked --output-format json`
- `npx supabase db push --linked --dry-run --yes`
- `npx vercel inspect textile-accounting.vercel.app --json`
