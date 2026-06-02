# Weavly Security Hardening Report

Date: 2026-06-02

## Critical Findings

| Finding | Severity | Status |
| --- | --- | --- |
| Production DB has broad `anon` table grants, including worker, payroll, financial, audit, dispatch, and WhatsApp tables. | Critical | Fixed in migration by revoking all `anon` table/sequence privileges in `public`. Must deploy migration to production. |
| Public tracking payload exposed internal dispatch UUIDs. | High | Fixed. `/track/[token]` now returns dispatch numbers only and confirmations resolve UUID server-side in SQL. |
| Razorpay webhook handler lacked full raw-body HMAC/idempotency hardening. | High | Fixed. Handler verifies `x-razorpay-signature` with `crypto.timingSafeEqual`, stores event IDs, and uses generic client errors. |
| Shared auth helper trusted JWT/user metadata for role/org fast path. | High | Fixed. `requireRole()` and `getAuthenticatedUser()` now validate role and `org_id` from server-side profile rows after `getUser()`. |
| DPDP worker erasure path did not fully audit/anonymize consent artifacts. | High | Fixed. Owner-only action validates org ownership, nulls consent worker links, anonymizes worker PII, and writes `dpdp.erasure` audit events. |

## Fixed Findings

- Replaced vulnerable `next-pwa` dependency with `@ducanh2912/next-pwa`; upgraded Next/React and forced patched Workbox/terser/serialize-javascript/brace-expansion versions.
- Added server-only guards to `lib/auth.ts` and `lib/supabase/admin.ts`.
- Replaced server-side `getSession()` usage with `getUser()`.
- Added token format validation and IP+token rate limiting for `/track/[token]` page loads and receipt confirmations.
- Added public POST rate limiting to Razorpay webhook processing.
- Added security migration `20260601233631_production_security_hardening.sql`:
  - creates `razorpay_webhook_events`
  - enables RLS across all current `public` base tables
  - revokes `anon` grants on public tables/sequences
  - revokes client writes to subscription ledgers
  - hardens tracking token generation and tracking RPC permissions
  - removes internal dispatch IDs from tracking RPC output
  - adds `dpdp.erasure` audit action support
- Removed PII/token/payment-sensitive logs from Razorpay, referral, WhatsApp, access-code, and tracking paths.
- Scoped realtime subscriptions with explicit `org_id` filters where table-wide channels existed.
- Removed unauthenticated DB read from `/privacy`.
- Normalized public API errors for billing/referral/webhook routes and sent raw operational errors to Sentry.

## RLS Coverage

The new migration executes `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY` for every current public base table. It does not add permissive blanket policies.

| Area | Tables | RLS/Grant State After Migration |
| --- | --- | --- |
| Identity/tenant | `organizations`, `profiles` | RLS enabled; existing policies are org/JWT scoped; anon grants revoked. |
| Factory ops | `workers`, `fixed_workers`, `machines`, `machine_assignments`, `production_logs`, `attendance`, `shift_assignments` | RLS enabled; existing policies check `org_id`; anon grants revoked. |
| Orders/dispatch | `orders`, `dispatches`, `dispatch_package_lines`, `stock_discrepancies` | RLS enabled; public tracking moved to service-role RPC only; anon grants revoked. |
| Payroll/float/advances | `payroll_*`, `worker_advances`, `supervisor_float_transactions` | RLS enabled; owner policies retained; anon grants revoked. |
| Inventory/stock/commercials | `yarn_*`, `beam_*`, `fabric_*`, `market_*`, `commercial_*`, `party_*`, `supplier_*` | RLS enabled; org-scoped policies retained; anon grants revoked. |
| Compliance/privacy | `audit_log`, `worker_consent_artifacts`, `language_requests`, `grievances`, `dpas`, `organization_dpas`, `breach_reports` | RLS enabled; `dpdp.erasure` audit allowed; anon grants revoked. |
| Billing/referrals | `org_subscriptions`, `subscription_payments`, `referral_*` | RLS enabled; client writes revoked for subscription ledgers; anon grants revoked. |
| Webhook/internal | `razorpay_webhook_events`, `whatsapp_settings`, `whatsapp_*`, `daily_brief_logs` | RLS enabled; webhook/settings are service-role only; anon grants revoked. |

## Validation

- `npm run lint`: pass.
- `npm run build`: pass.
- `npx vitest run`: 26 files passed, 242 tests passed, 1 skipped.
- `npm audit --audit-level=high`: pass, 0 high/critical.
- `npm audit --audit-level=moderate`: fails only on Next 16 bundled `postcss <8.5.10` moderate advisory.
- `rg getSession app lib`: no matches.
- Secret grep found no literal `sk_live`, `sk_test`, private key, or service-role key values. Matches are code comments/env-key names and SQL references to `service_role`.
- Live linked anon-grant query confirmed broad pre-migration `anon` grants. Live RLS and `net._http_request_queue` queries were blocked by Supabase pooler auth throttling and require `SUPABASE_DB_PASSWORD`.

## Required Manual Actions

1. Deploy `supabase/migrations/20260601233631_production_security_hardening.sql` to production.
2. After deploy, run:
   - `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';`
   - `SELECT grantee, table_name FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='anon';`
   - `SELECT url FROM net._http_request_queue LIMIT 50;`
3. Rotate Supabase service-role key and any Razorpay/Upstash/Sentry secrets that were ever shared outside the secret manager.
4. If any real secret existed in Git history, run `git filter-repo` or equivalent history rewrite and rotate the secret immediately.
5. Move pg_cron/pg_net auth material out of `whatsapp_settings` into Supabase Vault or another managed secret path, then update cron jobs.
6. Configure Razorpay dashboard webhook endpoint to `/api/webhooks/razorpay`, set `RAZORPAY_WEBHOOK_SECRET`, and replay/test subscription events.
7. Set `SUPABASE_DB_PASSWORD` for CLI live DB verification; current linked query attempts hit Supabase pooler `ECIRCUITBREAKER`.

## Accepted Open Risks

- Next 16 currently bundles a vulnerable PostCSS version flagged as moderate by `npm audit`; no high/critical remains. `npm audit fix --force` would downgrade Next to an unsafe major version.
- Some authenticated legacy server actions still return raw Supabase error messages. Public routes and the high-risk tracking, billing, referral, webhook, auth, and DPDP paths were normalized.
- pg_net queued endpoint allow-list could not be live-verified without production DB credentials; manual query is required after credentials are available.
