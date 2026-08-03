# Sprint 15 Code Trust-Gate Evidence — 2026-08-03

## Disposition

Code remediation for the Sprint 15 Base Estimator trust gate is complete. The
authenticated persona retest is still pending, so this document does not mark
the pilot Ready or override the existing NO-GO disposition.

## Implemented controls

- Costing results, quotations, party orders, market runs, and a new quality's
  initial v1 snapshot now require positive loom count, working days, daily
  productivity, and actual monthly output.
- Reusable recipe updates remain separate from costing snapshots and do not
  require capacity inputs when they only change the recipe.
- Invalid capacity blocks money display and persistence even when the
  recoverable calculation engine has produced a positive-looking number.
- Quick mode now exposes an `Open capacity inputs` action from the validation
  alert; it opens Detailed mode at the capacity section.
- The Base estimator shows distinct default, applied-to-pricing, and effective
  weft wastage labels. A row-level `0%` remains an intentional zero override.
- Saved-costing comparison keeps Old → New ordering, states that the change is
  New minus Old, and describes price movement as higher/lower in business
  language.

## Automated evidence

| Check | Result |
|---|---|
| `npx vitest run` | 136 files passed; 871 tests passed; 1 skipped |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |

The regression suite includes each zero-capacity input independently, the
recipe-versus-snapshot boundary, blocked money readiness, the row-level zero
waste override, and the user-facing comparison/waste copy.

## Runtime gate still required

No authenticated browser pass is claimed here. The existing Sprint 14 closure
records that the deployed persona retest was blocked by the available local
route redirecting to login and the QA credentials/browser session not being
usable. A release candidate must still run the grey-fabric truth sheet with
the exact inputs in `RETEST_PLAN.md`, inspect the quotation lifecycle/history,
verify snapshot immutability, and attach sanitized screenshots at the required
viewport widths.

GST invoice behavior and complete Hindi/Gujarati screen coverage remain
separate release gates.
