# Sprint 1 — Estimator Simplification Fixes

**Surface:** Cost Estimate  
**Route:** /owner/estimator  
**Priority:** P0  
**Status:** Proposed

> Scope note (29 August 2026): this earlier estimator-only plan predates the owner-only [Base Production Core](../base-production-core-scope.md). Its exclusions still apply to dashboards, CRM, bulk import, and Full Suite operational workflows; the small costing-linked production loop is now an approved follow-on surface.

## Outcome

Make the estimator feel like one short costing workflow for the common case while keeping the complete textile calculation available when the owner needs to inspect or change assumptions.

## Persona job

“A trader has asked for a price on a familiar quality. Help me produce a current, defensible per-metre price without re-entering the recipe or losing the basis of the answer.”

## Observed friction

The Base estimator currently presents several competing layers before the owner reaches the input form:

- Quick/Detailed controls;
- blank result cards;
- a costing-not-ready alert;
- pricing assumptions and warning text;
- explanatory save/version copy;
- three equal-looking actions;
- a saved-quality library;
- a Quick Costing block with a separate Detailed view action;
- the full technical input stack below.

The issue is not that the fields are invalid. The issue is that the page asks the owner to understand too many product concepts before completing the first costing.

## Design decision

Keep one estimator and one calculation engine. Remove the mode decision as a product concept. The default view is a compact outcome-led workflow; advanced assumptions remain accessible through disclosures.

## Target flow

**Use saved quality or start new → review current rates → enter only missing essentials → see result and drivers → save costing → export if needed**

## Work items

### ES-01 — Make reuse the primary entry point

- Lead with a searchable “Use a saved quality” picker when saved qualities exist.
- Show the quality name, last saved cost, last updated date, and rate-review status.
- Provide one clear action: **Use current rates**.
- Keep **Start new quality** as the secondary path.
- Do not create a customer database or CRM.

### ES-02 — Flatten Quick/Detailed into one progressive form

- Remove the implication that Quick and Detailed are separate calculation paths.
- Keep a compact default view with the minimum fields needed for a credible first result.
- Move crimp, waste, PPI, finished width, weaving, sizing, overhead, commission, transport, GST, and other expert inputs into labelled Advanced assumptions sections.
- Preserve sensible factory defaults and existing field-level explanations.
- Keep the full calculation inspectable for owners who need to audit the result.

### ES-03 — Create one costing-status model

Replace the stack of banners and warning summaries with one status area:

- **Ready** — result is valid and can be saved.
- **Needs input** — show the number of blocking fields and link to them.
- **Review suggested** — optional quantity, stale rate, or unusual assumption.
- **Saved locally** — draft exists on the device but is not yet in the factory account.
- **Saved to factory** — snapshot is persisted.

Blocking errors must not be mixed with optional review suggestions. Quantity must not appear as a blocking warning when it is optional for the Base per-metre price.

### ES-04 — Establish a clear action hierarchy

- Primary action: **Save Costing**.
- Secondary action: **Export** with Internal Cost Sheet and Customer-safe Quotation choices.
- Tertiary action: **Save as New Quality**, available in a secondary menu or contextual empty state.
- After saving, show version, timestamp, rate basis, and quantity basis.
- Only offer **Save new version** when the user has made a meaningful change or explicitly chooses it.
- Keep customer quotation as a document artifact, not a CRM status workflow.

### ES-05 — Reduce repeated explanation

- Replace the multi-line save/version instruction block with short inline help or a single “How saving works” disclosure.
- Use factory language first: “current rates,” “saved quality,” “saved costing,” and “new version.”
- Keep technical terms such as warp, weft, PPI, crimp, and waste, but explain them beside the field rather than in a large preamble.

### ES-06 — Preserve interruption safety

- Keep autosave/draft recovery behavior.
- Show a quiet, persistent local-versus-factory save state.
- On return, offer **Restore**, **Rename**, **Discard**, or **Keep for later**.
- Do not let a stale local draft look like a saved financial record.

## Acceptance criteria

- A returning owner can open a saved quality and reach a valid current costing without rebuilding its construction.
- The estimator has one calculation path; compact and advanced views are presentation states only.
- The first viewport answers: what quality is being costed, whether the result is ready, and what the next action is.
- Production cost, suggested selling price, break-even price, actual margin, and expected profit remain available once the estimate is valid.
- Missing required inputs are consolidated into one actionable status.
- Optional quantity and review reminders do not block a valid per-metre estimate.
- Saving a new version shows the rate/date/quantity basis and does not mutate older snapshots.
- Internal and customer-safe exports remain visibly separate and privacy-safe.
- No Full Suite action appears in the Base estimator.
- No critical action is clipped or hidden at 320–480px widths.

## Verification scenarios

1. New owner enters a first quality from the compact path.
2. Returning owner opens a saved quality after a supplier rate change.
3. Owner reviews a stale rate before saving.
4. Owner leaves quantity blank and verifies that per-metre pricing remains valid.
5. Owner enters an invalid required field and receives one clear recovery path.
6. Owner changes an advanced assumption and saves a new version.
7. Owner exports an internal sheet and a customer-safe quotation.
8. Browser closes during editing; local draft is restored and clearly labelled.
9. Hindi and Gujarati labels retain the same required/optional meaning.

## Non-goals

- Removing required textile inputs.
- Replacing the authoritative calculation engine.
- Adding trend dashboards, CRM, bulk spreadsheet import, production, stock, dispatch, or payroll.
- Recalculating old snapshots against current defaults.

## Dependencies

- Sprint 2 provides rate-review state and current-versus-historical rate context.
- Sprint 3 provides the authoritative saved-quality and version-history interaction.
- Existing export/privacy behavior remains the source of truth for documents.
