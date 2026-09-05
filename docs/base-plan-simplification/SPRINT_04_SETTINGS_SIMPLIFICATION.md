# Sprint 4 — Settings Simplification Fixes

**Surface:** Settings  
**Route:** /owner/settings  
**Priority:** P1  
**Status:** Proposed

## Outcome

Make Settings answer the owner’s real question: “What affects my next costing?” Keep low-frequency account and data controls available without letting them compete with costing setup.

## Existing direction

The focused Base presentation already leads with Cost Estimate Setup, core defaults, optional charges, business identity, and Account & data. This sprint formalizes that direction and verifies that Full Suite administration does not leak back into Base.

See [Base Plan Settings refinement](../base-settings-refinement.md) for the existing section-by-section decisions.

## Persona jobs

- Set defaults for future cost estimates.
- Keep the business name correct on exported documents.
- Occasionally export data or manage account access.

## Design decision

Settings should have three layers:

1. **Cost Estimate Setup** — visible and task-oriented.
2. **Business identity** — visible but concise.
3. **Account & data** — collapsed/low-frequency.

## Work items

### ST-01 — Keep core costing setup prominent

- Show monthly output/expense basis, warping, sizing, overhead, and target margin in the core setup.
- Explain that defaults apply to new estimates only.
- Keep save status visible and plain.

### ST-02 — Hide optional complexity until needed

- Put capacity reference, processing, finishing, commission, transport, and review cadence behind matching disclosures.
- Open a disclosure automatically only when a warning requires it.
- Do not show inactive optional sections as a long form.

### ST-03 — Remove Full Suite administration from Base

Base should not expose:

- supervisors and access codes;
- production mode;
- WhatsApp factory briefs;
- production/payroll audit controls;
- Full Suite workflow configuration.

If an entitled Full Suite owner is intentionally viewing Base, workspace switching may remain under an advanced area, but it must not dominate normal Base settings.

### ST-04 — Keep identity and data control understandable

- Keep Business name near document-related setup.
- Put read-only owner profile, export, export history, password reset, and deletion under Account & data.
- Keep permanent deletion isolated and visibly destructive.

### ST-05 — Clarify saved qualities

- Show active saved qualities by default.
- Link to Saved Costings for rename, version, rate, archive, and restore management.
- Keep archived qualities out of the normal setup view.

## Acceptance criteria

- A new Base owner can configure core costing defaults without opening an advanced area.
- A returning owner sees a concise summary instead of a wall of settings.
- Saved costings remain unchanged after default changes.
- Optional sections show only when relevant.
- Base does not expose supervisor, Full Suite production-floor, WhatsApp, or audit controls. The separate owner-only Base Production Core is reached from its own `/owner/production` route and is not configured from Settings.
- Business name changes have clear document scope.
- Export and deletion remain reachable but do not compete with setup.
- Workspace and subscription concepts are not presented as the same setting.

## Verification scenarios

1. New Base owner completes core setup.
2. Returning owner opens Settings after setup and sees a summary.
3. Owner enables an optional commission or transport assumption.
4. Owner changes defaults and confirms an old costing is unchanged.
5. Owner opens Account & data and exports organization data.
6. Owner verifies destructive deletion remains isolated.
7. Base route inspection confirms no Full Suite administration is visible.

## Non-goals

- Changing costing persistence or validation.
- Moving the dedicated data-export page into Settings.
- Redesigning Full Suite settings.
- Adding a separate organization administration console to Base.
