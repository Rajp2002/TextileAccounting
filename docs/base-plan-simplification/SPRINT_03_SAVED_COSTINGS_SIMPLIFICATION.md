# Sprint 3 — Saved Costings Simplification Fixes

**Surface:** Saved Costings  
**Route:** /owner/quotes  
**Priority:** P1  
**Status:** Proposed

## Outcome

Make Saved Costings the calm, authoritative library for fabric qualities and their costing history.

## Persona job

“Find the quality I used before, see the latest defensible cost, and understand what changed without accidentally overwriting the old answer.”

## Observed friction

The Base page is already substantially cleaner than the Full Suite quotation list, but it still exposes search, sort, margin filter, favourites, archive, compare guidance, quality cards, snapshot counts, and detail actions at once. The page also uses both quality and costing concepts without always making their relationship explicit.

## Design decision

Use one mental model:

**Fabric quality = reusable construction**  
**Saved costing = immutable version of that quality under particular assumptions**

The list is for finding a quality. The detail view is for history, comparison, reuse, and archive actions.

## Work items

### SC-01 — Make the quality list the default

- Show quality name, latest available cost, last updated date, and number of snapshots.
- Keep older/invalid historical values understandable without making them the dominant visual state.
- Use readable truncation and a detail view for long quality names.

### SC-02 — Move secondary controls behind one filter action

- Keep search visible.
- Combine sort and margin filter into a single Filter/Sort control.
- Move Favourites and Archived into secondary list filters or a More menu.
- Keep comparison guidance inside comparison mode rather than above every list.

### SC-03 — Replace system language with the owner action

- Use **Use as Starting Point** instead of Duplicate for the Base reuse action.
- Use **New version** only when the owner intends to preserve a changed economic answer.
- Keep quality name unchanged unless the owner explicitly renames it.

### SC-04 — Put comparison inside quality history

- Open a quality to see its versions in chronological order.
- Show latest cost, previous cost, and a short New minus Old movement.
- Keep detailed comparison for rate, consumption, overhead, margin, and quantity on demand.
- Do not require global two-record selection for the common comparison.

### SC-05 — Consolidate archive and favourite actions

- Put archive, restore, and favourite in the record overflow menu.
- Keep archived qualities out of the default list.
- Preserve restore and exportability.

### SC-06 — Preserve document safety

- Keep internal and customer-safe export choices clearly separate.
- Keep the saved snapshot as the source of exported values.
- Do not add sent-status, receivable, party ledger, or CRM behavior to Base.

## Acceptance criteria

- Owner can find a known quality with search and open its history without learning snapshot terminology.
- The default card has one clear next action.
- Comparison explains direction and changed inputs.
- “Use as Starting Point” does not mutate the original quality or append confusing copy to its name.
- Archive/restore remains available but does not compete with daily reuse.
- Historical rates and costs remain immutable.
- Customer-safe export contains no internal economics.
- Empty, no-match, and archived states each suggest the next useful action.

## Verification scenarios

1. Search for a known quality with a long name.
2. Open a quality with one snapshot and with five snapshots.
3. Compare a rate-change version and explain the movement.
4. Use a saved quality as a starting point.
5. Archive and restore a quality.
6. Export internal and customer-safe documents from the same snapshot.
7. Confirm no old snapshot changes after a Rate Book update.

## Non-goals

- Customer management or quotation CRM.
- Trend dashboards unrelated to same-quality version comparison.
- Global operational dashboards.
- Changing the calculation engine or version persistence model.

## Dependencies

- Sprint 1 establishes estimator reuse and save semantics.
- Sprint 2 supplies rate basis and review context.

