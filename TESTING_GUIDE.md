# Weavly Testing Guide

This guide reflects the current app surface and the current level of automated coverage.

## Automated Checks

### Lint
```bash
npm run lint
```

### Finance unit tests
The maintained unit-test suite currently lives in `__tests__/finance.test.ts`.

```bash
npx vitest run __tests__/finance.test.ts
```

### Useful diagnostic scripts
The `scripts/` folder contains one-off operational scripts for schema inspection, workflow debugging, migrations, and data cleanup. Treat these as developer tools, not a stable test suite.

## Manual Smoke Test Matrix

### 1. Authentication
- Sign up as an owner.
- Complete onboarding.
- Log out and log back in.
- Confirm owner redirect goes to `/owner/analytics`.
- Join an organization as a supervisor.
- Confirm supervisor redirect lands on `/supervisor/dashboard` via `/supervisor/production`.

### 2. Owner Core Flow
- Open `/owner/estimator` and create or load a quote.
- Confirm the quote appears in `/owner/quotes`.
- Open `/owner/orders` and verify order data renders correctly.
- Open `/owner/market-runs` and verify speculative production tracking.
- Open `/owner/analytics` and confirm KPI cards and active operational data load.

### 3. Supervisor Floor Flow
- Open `/supervisor/dashboard`.
- Assign a worker to a machine.
- Link the machine to an active order.
- Enter production and submit the bulk log flow.
- Use **SUBMIT & PACK** and verify that fabric packages are created and visible in `/owner/stock`.
- Verify the owner dashboard reflects the new data.

### 4. Payroll And Advances
- Record an advance in `/owner/advances`.
- Open `/owner/payroll` for a target month.
- Settle a worker with pending debt.
- Verify net payout, carry-forward debt, and statutory payload sections render.
- Trigger payslip generation and, if configured, WhatsApp sending.

### 5. Inventory, Stock, Ledger, Dispatches
- Confirm `/owner/inventory` loads yarn and beam module data.
- Confirm `/owner/stock` loads the grey fabric stock board.
- Confirm `/owner/ledger` loads party ledger data.
- Confirm `/owner/dispatches` loads dispatch rows and that a public tracking token works.

### 6. Settings, Audit, And Billing
- Open `/owner/settings`.
- Regenerate join code.
- Generate an access code.
- Open `/owner/settings/audit` and verify events load.
- Open `/owner/billing` and verify subscription state loads.

### 7. WhatsApp And Ops
- Open `/owner/system-health`.
- Confirm delivery logs render.
- Retry a failed log if test data exists.

### 8. Admin
- Open `/admin`.
- Confirm grievances, notices, DPA state, and breach/export data render.

## Regression Hotspots

Pay extra attention to these areas after schema or action changes:

- supervisor dashboard bulk logging
- owner payroll settlement math
- quote-to-order data continuity
- public tracking token access
- WhatsApp retries and logging
- subscription gating and redirects
- access-code-protected destructive or historical edits

## Known Gaps In The Test Story

- There is no first-class end-to-end test suite in the repository yet.
- Timezone-sensitive flows still need extra manual verification because some client screens use browser-local time helpers.
- Most high-risk business logic outside `lib/finance.ts` is still validated by manual smoke tests and migration-level reasoning.
