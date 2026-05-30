# Weavly Technical Analysis

Last analyzed from the active codebase on May 31, 2026.

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

- `parties`, `party_invoices`, `party_receipts`, `party_adjustments`, `payment_allocations`
- `suppliers`, `supplier_ledger_entries`
- `yarn_lots`, `beam_cards`, `beam_card_lots`, `yarn_movements`, `order_yarn_requirements`
- `audit_log`, `notice_registry`, `grievances`, `dpas`, `organization_dpas`, `breach_reports`

## Important Server Actions

Estimator and quotes:

- `getFactoryCostProfile`
- `upsertFactoryCostProfile`
- `getEstimatorTemplates`
- `saveAsFabricTemplate`
- `saveEstimatorQuoteV3`
- `convertAcceptedQuoteToOrder`
- `createMarketRunFromEstimator`
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
- Production mode (`organizations.production_mode`) changes navigation visibility but does not change the underlying database shape.
- The implementation has been hardened to use direct Meta API. Legacy references to Interakt have been cleaned up.
- Automated tests are broader than the first Phase 1 pass, but workflow coverage is still uneven relative to complexity.
- `lib/time.ts` centralizes Surat date helpers, but some client code still uses browser `new Date()` for current shift/date.
- Large migration history means runtime code and latest migrations should be treated as authoritative.

## Phase 1 Technical Risk Areas

- Estimator formula correctness.
- Production log duplicate/correction/past-date behavior.
- Payroll cycle/pay-date gating and preview versus settlement persistence.
- Advance recovery and final settlement edge cases.
- Stock sale/adjustment/pending-dispatch math.
- Dispatch partial dispatch and receipt variance.
- WhatsApp failure isolation.
- Archive route/navigation consistency.
