# Guided tours: execution queue

One strict order. One active task at a time. A task starts only when every dependency is **PASSED** in [EXECUTION_STATUS.md](EXECUTION_STATUS.md) and the task before it in this list is PASSED (or, for GT-B1, when its unblock conditions are met). No reordering, skipping or parallel feature work. Rationale for the order: plan D-15.

| # | Task | Purpose | Depends on | Gate | Packet |
| --- | --- | --- | --- | --- | --- |
| 1 | GT-00 | Validate the baseline, the handoff assumptions and the harness | — | G0 (executor) | [GT-00](tasks/GT-00-baseline.md) |
| 2 | GT-01 | Shared runtime and presentation: placement, readiness, scroll, panel, spotlight, `GuidedTour`, shared copy, sample ids, one-tour guard | GT-00 | Task gate (executor) | [GT-01](tasks/GT-01-runtime-foundation.md) |
| 3 | GT-02 | Invitation and persistence: guide card lifecycle, "Not now", compact launcher, no page refresh, halo removal, data-safety contract tests | GT-01 | Task gate (executor) | [GT-02](tasks/GT-02-invitation-persistence.md) |
| 4 | GT-03 | **Reference tour:** Saved Costings (Free, Lite, Base + Compare walkthrough) on the new runtime | GT-02 | Task gate, then REVIEW_REQUIRED | [GT-03](tasks/GT-03-saved-costings.md) |
| 5 | GT-04 | **Gate G1:** senior review + owner QA run + native spot check of the foundation and reference tour | GT-03 | **G1 (reviewer + owner)** | [GT-04](tasks/GT-04-gate-g1.md) |
| 6 | GT-05 | Cost Estimator (Free, Lite, Base), migrate the bespoke engine | GT-04 | Task gate | [GT-05](tasks/GT-05-cost-estimator.md) |
| 7 | GT-06 | Yarn Rate Book, migrate the bespoke engine | GT-05 | Task gate | [GT-06](tasks/GT-06-rate-book.md) |
| 8 | GT-07 | Dispatches; introduces the replica workspace shell and live handoff (EC-18) | GT-06 | Task gate | [GT-07](tasks/GT-07-dispatches.md) |
| 9 | GT-08 | Fabric Stock; remove the tour from the audit page; `qualityStock.audit` key | GT-07 | Task gate | [GT-08](tasks/GT-08-fabric-stock.md) |
| 10 | GT-09 | Yarn Stock | GT-08 | Task gate | [GT-09](tasks/GT-09-yarn-stock.md) |
| 11 | GT-10 | Payroll (core + "Advances, records and corrections"); remove the `full` variant | GT-09 | Task gate | [GT-10](tasks/GT-10-payroll.md) |
| 12 | GT-11 | Production "Set up production" (Overview) | GT-10 | Task gate | [GT-11](tasks/GT-11-production.md) |
| 13 | GT-12 | Daily Sheet "Record a shift" (new tour and launcher) | GT-11 | Task gate | [GT-12](tasks/GT-12-daily-sheet.md) |
| 14 | GT-13 | Machines | GT-12 | Task gate | [GT-13](tasks/GT-13-machines.md) |
| 15 | GT-14 | Workers | GT-13 | Task gate | [GT-14](tasks/GT-14-workers.md) |
| 16 | GT-15 | Machine Assignments | GT-14 | Task gate | [GT-15](tasks/GT-15-machine-assignments.md) |
| 17 | GT-16 | Retire tour code made unused by GT-03..GT-15 | GT-15 | Task gate | [GT-16](tasks/GT-16-retire-legacy.md) |
| 18 | GT-17 | Cross-feature regression and final acceptance | GT-16 | **G2 (reviewer + owner + native review)** | [GT-17](tasks/GT-17-final-acceptance.md) |
| — | GT-B1 | Stock audit tour | GT-17 **and** PI-06, PI-07 fixed **and** owner decision (page spec §C) | Task gate | [GT-B1](tasks/GT-B1-stock-audit.md) — **BLOCKED** |

## Dependency check

- Linear chain GT-00 → GT-17; every task depends only on its predecessor, so there are no cycles or missing prerequisites.
- Cross-task artifacts, each produced before it is consumed:

| Artifact | Produced by | Used by |
| --- | --- | --- |
| `GuidedTour`, `TourPanel`, `TourSpotlight`, `useTourStep`, `placeTourPanel`, `formatTourText`, `tourCommonCopy`, `isSampleRecordId`, `acquireTour` | GT-01 | GT-03 onward |
| Invitation states, `getTourPresentation`, `completedVersion`, `daily-sheet` TourId | GT-02 | GT-03 onward; GT-12 |
| Data-safety contract test (`__tests__/tour-data-safety-contract.test.ts`, proposed) | GT-02 | Every feature task adds its files |
| Reserved-column dialog CSS for sample dialogs (DR-15) | GT-03 (costing dialogs); pattern reused | GT-05..GT-15 |
| Replica workspace shell + handoff (EC-18) | GT-07 | GT-08, GT-09, GT-10, GT-11, GT-12 |
| `production.assignLooms` key | GT-11 | GT-13, GT-15 |
| `qualityStock.audit` key | GT-08 | GT-09 |
| Harness scenarios | GT-00 (copy), each task (adds its own) | every task, GT-17 |
