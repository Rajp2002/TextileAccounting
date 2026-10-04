# AD03 / AD04 — factory reporting and safe context

Development implementation on `codex/founder-admin`. No production reads, classification backfill, credentials, grants, MFA/account changes, deployment or business writes were performed.

The canonical TypeScript access resolver receives batched subscription inputs at one explicit snapshot time. It preserves the highest qualifying current entitlement, grace, explicit Free identity and retained Lite after Base expiry. Reporting failures use `unknown` or a 503 source error, not `none`, Free or a guessed zero. Locks and owner revocation stay independent of the access tier.

Current paid-term counts are a verified subset. A term requires known dates and a verified live provider capture fact linked to the source payment ID, factory, amount, provider reference, currency and plan. A locally captured row or current gateway mode cannot establish live provenance. An older capture is retained despite later failed/refunded local labels. Missing complete historical billing provenance remains a coverage warning.

`organizations.id` is the source-supported factory key. A missing `private.admin_org_reporting` row means unclassified. The directory defaults to production; unclassified/test/demo/internal remain explicit searchable groups outside confirmed production totals. `getClassificationDryRun()` produces a review worksheet with no proposed heuristic classifications and zero writes.

Observed activation uses first retained persisted original costing and first saved/finalized positive entered production record. Same-entry Free revisions retain original activation and contribute activity without new quota or activation. Raw subject funnel events are never joined to all factory grants. Free quota is labelled owner-account scope and uses the stored allowance/reset period where present, otherwise the healthy current policy's India calendar-month bounds. Retained records do not prove complete historical activation/retention/activity; review/export/deletion coverage remains incomplete and no lapse score or historic zero-fill is generated.

## Changed files and migration

- `lib/admin/{metrics,factory-pagination,factories}.ts`: pure definitions, bounded filters and stable cursor ordering; guarded/audited loaders and narrow DTOs.
- `app/api/admin/factories/route.ts`, `app/api/admin/factories/[orgId]/route.ts`: independent founder checks via the DAL, no-store responses and common sanitized errors.
- `app/(admin-console)/admin/factories/{page.tsx,[orgId]/page.tsx}`, `components/admin/factory-filters.tsx`: URL filters, explicit row actions, mobile recomposition, source/error/empty states and support-safe detail.
- `20261004151000_founder_factory_reporting.sql`: additive private classification metadata; restricted service-only snapshot/quota RPCs, live founder session checks and selected indexes. Generated with Supabase CLI then ordered after current Free, founder and support migrations. The paid provenance read also requires AD07's projection migration before the console can return data.
- `__tests__/admin-factory-metrics.test.ts`, `__tests__/admin-factories-dal.test.ts`, `__tests__/db/admin-factories.dbtest.ts`: canonical resolver/count/coverage cases, denial/audit/source failure, SQL isolation, authoritative confirmed-contact search, unknown/test billing provenance and synthetic scale. `scripts/test-db/cluster.mjs` adds the standard Auth email confirmation field to the synthetic stub so the read queries can remain narrow.

Directory queries are parameterized, literal substring search with allowlisted sorts and filters. Public responses contain at most 100 rows (default 25). Cursor pagination fixes snapshot/filter/order and uses ID tie-breaks; cursors expire after one day. Server snapshots refuse population over 10,000 factories, more than 1,000 terms for one factory or 50,000 term inputs. Refusal is unavailable rather than truncating a count or dropping an older entitlement. Detail uses fixed 25 payment references, 20 term records and five recent ticket references, without loading costing inputs, payroll, worker identities, stocks, customer ledgers, notes or conversations.

## Verification

Run all commands from the isolated worktree with the repository wrapper, which removes remote service configuration:

```sh
node scripts/performance/isolated-command.mjs npx vitest run __tests__/admin-factory-metrics.test.ts __tests__/admin-factories-dal.test.ts
node scripts/performance/isolated-command.mjs npx vitest run --config vitest.db.config.ts __tests__/db/admin-factories.dbtest.ts
node scripts/performance/isolated-command.mjs npx eslint lib/admin/metrics.ts lib/admin/factory-pagination.ts lib/admin/factories.ts components/admin/factory-filters.tsx 'app/(admin-console)/admin/factories' app/api/admin/factories __tests__/admin-factory-metrics.test.ts __tests__/admin-factories-dal.test.ts __tests__/db/admin-factories.dbtest.ts --max-warnings=0
```

Unit/DAL: 14 tests passed. Targeted lint: passed. Repository typecheck with `--noEmit --incremental false`: passed on the integrated working tree at this slice's completion. The final targeted disposable PostgreSQL suite passed seven tests and replayed migrations, with a 1,000 synthetic organization aggregate p95 of 147 ms across ten reads against a two-second development budget. This measures the local fixture, not production performance. PostgreSQL required a reviewed sandbox escalation solely for loopback shared memory; no remote database was used. Final-commit full lint/unit/database/build/browser results and screenshots belong to the integration owner against the final integrated tree.

## Synthetic browser presentation evidence

The independent fixture harness in `scripts/qa/admin-browser` mounts the actual async page components and their real client controls with Vite-only, loopback read-DAL aliases. Its server uses the actual pure metric, Free calendar window and cursor helpers on captioned synthetic records. Product Auth, founder guards, route protection and feature gates are unchanged; no account is signed in and no real customer data is loaded. This is presentation evidence, not authenticated application acceptance.

```sh
node scripts/performance/isolated-command.mjs npx playwright test --config playwright.factories.config.ts
```

The factory subset passed all six desktop/mobile cases: literal UI filters and GET URL state, keyboard dropdown interaction, stable equal-timestamp cursor pages, production/Free count drilldowns, shared account quota and original-costing semantics, narrow detail references, unknown/unavailable source states, and viewport overflow. The harness binds only `127.0.0.1:4185`; browser requests outside loopback are aborted. Loopback listening/Chromium required a reviewed local sandbox escalation.

Screenshots are saved under `output/playwright/admin-console/read-fixtures` as `factories-{desktop,mobile}-synthetic.png` and `factory-detail-{desktop,mobile}-synthetic.png`. Every screenshot includes the caption “Synthetic component fixtures — no authentication or production-data verification.” Desktop directory and mobile detail were visually inspected. Today/Payments/System/Audit tests share the isolated harness and are recorded separately by their slice owner. The final Auth/MFA/cache/replay gate remains blocked until a supported positive identity environment is available; synthetic components do not close that gate.

## Remaining gates and rollback

No production behavior is verified. Founder identity/MFA/session/recovery setup, production migrations/deployment, business classification evidence, retention/deletion integration, financial provenance population/coverage, legacy operational ownership and integrated browser checks remain release gates. Private reporting tables have no application write grants or classification endpoint. Support and billing services are unchanged by these read models.

Disable the new admin server gate/read routes or remove their navigation to roll back this slice. Retain additive classification/audit/projection records for reviewed correction; do not relax tenant authorization, change access/quotas, reverse payments, drop populated tables or delete customer records.
