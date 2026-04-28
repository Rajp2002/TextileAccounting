# Weavly Technical Analysis

This document summarizes the current implementation rather than the older aspirational architecture.

## High-Level Stack

- Framework: Next.js 16 App Router
- UI runtime: React 19
- Styling: Tailwind CSS 4 and shadcn/ui components
- Data: Supabase Postgres with RLS
- Auth: Supabase Auth with JWT claims
- Client state: TanStack Query
- Offline support: Dexie-based local persistence for floor workflows
- Monitoring: Sentry
- Payments: Razorpay
- Messaging: Meta WhatsApp Cloud API
- Rate limiting: Upstash Redis

## Route Architecture

- Public marketing and policy routes live under `app/`.
- Auth flows live under `app/(auth)`.
- Owner features live under `app/(dashboard)/owner`.
- Supervisor features live under `app/(dashboard)/supervisor`.
- Admin compliance lives under `app/(dashboard)/admin`.
- Public tracking lives under `app/(public)/track/[token]`.

The route structure is fairly conventional App Router code: server pages load initial data, then interactive clients take over for mutations and incremental refreshes.

## Auth, Authorization, And Tenant Isolation

### Middleware
`middleware.ts` currently handles:
- public-route detection
- auth-route rate limiting
- API-route auth protection for non-public APIs
- session refresh
- one-hour inactivity timeout
- instant revocation checks
- role-based redirects after sign-in

### Tenant model
- Data is partitioned by `org_id`.
- Supabase JWT claims are read in middleware and server helpers.
- RLS is the main tenant boundary.

### Roles in code
- `owner`
- `supervisor`
- `admin`

## Data And Mutation Model

### Read paths
- Server components load first paint for many owner pages.
- Client components use Supabase browser clients and TanStack Query for interactive views.
- Realtime updates are used on owner-facing operational dashboards.

### Write paths
- Next.js server actions back most privileged mutations.
- Some actions create service-role Supabase clients for protected operations.
- Several modules rely on Postgres RPCs for transaction-heavy business logic.

## Domain Modules

### Estimator, Quotes, Orders
- Core logic lives in `lib/estimator.ts` and owner estimator actions/components.
- Quotes are persisted and later surfaced in `/owner/quotes`.
- Orders are managed from `/owner/orders`.

### Floor Operations
- Main supervisor logic lives in `app/(dashboard)/supervisor/actions.ts` and the unified dashboard page.
- Bulk production logging, order linking, worker assignment, machine status changes, access-code requests, and kharchi flows all converge there.

### Payroll
- Finance helpers live in `lib/finance.ts`.
- Payroll UI lives in `/owner/payroll`.
- Settlement data includes advances, bonuses, fines, and statutory payload details.
- PDF generation lives in `lib/generate-payslip.ts`.

### Inventory, Stock, Ledger, Dispatches
- Inventory module: yarn and beam movement tracking
- Stock module: grey fabric stock board
- Ledger module: party invoices, receipts, claims, and adjustments
- Dispatch module: outbound dispatch records plus public tracking

### Compliance
- Admin and owner compliance functionality spans `lib/actions/compliance.ts`, owner audit pages, lockdown tooling, and the admin dashboard.

## Integrations

### WhatsApp
- Shared edge-function utility is `supabase/functions/_shared/whatsapp.ts`.
- The implemented provider is Meta WhatsApp Cloud API.
- `WHATSAPP_PROVIDER=simulate` is supported for non-production testing.

### Payments
- Razorpay is used for plan checkout and webhook confirmation.
- The app exposes base and premium plan concepts in code.

### Monitoring
- Browser, server, and edge Sentry configs are present.
- Security headers and CSP are defined in `next.config.ts`.

## Current Implementation Caveats

- Time handling is mixed. The repo has `lib/time.ts`, but some client pages still use browser-local `new Date()` for shift and date defaults.
- Comments are not uniformly refreshed. A few edge-function comments still mention Interakt even though the send utility has already moved to Meta.
- Test coverage is narrow compared to feature breadth.
- Because the product leans heavily on migrations and RPCs, schema changes in `supabase/migrations` are often the clearest source of truth for business rules.
