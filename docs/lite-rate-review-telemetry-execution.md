# Lite rate review and telemetry — increment 2

Date: 31 August 2026
Branch: `codex/lite-trust-journey-refinement`
Status: Implemented locally. Not deployed, not an S-tier sign-off.

## User-facing changes

- Rate review shows the saved rate beside each proposed warp/weft rate, then
  compares production cost and suggested selling price per metre with signed
  differences. Both sides use the existing calculation engine and the same
  applied-recipe assumptions. No alternate costing formula was introduced.
- The summary distinguishes saved costing assumptions from working assumptions.
  It does not describe recipe rates as live market prices or use the recipe's
  update timestamp as evidence of a supplier review.
- Incomplete recipes show a completion instruction instead of unreliable money.
  Tape length and production capacity are not mandatory for this per-metre Lite
  comparison. Existing validation still checks the relevant costing inputs.
- Historical costing versions remain unchanged by recipe-rate updates.
- Removed the duplicate read-only quality-name field and archive action from
  this dialog. Name remains in its heading; archive remains in the quality
  library menu. Required construction inputs have not been removed.
- Inputs have accessible names and decimal keyboards. Pending rate saves lock
  the dialog against edits, dismissal and duplicate submission. Errors release
  the lock; an uncertain outcome asks the owner to reopen and verify saved rates.
- New copy is included in Hindi and Gujarati; native-speaker review is pending.

## Measurement repairs

- Read-only production inspection confirmed the `plan_usage_events` constraint
  still accepts only legacy events. New journey events could not be stored.
  The migration expands the constraint without removing existing event names.
- Blank journeys start on actual field entry or explicit New Quality, not mount
  or library search. Applying a recipe starts a saved-quality journey. Restored
  draft and saved-costing contexts are distinct. Each journey can independently
  record its first valid result.
- Confirmed saves recovered through receipt lookup/retry also report success.
  Repeated confirmations in one mount are deduplicated by request identity;
  no-change saves do not claim a new costing version. Request identities are
  not included in analytics payloads.
- New journey events accept categorical, allowlisted properties at client and
  server boundaries. Legacy event validation remains compatible; this is not a
  claim that every legacy analytics property has been privacy-audited.
- Replaced custom CLS accumulation and maximum-event-duration “INP” with the
  pinned official `web-vitals` library, loaded after hydration. CLS precision
  is preserved. See the [official lifecycle guidance](https://github.com/GoogleChrome/web-vitals).
- Added authenticated owner-only ingestion, strict payload validation,
  server-derived factory/plan, existing Redis-backed rate limiting, and storage
  upsert keyed by factory + anonymous metric instance + metric name. No actor,
  business content, query strings, raw browser entries or client-supplied plan
  are stored in the Web Vitals table. Generic rate limiting retains the existing
  fail-open behavior when Redis is unavailable.
- Collection is explicitly **document lifetime for direct estimator-entry
  documents**, including later SPA navigation. It is NOT estimator-only INP or
  soft-navigation LCP. Buffered metrics from documents starting elsewhere are
  excluded. Language/device describe initialization, not every later change.
- Delivery is best effort, not a durable analytics queue. HTTP rejection returns
  false instead of being treated as success. Concurrent lifecycle reports can
  arrive out of order; ingestion upserts by arrival, not a client clock. Use this
  for cohort diagnostics, not an exact task-completion ledger.

## Database release boundary

`supabase/migrations/20260901110001_lite_telemetry_contract.sql` was created with
the Supabase CLI and rebased immediately after the repository's pre-existing
future-dated `20260901110000` migration. It adds an RLS-enabled service-role-only
Web Vitals table and updates the event constraint. It changes no business data,
calculation schema, user role or plan entitlement.

The local Docker database runtime is unavailable. SQL execution, advisors and
actual PostgREST ingestion are therefore **not verified**. Do not interpret mock
route tests or migration-string checks as database integration tests.

Before deployment:

1. Apply/test the migration against a disposable or staging database after its
   prerequisite migrations. Verify fresh install and upgrade paths, RLS/grants,
   duplicate metric upserts, and every journey event. Check Data API exposure
   for the service-role path without granting anonymous/authenticated writes.
2. Deploy the migration before the application. Verify authenticated 202 replies
   and persisted rows for the exact deployed commit. Monitor 400/429/503 rates.
3. Agree a retention/pruning policy before accumulating production samples.
4. Verify browser behavior on phone/desktop, long/multi-row qualities, three
   languages, keyboard and screen reader, pending save, failed save and close.
5. Run real-owner repeat-quality tasks and review comprehension and friction.
   The tests here are not owner sessions or visual/accessibility certification.

## Verification and rollback

Added executable tests for rate-engine parity, immutable inputs, no change,
decreases, multiple yarns, incomplete/invalid recipes, journey sequencing,
privacy boundaries, observer lifecycle, HTTP failure, authentication, tenant
derivation, rate limits, metric precision, and migration/event-name parity.

The isolated application commit `a1b21be` passes **1,141 tests, with 1 skipped and
0 failures**. Targeted ESLint reports **0 errors and 0 warnings**; TypeScript
and the optimized `next build --webpack` **pass**. The build required network
access for existing Google Fonts and still reports an outdated Browserslist-data
warning. Verification used a clean detached checkout because concurrent Base
payroll changes were present in the shared workspace; those changes were not
included in this increment.

Package installation reported 12 dependency-tree audit findings (1 moderate,
11 high). They were not triaged or automatically fixed in this UX increment;
these results are not a security sign-off.

Keep the increment as a separate commit atop the first trust-recovery increment.
Reverting the application commit restores the prior UI. The additive telemetry
schema can remain safely in place; do not narrow the event constraint while
new-event rows exist. No push, merge or production migration is part of this
local increment.
