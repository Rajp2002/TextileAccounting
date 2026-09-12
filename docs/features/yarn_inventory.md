# Yarn inventory until fabric dispatch

Implemented locally on September 12, 2026. No production migration or deployment was performed.

Owners with production access open **Stock → Yarn**, separate from fabric stock. The balance is the total yarn still owned: unused yarn plus yarn in fabric that has not left on a confirmed dispatch. Production, machine allocation, draft challans, printing, customer receipt differences and payments do not reduce it.

For example, if D.245 uses 12 kg of Warp Yarn 1 per 100 m, recording 100 kg gives a 100 kg balance. Weaving fabric leaves that balance at 100 kg. Confirming a 100 m dispatch deducts 12 kg, leaving 88 kg. Each weft and additional warp yarn is accounted for independently. The same normalized yarn name shares a single balance even when used in both warp and weft or in several qualities; use distinct names for distinct yarn specifications.

## Entry and costing setup

- **Opening weight** adds the verified yarn owned before tracking, including yarn inside undispatched fabric, once per yarn. Exclude quantities already entered as receipts and yarn attributable to historical pending legacy dispatches.
- **Add yarn** records newly received kg with a reason or receipt reference. Entry precision is 0.001 kg.
- **Correct balance** sets a reviewed total, preserving the difference, reason, actor and time. Concurrent or stale corrections fail rather than overwrite a newer balance.
- **Link costing** chooses an active saved costing for the matching fabric quality and copies the canonical `costing_result_snapshot.audit.warp/weft.layers[].finalKgPer100m`, including the costing's allowances. There is no second implementation of the textile formula. Legacy costings without a complete named weight audit must be saved as a fresh costing version first.

The link is a fixed formula for that quality's future dispatches. It does not change automatically when costings are created or archived. Relinking requires a reason and expected version; previous and new recipes remain in the request audit. Choose the formula that describes the remaining fabric. The existing stock model aggregates a quality by name, so it does not distinguish construction versions inside one quality balance; different constructions should have different quality identities. This feature reports combined yarn still owned, not a measured split between loose yarn and yarn physically woven into fabric.

The first opening/receipt/correction starts tracking for the organization. Before its next dispatch, the owner must link that fabric's costing and record every required yarn balance. Organizations that have not started yarn tracking retain the existing fabric-only dispatch flow. A linked recipe alone does not start tracking.

## Dispatch integrity

`private.move_dispatch_yarn_stock` handles new `quality_stock_movements` from standalone delivery challans. It shares the existing organization `:quality-stock` transaction lock. Each yarn deduction is `sent metres × linked kg per 100m ÷ 100`, rounded only at the ledger boundary to nine decimal places. Same-name layers are summed before rounding. Missing formulas, missing yarns or insufficient yarn roll back fabric, yarn and challan confirmation together.

The existing challan request/version checks prevent retries from creating another fabric movement; each yarn movement is additionally unique per fabric movement and yarn. An allowed physical dispatch reversal restores the exact original kg and recipe snapshot, even after a later costing is linked. Historical pre-tracking dispatches have no yarn debit to reverse. Receipt acknowledgements and accepted shortages change chargeable metres only.

Tables have owner-scoped RLS and explicit read grants. Only owner-authorized, writable-organization RPCs and private stock triggers can write. Revoked owners, supervisors and owners without production access cannot mutate yarn inventory. All five tables are included in the tenant account export. Unconfirmed browser mutations retain their immutable tenant-scoped request in session storage for recovery after reload.

## Audit and history

The screen shows per-yarn and combined kg, paginated history and frozen dispatch weights. A selected audit date sums every ledger entry recorded through that day using Asia/Kolkata midnight, independently of the history page/filter. Blank shows current stock. The CSV includes every yarn balance, total, selected date and tracking start. Names are escaped against CSV spreadsheet formulas. Dates before tracking began do not reconstruct historical stock. Receipts/corrections are recorded now, not backdated.

Legacy yarn lots, operational issue records and beam history are preserved and are not imported into this balance. The older Inventory Yarn tab links to this screen; existing beam functionality stays available. Legacy dispatches continue their prior accounting and do not debit the new yarn ledger.

## Release and verification

Apply `20260912131633_yarn_stock_until_dispatch.sql` transactionally after the quality-stock and standalone-challan migrations and before releasing this UI. Back up first. The migration is additive and does not fabricate opening quantities or retroactive consumption. After stock writes exist, retain the ledger and forward-fix; do not drop it to roll back.

Verified locally:

- Full unit suite: **1,747 passed, 1 skipped**.
- PostgreSQL 17.11: **47 scenarios passed**, including all 32 existing stock/challan scenarios and 15 yarn scenarios. Covers actual reviewed production saves, dispatch/retry/reversal, costing versions, receipt/payment neutrality, shared warp/weft names, fractional metres, concurrency/rollback, RLS/access, date boundaries and history beyond 50 entries.
- TypeScript, lint on changed files and the production build passed. Local Supabase security advisors reported no issues.
- Full repository lint still reports 49 errors and 49 warnings in unrelated files (including existing effect-state handling in `QualityStockClient.tsx` and `ChallansClient.tsx`). These are outside the yarn change; the changed files pass their lint checks.
- In-app browser: opening 100.125 kg, receipt 20.375 kg, resulting 120.5 kg; saved-costing preview/link; March 31 audit and downloaded CSV; Hindi and Gujarati labels; 390px Gujarati layout without horizontal overflow; no browser console errors. The harness uses real production components and SQL with disposable fixture authentication, so it does not verify hosted Supabase Auth/PostgREST.

Run database verification with:

```sh
YARN_TEST=1 STOCK_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:PORT/postgres node scripts/qa/quality-stock-db.mjs
```

The script refuses remote hosts and creates its own disposable database. It replays 277 historical migrations, skipping four unrelated WhatsApp schedules requiring external extensions. Set `STOCK_TEST_KEEP=1` to retain it for the browser harness, then run `scripts/qa/yarn-browser/server.mjs` with `STOCK_TEST_DATABASE_URL` set to that printed database. The harness accepts only a retained disposable database on loopback and listens at `http://127.0.0.1:4181`.
