# Weavly

Weavly is a multi-tenant textile operations SaaS for Indian weaving factories. The current product combines estimation, quote-to-order conversion, production logging, payroll, advances, dispatch tracking, stock tracking, inventory, party ledger, billing, and compliance workflows in one Next.js + Supabase application.

## Current Product Surface

### Owner routes
- `/owner/analytics` - production KPI dashboard
- `/owner/orders` - live order management
- `/owner/ledger` - party receivables, payments, claims, and adjustments
- `/owner/estimator` - costing engine, templates, and quote creation
- `/owner/payroll` - month-end settlement for piece-rate and fixed workers
- `/owner/stock` - grey fabric stock board
- `/owner/fixed-workers` - worker directory and fixed staff management
- `/owner/dispatches` - dispatch list and public tracking links
- `/owner/inventory` - yarn and beam inventory
- `/owner/advances` - worker advances / Upaad
- `/owner/machines` - machine fleet management
- `/owner/quotes` - saved estimator quotes and conversion history
- `/owner/billing` - trial and Razorpay subscription management
- `/owner/system-health` - WhatsApp delivery logs and retry actions
- `/owner/settings` and `/owner/settings/audit` - organization settings, exports, access codes, audit, WhatsApp opt-in, float management, lockdown controls

### Supervisor routes
- `/supervisor/dashboard` - unified floor dashboard for shift assignment, order linking, machine status, and bulk production logging
- `/supervisor/workers` - worker CRUD and status updates
- `/supervisor/attendance` - daily attendance for fixed staff
- `/supervisor/machines` - floor-facing machine view
- `/supervisor/production` - redirect to the unified dashboard

### Admin routes
- `/admin` - compliance dashboard for notices, grievances, exports, DPA state, breach and lockdown oversight

### Public routes
- `/track/[token]` - public dispatch tracking portal
- `/privacy`, `/terms`, `/refund-policy` - policy pages

## Architecture

- Next.js 16 App Router with React 19
- Supabase for auth, Postgres, RLS, edge functions, and realtime
- Tailwind CSS 4 + shadcn/ui primitives
- TanStack Query on the client
- Dexie-backed offline queueing for production workflows
- Razorpay for paid subscriptions
- Meta WhatsApp Cloud API for operational messaging
- Upstash Redis for rate limiting and revocation checks
- Sentry across browser, server, and edge runtimes

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

The codebase currently reads these values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PROJECT_ID`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `VERCEL_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_PLAN_ID_BASE`
- `RAZORPAY_PLAN_ID_PREMIUM`
- `NEXT_PUBLIC_RAZORPAY_PLAN_ID_BASE`
- `NEXT_PUBLIC_RAZORPAY_PLAN_ID_PREMIUM`
- `RAZORPAY_WEBHOOK_SECRET`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Supabase edge functions also read:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID`
- `META_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_PROVIDER` (`meta` by default, `simulate` for testing)

## Commands

- `npm run dev` - start the dev server
- `npm run build` - production build
- `npm run start` - run the production build
- `npm run lint` - ESLint

There is currently no dedicated `test` script in `package.json`. The repo has one maintained Vitest suite for finance math at `__tests__/finance.test.ts` plus several ad hoc scripts in `scripts/`.

## Documentation Map

- [MASTER_PRODUCT_DOCUMENT.md](./MASTER_PRODUCT_DOCUMENT.md) - comprehensive developer-facing master product document spanning workflows, architecture, data model, and module logic
- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) - product and module overview
- [USER_WORKFLOWS.md](./USER_WORKFLOWS.md) - role-based route and workflow reference
- [TECHNICAL_ANALYSIS.md](./TECHNICAL_ANALYSIS.md) - implementation architecture notes
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - current manual and automated validation guide
- [WHATSAPP_INTEGRATION_GUIDE.md](./WHATSAPP_INTEGRATION_GUIDE.md) - Meta WhatsApp setup and operations
- [SECURITY.md](./SECURITY.md) - operational security and secret rotation notes
