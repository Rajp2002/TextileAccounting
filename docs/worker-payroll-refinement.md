# Worker payroll refinement: first increment

Branch baseline: `main` at `5c04654775c3562d52dc37dc39aaf69c2bebd83c`.
The Weavly Space [implementation plan](https://chatgpt.com/space/page_b2421647c6088191b33ebb43ba5fbdea) and [pay design](https://chatgpt.com/space/page_ad42cc88e9e481918974421cfbdc192f) define the staged scope.

## Implemented scope

- Existing piece workers retain operator eligibility. Existing fixed support staff stay in payroll and require a signed-in owner approval before operating.
- Operator eligibility covers primary loom operation within the factory. Owner-created dated machine/shift assignments specify the machine scope. The approval date, owner and time are maintained by SQL; fixed approvals take effect from the current Surat business date.
- Job titles describe work for either pay basis. They grant no application permissions. Pay type stays immutable.
- The assignment and machine boards include approved fixed operators. Their shift availability is editable and enforced by SQL.
- Production keeps its metres, jobs and machine attribution. New fixed production snapshots explicitly mark piece earnings inapplicable and store a zero piece earning rate. Shared job wages remain unchanged.
- Existing calendar-day salary history, joining/leaving bounds, settlement, advances and reversal functions remain in use. Salary accrues once per worker period, including support staff without production.
- Ending assignments remains possible. Eligibility or shift changes that conflict with open assignments require ending those assignments first.
- New piece snapshots use an explicit job zero as zero. Only a null job rate uses the existing legacy worker fallback. Existing saved rates and paid rows are not recalculated.

The migration is a file for review and disposable database testing. Applying it to a hosted database is a separate rollout step.

## Rate and costing contract

Base job wages and production rate snapshots are rupees per metre. The estimator retains its existing picks-times-rate commercial convention; its misleading `perPickCostPaisa` identifier does not justify a currency conversion. No pick conversion, source cost breakdown or rounding policy changes here.

Existing production rate columns use two decimal places. The resolver preserves source precision, but end-to-end fractional-paisa persistence needs a separately reviewed precision migration and parity tests. Missing rate resolution is represented in the helper; the current non-null database rate contract and legacy inheritance remain unchanged.

Current salary is already budgeted in `base_salary_derived` overhead. This increment does not claim that mixed staffing cost estimates reconcile. New/revised mixed estimates need the Phase 2 inclusion map and a verified breakdown of the weaving charge. Do not zero a job wage or add salary again as direct labour.

## Verification

Unit cases cover approval, shift/date/employment bounds, normalization, explicit zero, legacy inheritance, unresolved inputs, inapplicability and salary once across multiple production rows.

Disposable PostgreSQL cases exercise the real assignment and reviewed production RPCs, snapshot applicability, shared rates, salary settlement, owner provenance, duplicate requests, shift/date rejection and cross-tenant access. Existing payroll, inventory and costing database suites run alongside them. The CI database job uses an ephemeral loopback cluster and no hosted credentials.

CI results are the execution evidence; this document does not claim checks passed before they run. Browser review and a hosted migration rollout have not been performed.

## Manual incentive increment

Approved manual incentives are implemented in the follow-up branch. See [manual incentive contract](./base-manual-incentives.md) for approval, preview, settlement, export and reversal rules. The remaining stages below remain outside that increment.

## Next increments

1. Explicit, nonoverlapping labour coverage for new/revised estimates.
2. One factory-approved automatic excess-output formula, compared with the manual calculation.
3. Effective-dated pay-type transitions and intrashift handovers as separate extensions.

No incentive formula, attendance deductions, machine-based wage defaults or pay-type transitions are enabled here.
