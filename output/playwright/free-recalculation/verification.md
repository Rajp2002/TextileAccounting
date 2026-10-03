# Free costing: 30-minute recalculation window

Implemented locally on 4 October 2026. No remote database or production deployment was changed.

## Contract

- The first successful Free calculation consumes one monthly costing and saves an entry automatically.
- Until exactly 30 minutes after that entry's original database creation time, explicit recalculation updates the same entry without consuming allowance. The deadline does not move.
- Revisions work with zero monthly costings remaining. Reopening from Saved Costings restores the saved calculation inputs, label, result, revision and original deadline.
- The entry and estimator display a countdown. The Recalculate pill automatically disappears at expiry. Expired revisions fail without silently becoming a metered creation.
- Lite and Base retain their existing estimator behavior. Their retained Free history offers no Free revision controls.
- The server locks the account and saved row, checks ownership, plan, access, deadline and expected revision, and records an idempotent receipt. A stale tab cannot overwrite a newer revision; a retry returns its original saved revision even after expiry.

## Verification

- Full Vitest suite: **279 files, 2,491 tests passed; 1 skipped**.
- Disposable local PostgreSQL, all migrations replayed: **18 tests passed** covering original debit behavior plus no-charge revisions, exhausted allowance, fixed deadline, expiry, idempotent retry after later revisions and expiry, input binding conflicts, token reuse across create/recalculate, stale revisions, foreign ownership, Lite/Base exclusion, locked accounts, direct client denial and atomic rollback.
- TypeScript and ESLint passed.
- Real estimator and Saved Costings React components ran in the existing isolated Vite harness with a synthetic API fixture. This browser check did not contact a real account. The authoritative SQL behavior was tested separately in disposable PostgreSQL.
- Browser: entered the reported fabric inputs, created one entry, observed production cost ₹33.22/m and suggested price ₹36.91/m at 10% margin. Changing margin to 20% and recalculating produced ₹41.53/m, retained the entry ID and monthly balance, and incremented the saved revision.
- Browser: reopened through the Recalculate pill; inputs and weaving rate restored, timer continued. Recalculation at zero allowance succeeded, updated the same entry and displayed “no costing used”.
- Browser: simulated a lost network response. The editor locked while Retry remained usable outside the edit lock; retry resolved to the same saved entry, kept allowance at zero and unlocked the editor.
- Browser: retained Free history in the paid embedded view rendered no revision controls.
- Browser: advanced the fixture clock to the end of the window and observed the Recalculate pill disappear without a page reload, both in the estimator and in Saved Costings. Desktop and 390px mobile layouts were checked; the mobile saved entry had no horizontal overflow.

## Screenshots

- `saved-active.png`: saved entry with countdown and Recalculate pill.
- `saved-mobile.png`: the same controls at 390px.
- `saved-expired.png`: entry after expiry, with the pill removed.
- `reopened-recalculated.png`: same entry recalculated with zero allowance; saved confirmation and countdown.
- `estimator-expired.png`: estimator after expiry.

## Release

Apply `supabase/migrations/20261004093000_free_costing_recalculation_window.sql` before deploying the matching application changes. The migration adds revision metadata and server-only replay receipts; existing entries keep their original creation timestamps.

The earlier `../live-cost/verification.md` describes the initial readiness fix under the previous metering policy. This report supersedes its changed-input recalculation policy.
