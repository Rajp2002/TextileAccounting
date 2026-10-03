# Free measurement inventory (FR06)

What the existing Free measurement records, what each count means and what it cannot show. This sprint enabled **no new collection, cohort admission or retention**. Any addition needs the D06 decision first: purpose, payload, access, dedupe, retention and deletion.

Source as of the FR06 commit. Verified by `__tests__/db/free-measurement-reconciliation.dbtest.ts` (real PostgreSQL, synthetic records) and the browser emitters' unit tests. Nothing here was read from a live project.

## Where events are stored

`public.free_funnel_events` (`20260908190537_free_tier_runtime.sql`). Primary key `(subject_id, event_name, event_id)`, so a repeated `event_id` for the same event and subject is a no-op. Columns: subject, event id, name, version (always 1), time, language, entry point. There are no business inputs, money, names or free text. Service role only (RLS on, `PUBLIC`/`anon`/`authenticated` revoked).

## Producers

| Event | Producer | When | Dedupe key | What it shows | What it does not show |
| --- | --- | --- | --- | --- | --- |
| `signup_completed` | SQL `provision_free_account` | Free grant created | org id | A Free grant was provisioned | Signup intent or a completed form |
| `calculation_completed` | SQL trigger on `free_calculation_receipts` insert, inside the debit transaction | Successful new Free costing | request id | One receipt-backed saved costing (equals receipts and snapshots, proven) | Usefulness. A replay inserts no receipt, so it is never a second activation (proven) |
| `paid_activation` | SQL trigger on `subscription_payments`: `captured`, payment id matches the org's `active` subscription | First verified captured payment | subject id | First paid activation per subject | Renewals and Lite to Base changes (same key, proven: a renewal adds nothing). Effective entitlement such as retained Lite |
| `result_viewed` | Browser: `useFreeMeter` after a confirmed save. The endpoint requires a receipt owned by the subject | Saved result returned to the page | request id | The page received a saved result | That the owner read, understood or used it |
| `quota_reached` | Browser: after a save whose receipt shows 0 remaining. The endpoint re-checks current status is 0 | A save left the current month at zero | request id | The allowance reached zero after a success | Any later need that was blocked |
| `upgrade_started` | Browser: `UpgradeBenefitsPreview` subscribe click | Checkout opened from the Free comparison | per tier per mount | A checkout was opened | Payment, intent to pay, or the entry surface (see below) |
| `tour_completed`, `tour_skipped` | **No active emitter.** The only one was the unmounted `FreeMeterPanel`, removed in FR01 | — | — | — | — |
| `locked_feature_requested` | **No emitter** | — | — | — | — |

The endpoint `app/api/free/events/route.ts` accepts only the six browser names above, validates them with zod (strict), rate-limits per subject and stores them with `ignoreDuplicates`.

## Known meaning problems (not changed; need D06)

- `upgrade_started` is sent with `entryPoint: 'billing'` even from the estimator's in-place comparison, which FR03 made the main path. Estimator-origin upgrades are counted as billing-origin.
- No event records a **blocked attempt** at zero (`FREE_QUOTA_EXHAUSTED` writes nothing, proven), a warning **review**, an explicit **acknowledgement**, an **unknown outcome** or its resolution, an upgrade **dismissal**, or **verified entitlement** after in-place activation. An empty funnel stage therefore does not mean no demand.
- `quota_reached` comes only from the browser. A server-only sequence shows zero quota hits (proven).

## Reporting: `public.free_cohort_metrics`

Includes only subjects with `analytics_eligible = true` created in the last 90 days. `analytics_eligible` defaults to false, and nothing in the app sets it. **It controls cohort-view inclusion, not collection, and it is not consent**: events are stored for every Free subject either way (proven).

| Column | Definition | Caution |
| --- | --- | --- |
| `eligible_signups` | Eligible subjects by IST signup date | Denominator is admission, not all signups |
| `activated_accounts` | At least one `calculation_completed` | A saved costing, not a useful one |
| `mature_30_day_accounts` | Created at least 30 days ago | Use as the denominator for day-30 rates |
| `converted_by_day_30` | `paid_activation` within 30 days | First paid only |
| `returned_on_another_day` | Completions on two or more IST dates | Not a return visit without a calculation |
| `quota_hit_accounts` | Any `quota_reached` | Browser-dependent |
| `quota_hit_then_paid_accounts` | Paid at or after the first quota hit | Order, not cause |

## Privacy boundaries (preserved)

- Free routes send no Sentry events, transactions, logs, breadcrumbs or replays (`instrumentation-client.ts`), and the estimator root carries `data-sentry-block` in Free mode.
- Generic plan analytics (`trackPlanEvent`) return early on `/free` and `/free/*`, including the paid estimator Free becomes in place after FR03.
- Free API responses are `private, no-store`.

## Retention

`prune_free_operational_metadata()` deletes events older than 90 days, expired receipts and old usage rows. Its `weavly-free-retention` job was created inactive. Its live state was not read in this sprint. Saved snapshots are never pruned by it.

## Approval-dependent additions (not built)

Each needs an owner, purpose, payload, dedupe, access, retention and deletion decision before it is enabled. Payloads would be the categories already used (name, language, entry point), plus at most the policy version and verified effective tier:

- Review shown, and acknowledged
- Unknown outcome, and how it was resolved (saved, released)
- Quota-rejected attempt
- Upgrade comparison opened from the estimator, and dismissed
- Verified paid entitlement after in-place activation, with retained Lite kept separate from subscription tier

Correct `upgrade_started`'s entry point to an estimator value at the same time, through the allowlist and the table's check constraint.
