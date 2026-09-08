# Production-to-stock replacement verification

Implementation completed locally on September 8, 2026. No production deployment, remote migration, merge or live data mutation was performed.

## Delivered

- Fresh metre-only quality stock with automatic Base and Full Suite production integration.
- Atomic correction/reversal, job-quality reclassification, exact decimal reconciliation, owner-reviewed balance corrections and request-safe retries.
- Owner-only stock reads/adjustments, tenant isolation, revoked-user/plan/lockdown protection, read-only service access for tenant-scoped exports.
- Quality balances, opening-stock status, history filtering and pagination, loading/empty/error/retry states, Base navigation and English/Hindi/Gujarati UI.
- Deleted old stock boards/actions/helpers/schemas and new stock-sale/optional-dispatch entry. Historical records and pending-dispatch/receipt/payment paths remain available.

## Checks

| Check | Result |
|---|---|
| Unit/regression suite | 215 files passed; 1,422 tests passed; 1 existing skip |
| TypeScript | Passed |
| Changed-file lint | Passed, zero warnings |
| Repository-wide lint | Blocked by 2 errors and 9 warnings in unchanged estimator/rate-book files |
| Production build | Passed with non-production placeholder configuration |
| PostgreSQL integration | 16 scenarios passed on local PostgreSQL 18.4 |
| Historical migration replay | 277 migrations replayed; 4 external WhatsApp schedules excluded |
| Browser | Real stock component and actual local SQL, desktop/mobile, English/Hindi/Gujarati |
| Diff whitespace | Passed |

Repository-wide lint findings are in `EstimatorClient.tsx`, `RatesClient.tsx`, `CostEstimateTutorial.tsx`, `RateBookTutorial.tsx` and `estimator-yarn-suggestions.ts`; all five files were verified byte-for-byte unchanged from HEAD. The full log was captured before the unused import introduced by retiring a legacy test was fixed; it includes that now-resolved warning. Changed-file lint was then rerun successfully. A later full run was interrupted when an obsolete QA probe was deleted while ESLint was reading it; no application files were changed by that deletion. See [full lint output](repository-lint.txt) and [changed-file lint](changed-files-lint.txt).

The PostgreSQL suite tests the real reviewed-production save RPC; retries with the same and changed payload; opening stock once; no temporary stock reduction during sheet replacement; production zero/reversal; historical baseline correction and rollback; two-session production and correction races; job quality changes; cross-tenant/supervisor/direct-write rejection; locked/revoked/Lite/missing-claim rejection; legacy write retirement; Full Suite supervisor save, owner correction, fractional precision and deletion; fulfillment of a pre-cutover pending dispatch including package creation; and >50-row keyset history without gaps.

Browser checks saved 123.45m of opening stock, corrected it to 120m and observed the −3.45m ledger movement, filtered history to its two rows, and verified mobile width without horizontal overflow. An aborted save retained its exact reviewed request and recovered on retry. An aborted refresh displayed a localized error while retaining the known balance and recovered after reconnecting. Hindi and Gujarati labels rendered correctly. No uncaught application JavaScript errors occurred; deliberate request aborts were part of testing.

Browser testing used `scripts/qa/stock-browser/server.mjs`: a loopback-only Vite harness with the actual component, language provider, shared styles and UI components. Only Next navigation/server-action transport is substituted with a local adapter to the same PostgreSQL RPCs. It is not a production auth test or a production route. The new Next route was checked by TypeScript and the production build. The local PostgreSQL runtime is version 18.4; the read-only live schema inspection reported version 17.6.1. A deployed Supabase Auth/route smoke check remains part of release approval, not an action performed here.

## Release notes

Read [Quality stock](../../docs/features/inventory_and_stock.md) before applying the migration. No old quantities are automatically imported: current production is baselined, new stock starts at zero, and the owner records verified remaining pre-cutover stock. Exclude fabric committed to historical pending dispatches. Historical corrections subsequently apply their difference and cannot make stock negative.

Movement source references support both numeric IDs from repository migration history and UUID IDs observed in the live production schema. Historical migration files were not rewritten.

Future standalone dispatch/payment work remains out of scope. Its confirmation must use the documented stock lock and debit sent metres once; receipt differences must not replenish stock.

## Re-run

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` with normal local app environment configuration
- `STOCK_TEST_DATABASE_URL=postgresql://…@127.0.0.1:5432/postgres npm run test:stock-db`
- For browser checks, set `STOCK_TEST_KEEP=1` on the database test, then point `STOCK_TEST_DATABASE_URL` at the printed disposable database and run `node scripts/qa/stock-browser/server.mjs`. Open `http://127.0.0.1:4179`. The harness refuses remote hosts and database names outside the disposable-test naming pattern.

[Database scenario output](database-tests.txt) · [Mobile Gujarati screenshot](mobile-gu.png)
