# Live cost readiness fix — 4 October 2026

## Diagnosis

Free intentionally calculates only after a metered Calculate & save request. Before that request, the shared page used an empty result for its display totals and passed that result into the same readiness check used by paid live calculations. Complete inputs therefore produced a false zero-production-cost error. The assumptions panel and weft waste summary also read that empty snapshot, disagreeing with the entered values.

## Changes

- Added an explicit calculation-required readiness state: input errors and unusual-value review remain active, but an uncalculated Free draft does not undergo result validation or expose prices.
- Added a visible Calculate & save action beneath the complete-input status, in both Quick and Detailed views.
- Removed placeholder pricing assumptions before the first Free result. Entered direct overhead and row waste feedback reflect the form; uncalculated warp consumption displays a dash.
- Saved Free results and assumptions stay fixed after edits, with the existing changed-input warning and metered rerun.
- Lite and Base retain their current-input live calculation and full result validation. Server validation and quota handling are unchanged.
- Added English, Gujarati, and Hindi readiness copy.

## Verified

- Full Vitest suite: 279 files passed; 2,480 tests passed, 1 skipped.
- TypeScript: `tsc --noEmit` passed.
- ESLint: `npm run lint` passed with no errors or warnings.
- `git diff --check` passed.
- Commands ran through `scripts/performance/isolated-command.mjs`.

Browser checks used the real EstimatorClient in the repository's isolated Vite harness, with local synthetic API responses. These are UI-flow checks, not a production deployment or a live database/save verification.

| Scenario | Observed result |
| --- | --- |
| Free, complete inputs, Quick and Detailed | Ready to calculate; no false zero-cost error, no pricing assumptions, zero calculate requests before clicking |
| Free, Detailed waste summary | Blank row waste correctly shows the entered 10% default |
| Free, first explicit save | One synthetic request; allowance 2 → 1; cost ₹33.22/m, suggested price ₹36.91/m, overhead ₹12/m, margin 10%, quantity 1,000m |
| Free, change margin to 20% | Last saved result remains ₹36.91/m and 10%; no new request |
| Free, explicit rerun | Second synthetic request; allowance 1 → 0; new price ₹41.53/m and 20% margin |
| Lite, initial complete inputs | Immediate ₹33.22/m cost and ₹36.91/m suggested price, no save required |
| Lite, change margin to 20% | Immediate ₹41.53/m suggested price |
| Base, restore draft and change margin to 10%, Detailed view | Immediate ₹33.22/m cost and ₹36.91/m suggested price |

The numeric fixture uses warp 75D / 6,400 ends / ₹112 per kg; weft 110D / 60 picks / 64 inches / ₹124 per kg; 0% crimp; 10% default waste on both rows; 13.75 paise per pick (₹8.25/m); ₹12/m overhead; 10% margin; 1,000m quantity.

Evidence screenshots: `free-ready.png`, `free-calculated.png`, `free-changed.png`, `lite-live.png`, `base-live.png`. Browser reported no runtime errors or framework error overlay. No real accounts, saved costings, or monthly allowances were modified. Production has not been deployed.
