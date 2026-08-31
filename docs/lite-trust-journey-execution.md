# Lite trust and journey refinement — implementation increment

Date: 31 August 2026

Branch: `codex/lite-trust-journey-refinement`

Status: Implemented locally; not a production or S-tier sign-off.

## Scope

Preserve the calculation engine, required textile inputs, historical snapshots,
plan entitlements, and separate Saved Costings library. Shared estimator/export
components also serve other plans; their calculation behavior must remain intact.

## Implemented

1. **Document freshness:** a generated PDF is shareable only while its document
   key matches the current preview and filename. Edits invalidate sharing and
   show a regeneration instruction. Generation work is invalidated on changes,
   closing, or unmounting. Late generation cannot download a superseded file.
   Printing also checks that its originating document/session remains current.
2. **Field recovery:** validation paths resolve dot/bracket row indices without
   defaulting to another component. Numeric fields, density, width, component
   names, quality name, and the weaving-rate control have stable identifiers.
   Focus is resolved again after expanding a component; reduced motion is
   respected. Numeric labels and explanatory text are linked to their inputs.
3. **Quality switching:** unfinished edits require a deliberate switch. The
   previous inputs and source-version context can be restored before editing
   or saving the next quality. Rate-dialog application uses the same protection.
   Undo restores working inputs, not a rollback of previously saved Rate Book
   or recipe changes. The checkpoint is in memory, not a multi-draft archive.
4. **Uncertain saves:** the editor is paused while a save is unresolved. A
   persistent panel offers a factory-scoped receipt lookup and retry of the
   exact submitted payload with the same request identity. The payload and
   original concurrency tokens survive draft reload. A definitive rejection
   releases editing; a timeout or network exception does not claim failure.
   Legacy drafts without a captured payload retain their existing recovery path.
5. **Saved-version continuity:** confirmed standalone costings remain in
   context, show their version/date, and can open a customer quotation from the
   submitted snapshot. Subsequent edits retain the saved source version and
   factory-default provenance. Existing quotation/market-run routing remains.
6. **Picker hierarchy:** remove adjacent duplicate picker entry points when
   saved qualities are available; use a searchable grid/list for the standalone
   costing workspace. Rename/archive move into secondary actions; rate review
   remains directly accessible. Full Suite retains its horizontal rail.
7. **Copy:** Quick/Detailed equivalence is visible rather than hover-only. New
   recovery and journey phrases have Hindi/Gujarati dictionary entries.

## Verification

- Existing full regression suite rerun; source-shape assertions updated to
  recognize captured-payload saves without dropping their synchronous-lock,
  explicit-save, and construction-reset checks.
- Added unit coverage for asynchronous document invalidation, exact row targets,
  tenant/request-scoped receipt lookup, persisted retry payloads, mismatched
  request rejection, and non-English recovery phrases.
- TypeScript and targeted ESLint checked.
- Full regression result: **1,124 passed, 0 failed, 1 skipped**. Targeted lint:
  **0 errors, 0 warnings**. Optimized Next.js build: **passed** (an existing
  outdated Browserslist-data warning remains).
- Read-only production schema/query-shape check for receipt columns: passed.
  No customer records or database schema were changed.
- Browser interaction, generated-PDF visual inspection, and real-owner sessions
  have not been performed for this branch. Unit tests are not WCAG certification.

## Remaining work before release / S-tier reassessment

- Run actual browser flows: multi-row errors in both entry modes and three
  languages; dirty quality switch/cancel/undo; save timeout, late commit, reload,
  retry, duplicate-click, cross-tab change, and storage-unavailable behavior.
- Generate/edit/regenerate/share customer PDFs; compare file content to preview;
  test late generation, close/reopen, long content, and Hindi/Gujarati rendering.
- Inspect phone layout, software keyboard, focus visibility, screen-reader
  announcements, zoom, and reduced motion. Review translations with speakers.
- Complete rate-change provenance and before/after cost-impact presentation.
- Finish broader action hierarchy, numeric-entry ergonomics, and export styling
  refinements where observed browser/owner evidence supports them.
- Repair/verify the previously identified performance collector and analytics
  event delivery/classification. This increment does not certify that telemetry.
- Establish a real-owner repeat-quality baseline and compare task completion,
  backtracking, re-entry, result comprehension, and save confidence.

## Rollback / release boundary

Keep this increment isolated on its branch until reviewed. No migration,
deployment, merge to main, or production write is required by these changes.
Production validation must test the eventual deployed commit, not infer it from
the local test results.
