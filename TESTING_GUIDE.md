# Weavly Testing Guide

Last updated May 31, 2026.

## Current Automated Coverage

The repo has Vitest-style coverage across finance and several Phase 1 regressions:

- `__tests__/finance.test.ts` — estimator math, market runs, stock lifecycle/source validation
- `__tests__/p1-party-first-stock-sale-dispatch.test.ts` — party-first stock sale and dispatch
- `__tests__/p1-stock-lifecycle.test.ts` — stock lifecycle and source validation (expanded)
- `__tests__/payroll-cycle.test.ts` — payroll cycle bounds, guards, and pay-date config
- `__tests__/payroll-pay-date-config.test.ts` — configurable pay-date behavior
- `__tests__/payroll-settlement-history.test.ts` — settlement history reconstruction: earning lines, CSV export shape, filename format (`FactoryName_CycleStart-CycleEnd.csv`)
- Commercials read model and payments
- production log strictness/forgiveness
- auth/login and billing gates
- WhatsApp consent

There are also ad hoc scripts in `scripts/` and a Supabase seed file at `supabase/seed_qa_data.sql`. Phase 1 should not assume comprehensive automated end-to-end workflow coverage.

## Commands

- `npm run lint`
- `npm run build`
- `npx vitest run <file>` — run a specific test file
- `npx vitest run` — run all test files

No dedicated `test` script is in `package.json`; use the Vitest commands above directly. Add a `test` script to `package.json` if CI integration is needed.

## Phase 1 Test Priorities

### 1. Estimator and Quote Lifecycle

Validate with real factory examples:

- warp yarn kg/cost
- weft yarn kg/cost
- GST
- shortage
- warp crimp
- float denier input (supported as of May 2026)
- warping/sizing/winding/process/finishing
- overhead allocation and override
- loom RPM/power assumptions
- commission, transport, margin
- quote price and landed cost
- quote snapshot restore (and stale-draft collision warning banner)
- **accepted quote to order conversion** — verified working; the `convert_accepted_quote_to_order` RPC `order_id` ambiguity bug was fixed in migration `20260531040000`. Regression test should confirm this path end-to-end.
- Start Party Order fast path (accepted quote + order in one step from estimator)
- loom cost-analysis picker loads the new order within 30 s (stale cache window); immediate after cache invalidation
- market run creation from estimator

### 2. Supervisor Production Log

Manual and automated scenarios:

- current date/current shift default
- date and shift switching
- copy previous shift
- assign worker and order/run
- missing worker
- missing order/run
- closing reading greater than opening
- closing reading lower than opening
- duplicate machine/date/shift submission
- correction within allowed window
- protected overwrite with owner access code
- past-date attendance or production protection
- machine status update
- maintenance/breakdown note update

### 3. Orders and Market Runs

Scenarios:

- quote accepted to active order
- order target/deadline validation
- machine assignment update
- production log updates order progress
- order pace/days remaining display
- complete/cancel order
- create market run
- production updates market-run produced meters
- expected stock/sale updates market-run status and profit

### 4. Stock and Commercials

Scenarios:

- create stock lot manually
- create stock lot from market run
- create stock lot from order source
- market-run production creates expected ledger stock without mandatory inward confirmation
- confirm inward draft where optional/order-based flow still exists
- adjust stock up
- adjust stock down
- prevent invalid negative stock
- create party-first stock sale with named party and credit days
- verify receivable creation and due-date behavior
- dispatch pending sold meters fully
- dispatch pending sold meters partially
- keep partial sales pending after one batch is received
- record receipt shortage/excess as a stock discrepancy
- verify revenue/cost/gross profit
- verify Commercials filtering and summary totals

### 5. Dispatches and Tracking

Scenarios:

- create order-linked dispatch from sold stock
- create orderless stock-sale dispatch from pending sale
- create partial dispatch batch with selected meters and dispatch date
- include transport/GST/e-way metadata
- public tracking token loads without login
- owner confirms exact received meters
- owner confirms shortage
- owner confirms extra received with confirmation
- status transitions to delivered/disputed
- stock-sale status transitions across not_dispatched, partially_dispatched, dispatched, and received

### 6. Payroll and Advances

Scenarios:

- meter worker gross from production logs
- fixed worker salary/daily attendance calculation
- pending advances display
- advance deduction cap
- final settlement deduction behavior
- PF/ESI deductions
- payment mode persistence
- pay-date/reminder gating for normal settlements
- owner verification before settlement
- settle and unsettle
- paid/pending status
- payslip PDF generation
- WhatsApp payslip send path in simulate mode
- advance receipt send path in simulate mode

### 7. Auth, Settings, and Access Codes

Scenarios:

- owner signup and onboarding gate
- supervisor join code
- role redirects
- archived route redirect
- one-time access code generation
- invalid code rate limiting/lockout
- code consumption after success
- inactive session redirect
- organization name update
- join-code regeneration invalidates old code

## WhatsApp Test Mode

Use Supabase edge-function secret:

- `WHATSAPP_PROVIDER=simulate`

This should let send functions succeed and log attempts without sending real messages.

Verify:

- `whatsapp_delivery_log` rows are created.
- failed rows can be retried where retry UI/function is available.
- core writes still succeed when message send fails.

## Browser/Manual Smoke Test

Minimum release smoke:

1. Owner signup.
2. Onboarding complete with production mode, machines/workers/payroll timing, and plan/trial.
3. Estimator creates quote.
4. Quote accepted and converted to order.
5. Supervisor logs production.
6. Owner analytics updates.
7. Payroll previews worker earnings.
8. Advance is recorded and deducted.
9. Market-run production creates expected stock, or optional/order-based inward flow still works.
10. Party-first stock sale appears in Commercials as a receivable.
11. Pending stock sale is dispatched and receipt is confirmed.
12. Order-linked tracking link opens where applicable.
13. Billing page shows plan/trial state.

## Release Confidence Gap

Before declaring Phase 1 production-ready, keep automated tests strong around estimator math, production logging guards, payroll pay-window/settlement behavior, party-first stock sale math, partial dispatch, and receipt variance. These are the areas with the highest trust impact.
