# Free costing modal verification

Verified 4 October 2026 (Asia/Kolkata) with the real estimator components in the
isolated Vite harness and synthetic Free API responses. No production account,
allowance, or saved costing was modified. The harness does not reproduce the
production sidebar, root fonts, or authenticated server boundaries.

## Observed behavior

- Initial/complete input preview: section checklist, no price cards or assumptions,
  one calculate action and one explanation of automatic saving and the edit window.
- Missing warp/weft fields: selecting the section closed the modal, scrolled to
  the row, and focused the specific missing denier/width input. Incomplete input
  disables calculation. Optional inactive charges remain complete.
- Ready desktop at 1440×900: 448×420 px, centered; all eight pills complete;
  every pill has a 44 px target. No calculation API call before pressing Calculate.
- Ready mobile at 390×844: content-height bottom sheet, about 489 px tall;
  no horizontal overflow; wrapping labels and calculation action remain visible.
- Explicit calculation made one synthetic API call and reduced the fixture
  allowance from 2 to 1. Reopening Live cost displayed the saved result in the
  wider 532×608 px desktop modal. Production cost ₹32.04/m and suggested price
  ₹35.60/m matched the fixture response; no empty metrics were displayed.
- Result mobile: all metrics and actions fit. Expanding Pricing assumptions
  enabled vertical scrolling; Export and New costing remained reachable.
- Gujarati 360×800 and Hindi 1024×768: translated checklist and footer fit without
  horizontal overflow. Screenshots inspect layout; no independent native-speaker
  review is claimed.
- Paid estimator: no Free checklist/adaptive attribute, existing metrics and
  action hub retained. Existing tour metrics/actions anchors remain available.

## Checks

- TypeScript: passed.
- ESLint: passed, zero warnings.
- Application suite: 283 files, 2,523 tests passed, one live-database test skipped.
- Five new behavior tests cover blank/optional sections, complete inputs,
  additional yarn rows, conditional overhead/processing requirements, and warning
  acknowledgement. The final PR also runs the standard CI checks.

## Screenshots

- `ready-desktop.png`
- `ready-mobile.png`
- `result-desktop.png`
- `result-mobile.png`
- `incomplete-gu-mobile.png`
- `incomplete-hi-tablet.png`
