# AD00 — reporting provenance and isolated verification worksheet

Source snapshot: `36e6e4edac8de76052dc8247d99a74b90ef3772d`, 4 October 2026. Reporting zone: `Asia/Kolkata`; instants UTC, report bounds explicit `[from,to)`. Production facts, applied remote migration inventory, configuration and account identity have not been inspected. No real customer fixtures are authorized.

## Source worksheet

| Source | Trustworthy scope / source evidence | Missing evidence / required presentation |
| --- | --- | --- |
| `organizations`, verified `profiles` | Source tenant IDs, factory name, join time, lock/revocation. Signup writes one factory name to one organization (`app/(auth)/actions/auth.ts`) | Missing reporting row is `unclassified`; production counts require explicit evidence, never email-domain guesses. Unknown population/query error makes count unavailable |
| `org_subscriptions` + `free_account_grants/free_account_subjects` | Batch source inputs to shared pure entitlement resolver. `lib/subscription.ts`, `lib/subscription-access.ts`, `lib/free-account.ts` | Effective access does not prove current paid sale. Resolve all rows; resolver/source failure is reporting `unknown`, not no access/Free. Grants have active/pending/suspended states that must remain visible |
| `free_monthly_usage`, `free_quota_policies`, `free_support_status` | Service-only support view, subject/account quota. Monthly policy 2, IST start/end; October local-month-end fix | Shared subject quota cannot be counted as per-factory credit/activity. Missing period is not proof of activity zero; compatibility or source failure needs coverage state |
| `free_saved_costings`, calculation/recalculation receipts | Persisted original costing with subject + org attribution; original creation/revision; 30-minute recalculation lock/receipt path | Minimized DTOs only: no estimate/result/totals copied to console. Retry/recalculation is not another original costing. Raw retention/pruning schedule unverified |
| `free_funnel_events`, `free_cohort_metrics` | Service-only subject events and existing cohort view; `20260908190537_free_tier_runtime.sql` | View is not authoritative historical factory retention. Events have no org attribution and pruning deletes older than 90 days; no fan-out to grants, no full-history zero-fill, mature cohorts deferred |
| `plan_usage_events`, `/api/analytics/plan-events`, `lib/plan-analytics.ts` | Existing paid-plan browser telemetry, allowlisted names and properties | Browser reports are not complete server-confirmed business outcomes. Show observed coverage; source history start/retention schedule unverified |
| `base_daily_production_entries` / batches and saved quality/costing records | Current authoritative persisted operational outcomes and timestamps; reviewed RPC validates worker/machine/job membership | Keep worker identities, wages, production quantities, costing inputs and stock valuations out of DTOs. Historic direct records do not prove complete event collection; distinguish older legacy production path |
| `web_vital_samples` | Service-only estimator document-lifetime LCP/INP/CLS, not SPA route metrics (`20260901110001_lite_telemetry_contract.sql`) | Not request p95 or workflow success rate. No sample is unknown/not connected, not green health |
| `subscription_payments` | Per-payment unique provider reference, integer amount, local capture status/time fields. Foundation `20260416200000_subscription_schema.sql` | No complete historical provider-account or live/test provenance. A current `refunded` status alone does not prove original capture/time. Legacy rows remain unknown/unverified |
| `billing_checkout_attempts` | Separate order/intent state, recorded price/tax breakdown, currency and provider references (`20260801162646_...`) | Intent is not capture. Paid/access mismatch must join safe references, not call status reconciliation. Current gateway mode cannot classify historic rows |
| `billing_payment_refunds` | Duplicate-refund attempt bookkeeping, one row per payment, provider creation ID, pending/issued/failed | `issued` means create call returned ID (`lib/billing-reconciliation.ts`), not verified processed refund/time. Not complete partial/out-of-band refund feed; unknown coverage forbids trusted zero/full-period net |
| `billing_invoices`, receipt download | Issued document references and stored amount/tax for evidenced subset | Document issuance is not capture/receivable/bank settlement. Current policy is payment receipt only; historical taxes are not recomputed with today's prices |
| `razorpay_webhook_events` | Existing processing status/age and errors, HMAC validation, claim/apply idempotency RPCs | Read safe diagnostic code/ref only. Raw provider payload/error can contain customer data. Unapplied/failed events are exceptions, no repair button |
| Referral credits/history | Existing access extensions/conversion contracts | Additional access is not another payment receipt; record provenance distinctly |
| `security_incidents`, `breach_reports`, export runs | Existing incident/report/export status records | Need bounded safe fields; actual live workflow owner/records unknown. Jobs/backup/restore/settlements/bank feeds not evidenced; display not connected/unavailable |

Confirmed collections require verified live provider facts, provider account and verified occurrence time, deduplicated by provider account/object/mode/kind. Partial refunds need distinct provider refund IDs. Independent coverage must span the entire claimed account/currency/time interval. Known verified rows with partial/unknown feed coverage are a **known subtotal**, not a complete period total. Net, tax-exclusive total, bank settled cash, receivables, recognized revenue, MRR and ARR must remain unavailable where their source evidence is absent. The new projection is reporting metadata only; it cannot change payment or entitlement authority.

Never invoke `reconcileBillingOrder`, `activateInitialPurchase`, duplicate refunds, or `/api/billing/status` from founder reporting reads. Existing economic operations remain at their authorized checkout/webhook boundaries. Provider historical reads/backfills require explicit authorization and reviewed bounds.

## Caches and telemetry inspected

- `next.config.ts` already uses NetworkOnly/no-store for documents, RSC, APIs and same-origin GET fallthrough; only static assets are CacheFirst. Existing no-store HTTP header routes include owner/Free/auth but must explicitly cover admin/support. Static-extension matching should not capture future protected attachments.
- `components/providers.tsx` does not install persisted QueryProvider globally. The owner layout does; `components/query-provider.tsx` persists a server-verified scoped cache to localStorage. New founder/support shells must remain memory-only or exclude sensitive queries completely.
- `lib/db.ts` keeps Dexie only to clean retired offline mutation queues; offline write replay is retired. `lib/client-storage-cleanup.ts` clears scoped query/session/legacy data. New support drafts must remain component memory only, including logout/account switch/back restoration.
- `instrumentation-client.ts` suppresses Free telemetry/replay, but currently starts masked error replay on other routes; admin/support are not excluded. Extend path/SPA transition redaction before exposing sensitive screens. Existing masked text is not proof of comprehensive sensitive-route safety.
- Root telemetry and Sentry redaction still wrap all route groups; route grouping alone does not remove them. Backend errors and URL/request metadata need sanitized allowlisted reporting, never ticket bodies/provider dumps.

## Synthetic verification plan and environment evidence

The integration owner confirmed: isolated branch/worktree; Node `v24.11.1`; `npm ci --ignore-scripts` succeeded; no hosted database access; no memory summary found in local `.codex/memories`; `.agents` contains the warm-industrial design rule. `scripts/test-db/cluster.mjs` provisions disposable loopback PostgreSQL without loading environment files. Local PostgreSQL is 17.11; CI specifies PostgreSQL 16, so local passing results must disclose the version difference. Applied history is to be validated against the disposable source-migration harness, not presumed to equal production.

Use only synthetic IDs/contacts/provider refs; fixture contacts use reserved `.invalid` domains. No founder grant seed outside isolated tests, no new credentials, no reset/seed against production. Required fixture cohorts:

| Fixture group | Cases that must reconcile independently |
| --- | --- |
| Identity/session | Anonymous; owner A; same-org peer; owner B; supervisor; generic admin; founder AAL1/AAL2; null org; revoked user; malformed/wrong-project token; stale routing hints; revoked grant/provider/server session; interactive expiry vs polling |
| Entitlements | Failed newest checkout plus valid older row; overlapping duplicate subscriptions; current grace boundaries; Base-expired retained Lite; explicit Free; missing grant/subscription; suspended/pending grant; unknown source; lock/revocation |
| Reporting population | Production/test/demo/internal/unclassified; missing classifications; duplicate owner grants across two orgs; aggregate population failure; partial entitlement failure; matching count-card filters |
| Free outcomes | IST month rollover (including October end fix), retry same request, changed-content conflict, same-entry recalculation/revision, original identity/time preserved, >30-minute denial, retained history/review/export distinct, missing telemetry |
| Support | Requester/peer/cross-tenant RLS; locked/expired/Free intake; public/private DTO separation; unbound manual ticket internal only; DB idempotency races; version conflict; resolution/customer reply race; reopening; promise history; audit rollback; no body logging |
| Finance | Captures 299900 + 999900 paise and processed refund 100000 => gross 1299800/refunds 100000/net 1199800 paise; duplicates/test excluded; pending/failed/issued refund excluded; multiple partial refund IDs; prior-period full refund retained; negative net; unknown mode/time/tax; partial coverage => net unavailable |
| Scale/browser | 1000 synthetic orgs, 5000 tickets; stable cursor ties; bounded indexed queries; mobile/keyboard; offline refresh/log out/back/account switch/storage/replay/CSRF; same-origin session sign-out behavior |

Repository verification commands (source `.github/workflows/ci.yml` and `package.json`):

```sh
node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/performance/isolated-command.mjs npx vitest run
node scripts/performance/isolated-command.mjs npm run lint
node scripts/performance/isolated-command.mjs npm run test:db
node scripts/performance/isolated-command.mjs npm run build
```

Build runs prebuild unit tests and Next webpack. Existing QA browser scripts are individual workflows rather than a general installed browser harness; AD10 must record a deliberate executable admin harness command and actual outcomes. No runtime or production tests have passed merely because this worksheet exists. Recommended staging budgets remain proposed: indexed lists p95 <1s, aggregates p95 <2s at fixture size; record measured distribution/query plans before acceptance.

## Release evidence still required

1. Exact verified founder Auth UUID, dedicated identity choice, MFA enrollment/recovery, session policy approval and production grant authorization.
2. Reviewed additive production migrations/security grants/deployment; recovery point and rollback rehearsal.
3. Confirmed current legacy formal/security owner/fallback and operational necessity before any later retirement.
4. Approved retention/deletion/pseudonymization integration for support, notes, audit and reporting; no invented automatic purge.
5. Evidence for production classification and real organization-to-factory mapping; unclassified remains outside confirmed production totals.
6. Provider-account/mode/time/capture/processed-refund and full interval coverage; historical reconciliation/backfill approval if requested.
7. Final integrated unit/type/lint/build, direct database boundary, scale and browser/cache/replay evidence against exact commit; independent review with no unresolved P0/P1.

Rollback for documentation/source inventory is revision/removal only. No production state was mutated during AD00. Dark feature gates must protect endpoints/actions as well as navigation; rollback must never restore a role-only privileged path or discard tickets/audit evidence.
