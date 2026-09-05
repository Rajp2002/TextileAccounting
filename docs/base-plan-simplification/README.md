# Base Plan Simplification Program

**Date:** 14 August 2026  
**Status:** Proposed  
**Scope:** Base / Estimator Plan only  
**Audience:** Product, design, frontend, QA, and pilot reviewers

**Scope update — 29 August 2026:** Base now includes the deliberately small owner-only [Production Core](../base-production-core-scope.md). It extends the costing trust chain into a production job, metre entry, and basic piece-rate settlement while leaving formal factory operations in Full Suite.

The proposed next phase—contextual machine and worker setup, desktop connector-line assignment, mobile tap-to-assign, and a worker-first daily production sheet—is captured in the [Base Operational Loop Sprint Plan](../base-operational-loop-sprint-plan.md).

## Product outcome

Make Base feel like a dependable costing desk for a small or mid-sized grey-fabric weaving owner. The product should make the common job shorter without removing the history, review, comparison, export, and privacy features that make it more trustworthy than a calculator or spreadsheet.

The target trust chain is:

**current rate → reusable quality → immutable costing snapshot → explainable comparison → safe document**

The primary persona is Mahesh: a proprietor or commercial decision-maker who needs to quote quickly, is interrupted during the day, understands textile shorthand, and does not want to become an accountant or textile technologist.

## Design decisions

1. Simplify the common path, not the calculation model.
2. Keep one authoritative estimator; do not create a second Quick calculation engine.
3. Prefer progressive disclosure over deleting valid textile assumptions.
4. Give each concept one home: rates in Rate Book, qualities and versions in Saved Costings, defaults in Settings, subscription state in Billing.
5. Preserve historical truth: current rates and defaults affect future estimates only.
6. Make internal economics and customer-safe documents visibly separate.
7. Keep Base free of formal production-floor, stock, dispatch, advanced payroll, supervisor, and CRM workflows. Its small owner-only Production Core is intentionally limited to costing-linked jobs, metre entries, piece-rate workers, advances, and basic settlement.

## Sprint sequence

| Sprint | Surface | Primary user value | Priority |
| --- | --- | --- | --- |
| 1 | Estimator | Produce a repeat-quality costing quickly and understand what is blocking it | P0 |
| 2 | Yarn Rate Book | Review supplier-driven rate changes without scanning an administrative table | P0 |
| 3 | Saved Costings | Reuse a quality and explain version movement without duplicate record concepts | P1 |
| 4 | Settings | Configure future estimates without seeing Full Suite administration | P1 |
| 5 | Billing | Understand workspace and paid subscription state without contradictory labels | P1 |

## Persona-to-sprint traceability

| Persona need | Supporting sprint(s) |
| --- | --- |
| Quote a known quality quickly | 1, 3 |
| Keep rates current and know what needs review | 1, 2 |
| Preserve history and avoid overwriting old answers | 1, 2, 3 |
| Explain why a price changed | 1, 2, 3 |
| Share a professional document without exposing margin | 1, 5 |
| Continue after an interruption | 1 |
| Keep factory defaults understandable | 4 |
| Retain data and account control | 3, 4, 5 |

## Cross-sprint invariants

- Server-authoritative calculations and validation remain unchanged.
- A saved costing records its rate/date/quantity basis and remains immutable.
- Rate Book changes do not recalculate historical costings.
- Customer-safe output never exposes production cost, overhead, margin, or expected profit.
- Base navigation exposes standalone costing surfaces plus the small owner-only Production Core.
- Draft recovery distinguishes local browser state from a saved factory record.
- Every new interaction is checked at desktop and 320–480px widths.
- English, Hindi, and Gujarati copy must preserve the same meaning and status distinctions.

## Program definition of done

- A Rajesh/Mahesh-like owner can create a first costing with minimal guidance.
- A returning owner can re-cost a known quality without rebuilding its construction.
- A changed rate produces a new explainable version rather than changing the old one.
- The owner can identify the one next action from every blocked state.
- The owner can produce an internal sheet or customer-safe quotation without leaking internal economics.
- QA evidence records the core tasks, not only screenshots: repeat costing, rate review, comparison, export, draft recovery, archive/restore, and billing clarity.

## Existing product references

- [Base estimator refinement plan](../base-estimator-refinement-sprint-plan.md)
- [Base estimator feature-value gate](../base-estimator-feature-value-analysis.md)
- [Base settings refinement](../base-settings-refinement.md)
- [Base Plan persona](../engineer-handoff/04-base-plan-user-persona.md)
