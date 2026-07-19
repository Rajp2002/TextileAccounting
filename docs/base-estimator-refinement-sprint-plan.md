# Base Estimator Refinement Sprint Plan

Date: 2026-07-19
Audience: User B — an owner who buys Weavly only for reliable, repeatable textile costing

## Product outcome

Make the Base plan feel like a complete textile costing desk rather than a restricted Full Suite module. A Base owner should be able to configure costing assumptions, create and understand a costing, reuse historical work, compare alternatives, and produce a professional document without entering production, payroll, stock, or dispatch workflows.

## Success measures

- A new Base owner reaches a valid first costing without Full Suite setup.
- Every saved costing can be found, reopened, duplicated, compared, printed, or exported.
- The top of the estimator answers production cost, suggested selling price, break-even price, margin, and expected profit.
- Internal exports expose assumptions and cost detail; customer exports hide internal cost and margin.
- Historical snapshots remain immutable when current defaults or rates change.
- Existing Base/Premium access boundaries and server-authoritative calculations remain intact.

## Sprint 1 — Standalone foundation (completed)

### BE-01 — Base first-run costing setup

- Reuse the existing factory-cost wizard for Base customers.
- Save costing profile, monthly output, overhead items, and factory-capacity assumptions.
- Keep production-only data and actions absent.
- Completion gate: a new Base profile can finish setup and enter the estimator with `isConfigured=true`.

### BE-02 — Decision cockpit

- Rename the commercial output to **Suggested Selling Price** for Base.
- Add break-even price and expected profit to the persistent summary.
- Keep invalid calculations paused and preserve the existing safe-save rules.
- Completion gate: five decision values remain visible and readable at desktop and mobile widths.

### BE-03 — Saved Costings workspace

- Add quality/name search.
- Add sorting by recently updated, oldest, highest margin, and lowest production cost.
- Add margin filters.
- Add row selection and a two-costing comparison dialog.
- Preserve Open & Update, Duplicate, and Delete semantics.
- Completion gate: all discovery and comparison behavior is client-side, deterministic, and does not mutate snapshots.

### BE-04 — Professional outputs

- Add an export dialog from the live estimator and Saved Costings.
- Support an Internal Cost Sheet and a Customer Quotation.
- Internal output includes assumptions, detailed cost stack, break-even, margin, quantity, and timestamp.
- Customer output includes business/customer fields, fabric, quantity, suggested price, validity, and notes while excluding internal cost and margin.
- Support PDF download and browser print.
- Completion gate: export uses the same snapshot/calculation engine as the on-screen costing.

### BE-05 — Verification and release evidence

- Unit-test filtering, sorting, comparison, and export view-model helpers.
- Run TypeScript, focused ESLint, focused tests, full tests, and production build.
- Browser-check desktop and mobile Base workflows.
- Compare final screenshots with the approved concept and record deviations.

## Sprint 2 — Rate memory and version intelligence (completed in this execution)

### BE-06 — Rates & Qualities workspace

- Added a Base navigation destination for yarn, warping, sizing, winding, processing, finishing, transport, commission, and overhead defaults.
- Track current and previous value, source, effective date, review date, review interval, and notes with an append-only history.
- Applying a rate as a default updates future estimator starting values without rewriting historical costings.

### BE-07 — Explicit version history

- Added immutable costing group/version identity for Base edits while preserving Full Suite update behavior.
- Comparison shows production cost, selling price, yarn rate, consumption, process rate, overhead, margin, and quantity changes.
- Added archive/restore and favourite controls to desktop and mobile saved-costing views.

### BE-08 — Stale-rate safety

- Rates are marked current, due soon, or overdue from their configurable review interval.
- Base saves warn when an applied default is overdue, with paths to review rates or deliberately continue.

### Sprint 2 execution evidence

- Database migration applied and policy-checked on the isolated QA Supabase project only; the linked production project was not modified.
- Browser flow verified: seed rates, edit and review history, apply estimator defaults, save v1/v2/v3, compare input changes, favourite, archive/restore, and acknowledge an overdue default.
- Desktop and mobile render evidence is stored in `output/estimator-base-sprint/`.

## Sprint 3 — Buyer-value polish (completed)

### BE-09 — Faster reuse without a second estimator

- Keep one authoritative estimator rather than introducing a Quick/Detailed mode decision.
- Rename the existing Base duplicate workflow to **Use as Starting Point**.
- Show production-cost movement against the previous version of the same costing.

### BE-10 — Quotation convenience without CRM leakage

- Prefill the organization name on exports while keeping it editable.
- Keep customer, validity, notes, and GST wording optional and quotation-scoped.
- Do not add a customer database, ledger, receivable, production-order, or dispatch behavior in Base.

### BE-11 — Explicitly deferred until evidence exists

- No separate costing-trend dashboard or monthly activity summary.
- No spreadsheet import until onboarding evidence shows that manual rate entry is a material barrier.
- Reassess with Base task-completion, reuse, export, and support data after launch.

### Sprint 3 execution evidence

- The buyer-value gate and evidence limits are recorded in `docs/base-estimator-feature-value-analysis.md`.
- A validated portable decision report is stored in `output/estimator-base-product-decision/`.
- Browser flow verified on isolated QA: v1 to changed v2, contextual `₹/m` movement, unchanged quality name through **Use as Starting Point**, and organization-name export prefill.
- Desktop and mobile screenshots are stored in `output/estimator-base-sprint/`; no browser-console errors were observed after reload.

## Non-goals

- Production orders, market runs, machines, supervisors, stock, dispatch, payroll, advances, or factory analytics.
- Recalculating or mutating historical snapshots when defaults change.
- Treating a customer quotation as a GST tax invoice.
- Replacing the authoritative server validation path with client-only calculations.

## Release gates

1. Base navigation exposes only standalone costing surfaces.
2. New Base setup, calculate, save, reopen, duplicate, compare, export, print, offline failure, and reconnect flows pass.
3. PDF and print output never expose internal margin in Customer Quotation mode.
4. No Premium action is reachable from Base estimator controls.
5. Hosted Base payment capture, entitlement activation, replay idempotency, and renewal dates have controlled evidence before accepting paying customers.
