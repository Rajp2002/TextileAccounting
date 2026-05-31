# Estimator and Quotes

Last reviewed against the active documentation pass on May 31, 2026.

## Phase 1 Status

Core Phase 1 pillar. The estimator is the commercial entry point for Weavly.

## What It Does

The estimator lets an owner calculate the cost and quote price of a fabric from weaving-specific inputs. It covers warp/weft yarn rows, denier, beam ends, picks, reed space, yarn rates, GST, shortage, warp crimp, loom type, RPM, power, hours per shift, warping, sizing, winding, processing, finishing, overheads, fixed-worker overhead, commission, transport, and profit.

Quotes save both the final commercial values and the estimator state snapshot so historical quote assumptions can be restored later.

## User Workflow

1. Owner opens `/owner/estimator`.
2. Owner starts from defaults or applies a saved template.
3. Owner enters fabric quality details: warp rows, weft rows, tape length, picks, denier, yarn rate, GST, shortage, and crimp.
4. Owner configures loom assumptions: loom type, RPM, power, hours per shift, and sizing mode.
5. Owner reviews cost stack and scenarios.
6. Owner saves a reusable fabric template or updates an existing one.
7. Owner enters party name, quality label, warp/weft instructions, meters, and margin.
8. Owner saves the quote: chooses **Save Quote** (saves as draft) or **Save & Accept** (immediately locks the costing).
9. Owner manages quote status in `/owner/quotes`: draft, accepted, or rejected (manual 'sent' step is collapsed from the UI but logged silently in database audit triggers). Accepting a draft quote prompts a locking confirmation dialog.
10. Owner re-estimates an old quote by restoring its snapshot into local estimator draft state. The UI displays a warning banner to prevent stale draft collisions.
11. Owner converts an accepted quote into an active order by clicking "Create Active Order" in Quote History.
12. Owner can create a market run from estimator market mode.

## Existing Workflow Translation

Old workflow:

- Owner calculates yarn and weaving cost in a notebook, calculator, Excel file, or from memory.
- Old rates and fabric qualities are copied from previous parchi.
- Margin is decided quickly under trader pressure.
- A quote may be sent over phone or WhatsApp, but the assumptions are hard to reconstruct later.

Weavly workflow:

- The fabric recipe is structured.
- Inputs update totals immediately.
- Templates preserve repeat qualities.
- Quotes store a durable snapshot.
- Accepted quotes can become production orders without retyping.

## Pain Points Solved

- Guesswork pricing.
- Hidden overhead and process costs.
- Re-entering repeat qualities.
- Losing quote assumptions after yarn rates change.
- Poor handoff from commercial quote to production instruction.

## User Interaction Details

- Templates can be saved, renamed, updated, rate-updated, deleted, and applied.
- Factory cost profile can be saved from the estimator.
- Monthly output suggestions can use recent production.
- Fixed workers can be merged into overhead items.
- Scenario analysis helps the owner see sensitivity to margin/price assumptions.
- Quote history lets the owner filter by status and restore or convert records.

## Data and Code

- `app/(dashboard)/owner/estimator/EstimatorClient.tsx`
- `app/(dashboard)/owner/estimator/actions.ts`
- `app/(dashboard)/owner/quotes/QuotesClient.tsx`
- `lib/estimator.ts`
- `lib/finance.ts`
- `factory_cost_profile`
- `estimator_templates`
- `estimator_quotes`
- `orders`
- `market_runs`

## Downstream Effects

- Accepted quote conversion creates active orders.
- Market mode creates market runs.
- Worker-rate and cost snapshots flow into production and payroll.
- Quote data feeds expected commercial profit.

## Readiness Notes

- Formula tests are critical before launch.
- Quote snapshots must remain stable after template or factory-profile edits.
- The first-time owner path should remain simple despite the advanced controls.
