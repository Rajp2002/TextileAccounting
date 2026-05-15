# Weavly Testing Guide

Last analyzed from the active codebase on May 6, 2026.

## Current Automated Coverage

The repo currently has a maintained finance math test suite at:

- `__tests__/finance.test.ts`

There are also ad hoc scripts in `scripts/` and several test/probe files, but Phase 1 should not assume comprehensive automated workflow coverage.

## Commands

- `npm run lint`
- `npm run build`

There is no dedicated `test` script in `package.json` at the time of this pass. If adding tests, also add a stable package script.

## Phase 1 Test Priorities

### 1. Estimator

Validate with real factory examples:

- warp yarn kg/cost
- weft yarn kg/cost
- GST
- shortage
- warp crimp
- warping/sizing/winding/process/finishing
- overhead allocation and override
- loom RPM/power assumptions
- commission, transport, margin
- quote price and landed cost
- quote snapshot restore
- accepted quote to order conversion
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
- record stock sale
- record actual dispatched meters and stock difference on shortage/excess
- verify revenue/cost/gross profit
- verify Commercials filtering and summary totals

### 5. Dispatches and Tracking

Scenarios:

- create dispatch from order
- include transport/GST/e-way metadata
- public tracking token loads without login
- owner confirms exact received meters
- owner confirms shortage
- owner confirms extra received with confirmation
- status transitions to delivered/disputed

### 6. Payroll and Advances

Scenarios:

- meter worker gross from production logs
- fixed worker salary/daily attendance calculation
- pending advances display
- advance deduction cap
- final settlement deduction behavior
- PF/ESI deductions
- payment mode persistence
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
2. Onboarding complete with machines/workers/payroll.
3. Estimator creates quote.
4. Quote accepted and converted to order.
5. Supervisor logs production.
6. Owner analytics updates.
7. Payroll previews worker earnings.
8. Advance is recorded and deducted.
9. Market-run production creates expected stock, or optional/order-based inward flow still works.
10. Stock sale appears in Commercials.
11. Dispatch is created and tracking link opens.
12. Billing page shows plan/trial state.

## Release Confidence Gap

Before declaring Phase 1 production-ready, add automated tests around estimator math, production logging guards, payroll settlement, stock sale math, and dispatch receipt variance. These are the areas with the highest trust impact.
