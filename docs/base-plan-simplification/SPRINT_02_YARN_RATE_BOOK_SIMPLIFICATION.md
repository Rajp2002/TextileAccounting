# Sprint 2 — Yarn Rate Book Simplification Fixes

**Surface:** Yarn Rate Book  
**Route:** /owner/rates  
**Priority:** P0  
**Status:** Proposed

## Outcome

Turn the Rate Book from a wide administrative table into a small review queue that answers one question quickly: “Which current yarn rates need my decision?”

## Persona job

“A supplier changed a rate on WhatsApp. Help me update the current assumption, understand what it affects, and keep old costings unchanged.”

## Observed friction

The current page combines:

- an Archive and restore banner;
- an Archived rates action;
- active-rate and due-for-review metrics;
- Warp/Weft tabs;
- a seven-column table;
- linked-record context;
- review, change, activity, and archive actions on each row.

The information is valuable, but the default view makes every rate look equally administrative. Mahesh usually needs the due queue or one known yarn, not the full audit model.

## Design decision

Make review status the primary organizing principle. Keep the full history and linked context, but move them into a focused rate detail view.

## Target flow

**Open Rate Book → see rates needing review → choose one rate → confirm or change current value → understand future-only impact**

## Work items

### RB-01 — Default to a review queue

- Lead with **Needs review** when due or overdue rates exist.
- Show a clear count and review date.
- Keep **All current rates** as the secondary view.
- Preserve Warp and Weft filtering without making the owner scan both directions by default.
- Link from the estimator when a costing uses a rate that needs review.

### RB-02 — Reduce the default row

Show only:

- yarn name and direction;
- current rate;
- effective/last-reviewed date;
- review status;
- one primary action: **Review rate**.

Move previous rate, source, linked qualities, activity, and archive into the detail view or overflow menu.

### RB-03 — Make the review decision explicit

The detail view should support:

- **Confirm current rate**;
- **Change rate**;
- source/note entry;
- review interval/date;
- linked saved qualities or costings;
- append-only history.

The owner should understand whether they are confirming an existing value or creating a new current value.

### RB-04 — Consolidate archive behavior

- Remove the duplicate archive entry points from the default experience.
- Keep one clear **Archived rates** destination or filter.
- Keep restore available inside the archived record view.
- Do not mix archived records into the normal review queue.

### RB-05 — Explain impact without overloading the table

After a rate change, show a concise message:

“This changes future costings using the current rate. Saved costings remain unchanged.”

Link to the affected saved qualities only when the owner asks to inspect them. Do not turn the Rate Book into a dependency graph.

### RB-06 — Preserve trust invariants

- Current rate changes affect future estimates only.
- Historical costing snapshots retain the original rate basis.
- Rate history records value, source, effective date, review date, and notes.
- Missing or stale rates are never silently treated as zero.

## Acceptance criteria

- A due or overdue rate is identifiable without reading the full table.
- Each default row has one obvious primary decision.
- Activity, previous values, linked records, and archive remain available but do not compete with review.
- There is one normal archive path and one restore path.
- After changing a rate, the UI clearly distinguishes future estimates from old snapshots.
- The estimator can link back to the relevant rate review without exposing unrelated Rate Book administration.
- Warp/Weft terminology remains clear in English, Hindi, and Gujarati.
- The queue and detail view remain usable on mobile widths.

## Verification scenarios

1. Six due rates appear as a review queue.
2. Owner confirms an existing discovered rate.
3. Owner changes a supplier rate and adds a source note.
4. A saved costing created before the change still shows the old rate.
5. A new costing uses the changed current rate.
6. Owner opens linked saved qualities from a detail view.
7. Owner archives and restores a rate without losing history.
8. Empty state shows “All rates are up to date” rather than a blank table.

## Non-goals

- Supplier database or supplier CRM.
- Automatic rate extraction from WhatsApp.
- Bulk spreadsheet import.
- Rewriting old costing snapshots.
- Adding purchasing, inventory, or production workflows to Base.

## Dependencies

- Sprint 1 consumes rate-review status and future-versus-historical messaging.
- Sprint 3 provides the saved-quality/version surface for affected records.

