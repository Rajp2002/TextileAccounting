# Weavly In-App Browser Workflow QA Report

Date: May 31, 2026  
Environment: local Next.js app at `http://localhost:3000`  
Browser surface: Codex in-app Browser  
Accounts used: configured owner and supervisor QA credentials from the private local credential file

## Summary

Overall result: passes on core workflows; previously blocking issues resolved.

Most owner workflows loaded and several full data-changing flows completed successfully: quote save/accept, quote-to-active-order conversion, market-run creation, manual stock creation, stock sale, dispatch receipt, Commercials payment, worker advance, payroll history, settings access-code generation, billing view, loom cost-analysis assignment, and public tracking.

Previously blocking issues resolved as of May 31, 2026:

- **Quote-to-order conversion** (`column reference "order_id" is ambiguous`): fixed by migration `20260531040000` which qualifies the column reference as `estimator_quotes.order_id IS NULL` in the `convert_accepted_quote_to_order` RPC.
- **Loom cost-analysis picker delay**: fixed by performance indexes in migration `20260531050000` (covering `fabric_stock_lots.market_run_id`, `fabric_stock_sales.stock_lot_id`, `orders(market_run_id, status)`) and a `staleTime: 30s` + `keepPreviousData` cache in `MachineManagement`.

There is an ongoing quality issue: many navigations emit React hydration, invalid HTML nesting, or duplicate `html`/`body` mount errors in the browser console. These do not block core workflows but are recurring enough to treat as a cross-cutting improvement target.

## Test Data Created Or Changed

- Created quote: `QA Party 20260531104948` / `QA D246 20260531104948`.
- Marked that quote as sent and accepted.
- Converted accepted `QA D246 20260531104948` into an active order (previously failing — now passes).
- Created quote: `bishram textiles` / `60g polyester` — converted to active order (1,500 m, deadline 2026-07-17). Resolved the `order_id` ambiguity bug during this flow.
- Created market run: `QA Market D246 20260531105150`.
- Confirmed dispatch for existing sale `D.246Vikas fabric`, 300m.
- Recorded exact receipt for that 300m dispatch.
- Recorded Rs. 1 payment against `vinod bhai`.
- Recorded Rs. 1 advance for `Dwarkesh`.
- Generated a one-time owner access code in settings. The code itself is intentionally not recorded here.
- Created manual stock lot: `QA Stock 20260531110342`, 10m at Rs. 1/m.
- Created stock sale: `QA Stock Buyer 20260531110509`, 5m at Rs. 2/m.

## Passes

| Area | Result |
| --- | --- |
| Owner login/logout | Owner login worked and redirected to `/owner/today`. Logout worked through the mobile menu. |
| Protected owner route while logged out | `/owner/today` redirected to `/login`. |
| Auth/public pages | `/login`, `/signup`, `/join`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`, and `/refund-policy` loaded. |
| Factory Today | `/owner/today` loaded with KPIs, action cards, pending dispatch/payroll sections, and navigation. |
| Estimator to quote | Applied `D.246`, entered party/fabric/quantity, saved quote successfully, and redirected to Quote History. |
| Quote status | Draft quote marked accepted via the locking confirmation dialog (silent sent transition logged in DB). |
| **Quote to active order** | **Accepted quote converted into active order with target meters, deadline, and notes. Previously failed; now passes after RPC fix.** |
| Market run | Created a market run from estimator market mode and landed on the run detail page. |
| **Loom cost-analysis picker** | **Bishram Textiles order appeared in the loom assignment dropdown after a brief initial load. Subsequent opens show immediately from cache.** |
| Owner route smoke | Main owner routes loaded: today, estimator, quotes, orders, market-runs, stock, dispatches, commercials, payroll, advances, analytics, settings, machines, fixed-workers, billing, archive. |
| Stock | Manual add-stock dialog opened; manual lot creation succeeded after filling fields by placeholders. |
| Stock sale | Created a stock sale from the new manual lot; stock and pending dispatch counters updated. |
| Dispatch | Pending sale dispatch flow opened, accepted metadata, and created a dispatched batch. |
| Receipt | Record Receipt dialog opened for the dispatched batch; exact receipt submitted and batch moved to delivered/confirmed. |
| Commercials | Collect and Profit Ledger tabs loaded. A partial Rs. 1 payment recorded successfully and totals updated. |
| Advances | Worker selection, Give Advance dialog, and Rs. 1 advance submission worked. |
| Payroll | Payroll preview loaded; pay-date gating was visible; Past Settlements dialog opened with settlement detail and CSV control. |
| Settings | Settings loaded; one-time access-code generation succeeded. |
| Billing | Active Premium billing page, invoice summary, referral card, and auto-renewal state rendered. External payment/auto-renew changes were not executed. |
| Public tracking | Valid `/track/i1krXNTZnQwQ` loaded unauthenticated. Invalid token showed Link Not Found. |
| Archived routes | `/owner/inventory`, `/owner/ledger`, `/owner/settings/audit`, `/owner/system-health`, and `/admin` redirected to the Phase 1 archived page. |

## Remaining Issues

| Severity | Workflow | Evidence |
| --- | --- | --- |
| Medium | Browser console health | Repeated console errors appear across owner, supervisor, public tracking, payroll, settings, stock, and billing routes: React hydration mismatch, invalid HTML nesting, and duplicate `html`/`body` mount warnings. |
| Medium | Public/app layout transition | Navigating between dashboard routes and public/legal/tracking routes triggers duplicate root mount errors such as multiple `html` and `body` components mounted at the same time. |

## Gaps

| Area | Gap |
| --- | --- |
| Supervisor production logging | Supervisor dashboard loaded but showed `0/0 assigned` and `No looms found`, while the loom board listed inactive looms. Save shift logs was disabled, so an actual meter-log submission could not be completed during this QA pass. |
| Supervisor permission differences | The configured supervisor session reached supervisor routes, but the dashboard displayed an owner-view banner. Owner/supervisor permission differences need a clean supervisor-only QA account or profile check. |
| Machine activation and assignment | Loom board rendered inactive assigned looms, but no workflow was completed to activate looms and make them loggable. |
| Order tracking for newly created work | The created market run/order-like item showed "tracking starts after first log". Since production logging was blocked, a new public tracking link could not be validated from fresh data. |
| Signup completion | Signup page loaded, but full account creation was not executed to avoid creating a new real auth user. The `Create factory` button remains disabled until required fields and consent are complete. |
| Join-code success path | Join page loaded, but successful supervisor join was not completed. Invalid-code validation did not visibly surface during the quick blur test. |
| Payments/subscription changes | Billing page was inspected only. Auto-renewal toggle, Razorpay checkout, and payment-method changes were not executed. |
| WhatsApp sends | WhatsApp opt-in/send paths were not executed to avoid external messaging. Advance flow correctly reported that the selected worker had no WhatsApp number. |
| Accessibility/testability | Several form labels are visible text but not associated with inputs. Browser automation had to use placeholders or positional input selection on stock forms. |

## Notes By Workflow

### Owner Setup And Settings

Settings, production mode, factory identity, join code, WhatsApp opt-in surface, factory cost profile, and access-code generation all rendered. Access-code generation succeeded. I did not regenerate the factory join code or enable WhatsApp because those are higher-impact state/external communication actions.

### Estimator, Quotes, Orders

Estimator calculation, template application, quote save, quote status transitions, and Quote History rendering passed. Quote-to-order conversion now passes after the RPC ambiguity fix. The `bishram textiles` / `60g polyester` order was created successfully for 1,500 m.

### Loom Cost-Analysis Assignment

After creating the Bishram Textiles order, navigating to Looms showed the order in the cost-analysis picker after an initial load (~1–2 s cold start). Subsequent picker opens are instant due to the `staleTime` cache. The initial delay is reduced by the new database indexes on `fabric_stock_lots` and `fabric_stock_sales`.

### Market Runs

Market-run creation from estimator passed. The new run detail showed target meters, production cost stack, and Stock/Commercials handoff guidance.

### Supervisor Floor Work

Supervisor routes rendered: dashboard/production, workers, attendance, machines. Attendance save succeeded. Actual production meter logging was blocked because no active/loggable looms were available.

### Stock, Dispatch, Tracking

Manual stock creation passed, stock sale passed, pending dispatch passed, receipt confirmation passed, and public tracking loaded for an existing tracking token. The newly created stock sale was saved only, leaving 5m sold pending dispatch for future testing.

### Commercials, Payroll, Advances

Commercials payment recording worked and totals updated. Payroll preview and settlement history loaded. Advance recording worked and appeared in the worker ledger and payroll preview.

## Recommended Follow-Ups

1. ~~Fix quote-to-order conversion~~ — **resolved** (migration `20260531040000`).
2. ~~Fix loom cost-analysis picker delay~~ — **reduced** (migration `20260531050000` + query cache).
3. Fix the recurring hydration and invalid document nesting errors before release QA.
4. Seed or configure a QA org with active looms, assigned workers, and an active production target so supervisor meter logging can be tested end-to-end.
5. Add accessible label associations to stock, dispatch, and other dialog inputs.
6. Add a clean supervisor-only QA account and re-run role-permission tests.
7. Run a focused payment/WhatsApp test only in confirmed test/simulate mode.
