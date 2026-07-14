# UX-012 — Traceable Requirement Amendment

Amendment date: 2026-07-14 IST
Approved by: Product owner (approval supplied in the 2026-07-14 UX-012 implementation instruction)
Original requirement owner: product owner
Affected criterion: `UX-012` in `docs/PRE_PILOT_COMPREHENSIVE_TESTING_GUIDE.md`

## Original criterion

> Factory terminology review with brother/supervisor.

Expected: labels match actual language for loom, shift meters, quality/run, godown, party, challan, Upaad/Kharchi, and hisaab.

The prior closeout procedure interpreted this as a named factory-supervisor approval required before pilot. No such approval has occurred, and this amendment must never be represented as factory-supervisor approval.

## Approved amendment

For the limited pilot, substitute-review approval before pilot is replaced by a product-owner-approved reconciled terminology baseline plus a controlled validation action with the actual pilot factory user.

Pre-pilot acceptance requires:

1. the reconciled terminology baseline is approved by the product owner;
2. wording is consistent across UI, validation, locales, PDFs, exports, messaging outputs, documentation, and help;
3. high-risk business concepts remain explicitly distinct;
4. production deployment and regression validation pass;
5. no known ambiguity can cause production, stock, payroll, dispatch, or financial errors.

Pilot validation control requires:

1. dated, contextual feedback from the actual pilot factory user;
2. reviewer name and role;
3. each confusing or rejected term;
4. implementation of corrections;
5. confirmation after changes; and
6. the action remains open until every item is complete.

## Rationale

The actual pilot user supplies more representative comprehension evidence than a substitute pre-pilot reviewer. The change moves factory-user comprehension validation into a controlled pilot action; it does not remove it. Product-owner baseline approval, implementation consistency, production proof, and ambiguity risk review remain mandatory before the limited pilot.

## Approval boundary

- Product-owner approval authorizes this amendment and the limited-pilot baseline only.
- It is not and must not be described as factory-supervisor approval.
- UX-012 can pass the amended pre-pilot criterion only after implementation, deployment, regression evidence, and ambiguity review pass.
- The pilot-user validation control remains open even if the amended pre-pilot row passes.
