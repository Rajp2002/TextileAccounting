# Weavly Technical Analysis

Last analyzed from the active codebase on June 1, 2026. Updated to reflect the Commercials party identity pivot, stock-sale party selection, and May 31 bug fixes/performance improvements.

## Stack

- Next.js App Router with React client/server split.
- Supabase Auth, Postgres, RLS, RPCs, Realtime, and Edge Functions.
- Tailwind CSS and shadcn/ui primitives.
- TanStack Query for interactive client views.
- Razorpay for subscriptions.
- Meta WhatsApp Cloud API through Supabase Edge Functions.
- Upstash Redis for rate limiting/session revocation when configured.
- Sentry configs for client, server, and edge.

## Route Architecture

Public/auth:

- `/`
- `/login`, `/signup`, `/join`, `/verify`, `/onboarding`
- `/auth/callback`, `/auth/confirm`, `/auth/auth-code-error`
- `/privacy`, `/terms`, `/refund-policy`
- `/track/[token]`

Owner:

- active Phase 1: today, analytics, estimator, quotes, orders, market-runs, stock, dispatches, commercials, payroll, advances, fixed-workers, machines, billing, settings
- archived/deferred: inventory, ledger, settings/audit, system-health, admin-facing DPA/compliance paths

Supervisor:

- dashboard/production log, workers, attendance, machines

Admin:

- `/admin`, archived for Phase 1 through `lib/phase1-scope.ts`

## Auth and Route Guards

The middleware handles:

- public route classification
- API JSON 401 behavior for protected API routes
- auth route rate limiting
- Supabase session refresh
- session revocation check
- one-hour inactivity timeout
- authenticated redirects by role
- owner onboarding redirect
- role mismatch redirects
- Phase 1 archive redirects to `/feature-archived`

`requireRole()` is used in server components and actions for server-side role enforcement.

## Multi-Tenancy

The core tenancy boundary is `org_id`.

Tenancy is enforced through:

- Supabase RLS policies.
- Server-side role checks.
- Custom JWT claims for `user_role`, `org_id`, and onboarding status.
- Server actions that derive org from the authenticated profile rather than trusting client input.

## Core Domain Tables and Views

Setup and identity:

- `organizations`
- `profiles`
- `machines`
- `workers`
- `fixed_workers`
- `payroll_configs`

Estimator and commercial:

- `factory_cost_profile`
- `estimator_templates`
- `estimator_quotes`
- `orders`
- `market_runs`
- `market_run_sales`

Production:

- `shift_assignments`
- `machine_assignments`
- `production_logs`
- `attendance`

Stock and dispatch:

- `fabric_packages`
- `dispatches`
- `dispatch_package_lines`
- `party_dispatch_claims`
- `fabric_stock_lots`
- `fabric_stock_sales`
- `fabric_stock_movements`
- `fabric_stock_inward_drafts`
- `stock_discrepancies`

Commercials:

- `parties` — active lightweight customer identity for Sell Stock and Commercials grouping; full ledger use remains deferred.
- `commercial_profit_entries`
- `commercial_receivables`
- `commercial_payment_receipts`

Payroll and advances:

- `worker_advances`
- `payroll_settlements`
- `payroll_adjustments`
- `payroll_adjustment_categories`
- `payroll_payments`
- `supervisor_float_transactions`

Deferred ERP/governance:

- `party_invoices`, `party_receipts`, `party_adjustments`, `payment_allocations`
- `suppliers`, `supplier_ledger_entries`
- `yarn_lots`, `beam_cards`, `beam_card_lots`, `yarn_movements`, `order_yarn_requirements`
- `audit_log`, `notice_registry`, `grievances`, `dpas`, `organization_dpas`, `breach_reports`

Key views:

- `market_run_summary` — aggregates per-run totals (produced, sold, in-godown, profit) via 8 correlated subqueries. Indexed by `fabric_stock_lots(market_run_id)`, `fabric_stock_sales(stock_lot_id)`, and `orders(market_run_id, status)` (migration `20260531050000`).
- `fabric_stock_lot_summary` — per-lot sales aggregate with `security_invoker`.
- `order_progress_view` — per-order production/pace summary.

## Important Server Actions

Estimator and quotes:

- `getFactoryCostProfile`
- `upsertFactoryCostProfile`
- `getEstimatorTemplates`
- `saveAsFabricTemplate`
- `saveEstimatorQuoteV3`
- `convertAcceptedQuoteToOrder` — calls the `convert_accepted_quote_to_order` RPC; ambiguous `order_id` column reference fixed in migration `20260531040000`.
- `startPartyOrderFromEstimator` — fast-path from Estimator to accepted quote + order in one shot.
- `createMarketRunFromEstimator`
- `getActiveProductionTargets` — returns assignable party orders and in-production market runs for the loom cost-analysis picker. Uses `market_run_summary` view; cached on the client for 30 s with `keepPreviousData` to avoid cold-start flicker.
- `getMarketRuns`
- `createMarketRunSaleAction`

Supervisor:

- `getShiftSetupData`
- `upsertShiftAssignment`
- `copyPreviousShiftAction`
- `bulkLogProduction`
- `updateMachineStatus`
- `updateMachineBreakdown`
- `requestAccessCode`

Owner operations:

- machine and worker actions in `app/(dashboard)/owner/actions.ts`
- order/dispatch actions in `app/(dashboard)/owner/orders/actions.ts`
- party-first stock sale actions in `app/(dashboard)/owner/dispatches/actions.ts`
- stock actions in `app/(dashboard)/owner/stock/actions.ts`
- payroll actions in `app/(dashboard)/owner/payroll/actions.ts`
- advances actions in `app/(dashboard)/owner/advances/actions.ts`
- commercials actions in `app/(dashboard)/owner/commercials/actions.ts`
  - `getCommercialPartyInsights` reads realized commercial entries, receivables, and active parties to build 7D/30D/year/all leaderboards plus the party directory.

## Realtime and Offline

Owner analytics subscribes to `production_logs` insert events and refreshes live dashboard data with debouncing.

Offline support exists through hooks/providers and Dexie-style mutation queueing patterns. Production UX also uses local state/local persistence for user-entered readings in some areas. Offline behavior should be verified carefully before claiming full offline-first reliability.

## WhatsApp

Supabase Edge Functions handle operational messaging:

- `send-access-code`
- `send-daily-brief`
- `send-deadline-alert`
- `check-pace-index`
- `monthly-brief`
- `send-advance-receipt`
- `send-payslip`
- `retry-failed-messages`
- `send-lockdown-alert`
- `whatsapp-webhook`

The active provider is Meta WhatsApp Cloud API through `supabase/functions/_shared/whatsapp.ts`. Delivery attempts are logged in `whatsapp_delivery_log`.

## Billing

Billing uses Razorpay:

- `app/api/subscriptions/create/route.ts`
- `app/api/subscriptions/trial/route.ts`
- `app/api/subscriptions/auto-renew/route.ts`
- `app/api/webhooks/razorpay/route.ts`
- `org_subscriptions`
- `subscription_payments`
- `subscription_plans`

## Known Technical Realities

- Documentation must distinguish active `/owner/stock` from archived `/owner/inventory`.
- Documentation must distinguish party-first stock sale/pending dispatch from the older order-first dispatch-only story.
- `parties` is no longer wholly deferred: active Phase 1 uses it only for lightweight customer identity, stock-sale party resolution, and Commercials party grouping. Full `/owner/ledger` accounting remains archived.
- The June 1 party identity migration adds `party_id` to `fabric_stock_sales` and `commercial_receivables`, drops the old active-party unique-name index, backfills unique exact-name matches, and rebuilds `commercial_profit_entries` with party IDs/names.
- Production mode (`organizations.production_mode`) changes navigation visibility but does not change the underlying database shape.
- The implementation has been hardened to use direct Meta API. Legacy references to Interakt have been cleaned up.
- Automated tests are broader than the first Phase 1 pass, but workflow coverage is still uneven relative to complexity.
- `lib/time.ts` centralizes Surat date helpers, but some client code still uses browser `new Date()` for current shift/date.
- Large migration history means runtime code and latest migrations should be treated as authoritative.
- The `convert_accepted_quote_to_order` RPC had an ambiguous `order_id` column reference (fixed `20260531040000`). The function uses a `RETURNS TABLE(... order_id UUID ...)` declaration; the UPDATE WHERE clause must always qualify the column as `estimator_quotes.order_id`.
- The `market_run_summary` view uses 8 correlated subqueries. Direct queries against this view can be slow without the indexes added in `20260531050000`. Always filter at the application layer where possible and cache results.
- The loom cost-analysis picker (`getActiveProductionTargets`) is cached client-side for 30 s with TanStack Query `staleTime` and `keepPreviousData`. The cache is invalidated immediately after any assignment change via `queryClient.invalidateQueries`.

## Phase 1 Technical Risk Areas

- Estimator formula correctness.
- Production log duplicate/correction/past-date behavior.
- Payroll cycle/pay-date gating and preview versus settlement persistence.
- Advance recovery and final settlement edge cases.
- Stock sale/adjustment/pending-dispatch math.
- Dispatch partial dispatch and receipt variance.
- WhatsApp failure isolation.
- Archive route/navigation consistency.
- React hydration mismatches across dashboard/public layout boundary (not yet resolved).
