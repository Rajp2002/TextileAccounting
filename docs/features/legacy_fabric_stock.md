# Legacy fabric stock

Added 2026-10-15 (`20261015120000_legacy_fabric_stock.sql`). Lets a factory start using Fabric stock without counting the fabric already in its godown.

## Two stocks per quality

| | Orange stock | Legacy stock |
|---|---|---|
| What it is | Fabric woven since Weavly tracked production. Workers tag these takas orange. | Untagged fabric from before Weavly. |
| Where it lives | `quality_stock.meters`, unchanged | `legacy_stock` + append-only `legacy_stock_movements` |
| Comes in from | Saved production (unchanged), verified opening stock, corrections, onboarded legacy takas | Nothing new: only the owner's estimate or count |
| Goes out through | Challan lines marked **Orange** | Challan lines marked **Legacy**, and onboarding |
| Can go below zero | Never. A challan that needs more is refused. | Yes, and it is flagged for a count. It is never clamped. |

Legacy stock has one of three bases:

- **Unknown**: no balance is stored (`balance_meters IS NULL`, enforced by a check constraint). The screen says "Legacy: not counted" and the running total sent since it started. It never shows 0 m.
- **Estimated**: a rough figure for what is in the godown now, less what has gone since. Always labelled as an estimate. Reaching zero does not close it.
- **Counted**: a physical count, less what has gone since. A count that differs from Weavly's balance needs a reason, and the gap is kept in the ledger (`expected_meters`, `entered_meters`, `meters_delta`).

An estimate or count always describes what is there now. Counting after an unknown start sets the balance from that date; no opening figure is back-dated.

## Workflows

- **Start**: Stock → a quality → Legacy stock. Choose Not known, Rough estimate or Counted. Marking a challan line Legacy also starts it, as unknown.
- **Dispatch**: each lot row on a challan has an Orange/Legacy switch (Orange by default; a new row keeps the previous row's choice). Confirming takes the Orange metres from orange stock with the existing availability check and the Legacy metres from legacy stock, in one transaction. If orange stock is short, the whole challan is refused and legacy stock is untouched. Reversal (before receipt, with a reason) restores each stock exactly once; the legacy reversal points at the original movement. The printed challan does not show the split.
- **Add tagged takas (onboarding)**: tag old takas orange, then enter their numbers and metres. One transaction moves the total from legacy stock (or adds to the onboarded total while unknown) into orange stock as a `legacy_onboarding` movement. Taka numbers repeated within a batch are refused. A number already onboarded earlier for the quality is a warning that needs a second press, because taka numbers can repeat over the years.
- **Close**: allowed only when a count shows 0 m left (count 0, or count then onboard the rest) and the owner confirms. A closed quality refuses Legacy lines and reversals into legacy stock. **Reopen** needs a reason and a new basis. Nothing is deleted.

The Fabric stock headline becomes **Orange stock** once any legacy stock exists. The whole total reads "Total not known" while any open legacy stock is unknown, "About N m with legacy estimates" while any is estimated, and "Total with legacy: N m" only when every open legacy stock is counted. Negative legacy balances add nothing to the total.

## Integrity rules

- Every legacy write goes through `public.mutate_legacy_stock` or the challan RPC: `SECURITY DEFINER`, `SET search_path = ''` on the new functions, owner role, production access (`private.quality_stock_access`), `assert_org_not_locked`, and the same per-org `:quality-stock` advisory lock as production and dispatch. Owners can only `SELECT` the tables (RLS); service-role `SELECT` serves the account export.
- Request IDs make each action idempotent; a reused ID with different details is refused (`40001`). Estimate, count, close and reopen carry the reviewed `version` and refuse a stale one.
- A partial unique index allows one legacy dispatch and one reversal per challan.
- Existing challans have `legacy_meters = 0` and lines without a source, which means Orange, so their behaviour is unchanged.
- Deploy order fails closed: if the app reaches a database without this migration, saving or confirming a challan with a Legacy line is refused (the older RPC would ignore the source and take the metres from orange stock), and the Legacy stock button is hidden.
- Opening stock and Correct balance still work as before and apply to orange stock. Use opening stock only for old fabric that was counted and tagged orange at the start.

## Not in this release

- No per-taka register, QR codes or tag reprinting. Takas are identified only by the numbers typed on challans and onboarding batches, so Weavly cannot tell that two rows are the same physical taka.
- Only owners can see or change stock; there is no staff role.
- No partial customer returns (not supported for orange stock either).
- The tour does not teach legacy stock yet.

## Verification

`npx vitest run --config vitest.db.config.ts __tests__/db/legacy-stock.dbtest.ts` replays all migrations on a disposable loopback PostgreSQL and checks unknown/estimated/counted starts, retries, mixed challans, the atomic refusal, negative estimates, single-use reversal, untouched existing challans, concurrent confirmation, onboarding, counts with gaps, stale counts, closing, reopening, other-factory and Lite access, and direct table writes. `__tests__/legacy-stock.test.tsx` covers the pure rules, the status line and the source contracts.

Apply the migration before deploying the app: the stock page reads `legacy_stock`, and the challan RPC writes `legacy_meters`.
