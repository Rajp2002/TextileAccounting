# Weavly refactor program — status

Updated 2026-09-27. **Phase 3 code deletions complete.**
- **2B and OS-13 are committed and pushed with this change**, together with the CI change to the full lint gate.
- **Lint is fully green.**
- **2C:** committed and pushed.
- **2D:** committed and pushed. CI passed.
- **Phase 3:** the inventory is done (68 unreachable source files, E28).
- **Batch 3A:** committed and pushed (`c36eb72d`, `6ba75687`). CI passed.
- **Batch 3C:** committed and pushed (`7b03576d`, `16481b76`, E29). CI passed.
- **Batch 3B:** committed and pushed (`4de225d0`, `57bd9b0c`, E30). CI and the Vercel production build passed.
- **Batch 3F:** committed and pushed (`1259c566`, `0eaca72a`, E31). CI and the Vercel production build passed.
- **Batch 3G:** committed and pushed (`e917f291`, `a12bceb1`, E32). CI and the Vercel production build passed; no runtime errors.
- **Batch 3D:** committed and pushed (`34c0efd7`, `70c6b765`, E33). CI and the Vercel production build passed.
- **Batch 3E:** committed and pushed (`1d085ca3`, `9ca9c0b0`, E34). CI and the Vercel production build passed.
- **Batch 3H:** approved, committed and pushed with this change (`5410386b`, E35). It removes the hidden quotation-lifecycle UI and server paths. The old-vs-new browser comparison was identical in 20/20 scenarios.
- **Export fix:** the no-op "Mark as sent" button was removed (`f934a63b`, E36; owner-approved).
- Details: EVIDENCE E24–E36.

## Next session

1. **Phase 3 close-out:** check `public/` for unused assets (images, icons, fonts) using the deletion protocol. Legacy docs move to Phase 5.
2. **Phase 4** (measured performance and interaction quality): not started. It needs its own plan and approval.
3. **Open follow-ups:**
   - **Schema cleanup candidates (separate approval):** `organizations.access_code_*` and the legacy compliance tables.
   - live-settings test coverage (E29), and the Saved Costings contracts that pass only on commented-out copy (E35);
   - removing the quotation phrases from the `tx()` dictionaries (Phase 5 i18n review, E35);
   - P2-O1…O5;
   - OS-5, AS-05, OS-12, CS-2, CS-1;
   - `custom_access_token_hook` grants;
   - leaked-password protection.
4. **Phase 5 note:** CLAUDE.md's "Baseline" section still describes lint as red. It is now clean, and CI runs `npm run lint`. (3B already corrected the stack and primitives lines.)
5. **Local note:** the main checkout was fast-forwarded to `57bd9b0c` and reinstalled with `npm ci` (2026-09-27).
6. **Phase 5 docs:** `TECHNICAL_ANALYSIS.md` and `USER_WORKFLOWS.md` still describe the retired party-order, conversion and market-run flows.

## Owner to-dos: remind at program close

The owner asked (2026-09-27) to be reminded of these once the refactor is done. Raise them in the final close-out, not in per-batch reports.

1. **Razorpay legacy subscriptions.** Confirm in the Razorpay dashboard that none of the 10 legacy subscription IDs is still live. In production they are all `active` with auto-renew on, but every period has ended and none was renewed. Once confirmed, `/api/subscriptions/auto-renew` can be retired (E34).
2. **Base worker privacy.** Ask a legal adviser whether Base needs a worker privacy notice, consent capture or data erasure. None exists for `base_production_workers`, and `erase_worker_pii_atomic` only covers the retired tables (E34). Nothing is to be built until the owner decides.

## Decisions recorded (user, 2026-09-26)

- **2B and OS-13:** committed and pushed.
- **CI:** now enforces the full `npm run lint` (owner-approved). The changed-file ratchet script `scripts/ci/lint-changed.mjs` and its test remain but are no longer used by CI (a Phase 3 candidate).
- **2C:** committed and pushed.
- **P2-O6 (party-name spacing):** delegated by the owner to Claude. Decision: **no change**. Inner repeated spaces are rare, and aligning the two paths would change stored party names and exact-match party lookups for a cosmetic gain. Pinned as CHARACTERIZATION.
- **2D:** committed and pushed.
- **Batch 3C:** approved and deleted (2026-09-27).
- **Batch 3B:** deferred by the owner (2026-09-27), then approved the same day. The approval covers the 8 files, the 6 packages, and the two `CLAUDE.md` corrections (the `amount` primitive, "react-hook-form + zod"). Committed and pushed.
- **Batch 3A:** approved and deleted. `BaseSetupWorkspace.tsx` (rollback adapter) was deleted by owner decision.
- **Batch 3F:** approved and committed (2026-09-27).
- **Batch 3G:** added and approved by the owner (2026-09-27), then approved to land and committed. Correction: the `saveEstimatorQuoteV3` quotation sub-paths were moved to 3H.
- **Batch 3H:** queued, then approved and committed (2026-09-27).
- **"Mark as sent":** the owner approved removing the no-op button (2026-09-27).
- **Product model (owner, 2026-09-27):** production → inventory → dispatch replaced the order- and market-run-based costings. Quotations, party orders and market runs are retired by design.
- **Batch 3D:** approved and committed (2026-09-27).
- **Batch 3E:** started by the owner, reviewed file by file, all 14 deletions approved (2026-09-27). The Base worker privacy gap is recorded as a follow-up; the auto-renew route is kept pending the Razorpay check.
- **Batch order approved:** 3C → 3B → 3F → 3G → 3D → 3E → 3H. Each batch still lands only after its own approval.
- **Phase 3:** approved by the owner (2026-09-27). Each deletion batch still needs its own approval under the deletion protocol (BRIEF rule 7).
- **CI for 2C** (`7a15df69`): passed.
- **CI with the full lint gate:** passed on `ce4c3ff0`.
- **2A:** committed and pushed (`0a17a722`, `41990fb2`). CI passed.
- **Phase 2:** started by the owner.
- **F3:**
  - Committed and pushed (`7ef4f60c`, `2794f4a0`). CI passed.
  - Migrations applied and verified.
  - Legacy policies dropped.
- **F1 production UI check:** done by the owner.
- **F2:**
  - Committed and pushed.
  - Migration applied.
  - Signing keyring confirmed by the owner.
- **F1:** committed, pushed, applied and verified.
- **Phase 1:** complete.
- **Owner decisions:**
  - CS-1 (multi-weft) is out of scope until the owner verifies the method.
  - AS-02 (Free auto-confirm) is accepted for now.
  - OS-5 and AS-05 scope: the owner is unsure.

## Gate results (3H)

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default `npm test` | 227 files / 1,949 passed / 1 skipped |
| `npm run test:db` | 11 files / 60 passed |
| Old-vs-new browser comparison | 20/20 identical (DOM, calls, navigation, saved drafts) |
| Production build (credential-free copy) | PASS (53/53 static pages) |
| Reachability | 0 unreachable source files |

## Earlier gate results (3E)

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default `npm test` | 227 files / 1,952 passed / 1 skipped |
| `npm run test:db` | 11 files / 60 passed |
| Production build (credential-free copy) | PASS (53/53 static pages) |
| Reachability | 0 unreachable source files |

## Earlier gate results (3D)

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default `npm test` | 227 files / 1,952 passed / 1 skipped |
| `npm run test:db` | 11 files / 60 passed |
| Production build (credential-free copy) | PASS (53/53 static pages) |
| Reachability | 14 unreachable (the 3E set) |

## Earlier gate results (3G)

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default `npm test` | 227 files / 1,952 passed / 1 skipped |
| `npm run test:db` | 11 files / 60 passed |
| Old-vs-new browser comparison | 14/14 scenarios byte-identical (DOM and server-action calls) |
| Production build (credential-free copy) | PASS (53/53 static pages) |

## Earlier gate results (3F)

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default `npm test` | 227 files / 1,952 passed / 1 skipped |
| `npm run test:db` | 12 files / 63 passed (new: retired-factory-workflows) |
| Equivalence | New DB test passes against pre-3F code; fails when the old guard is disabled |
| Production build (credential-free copy) | PASS (53/53 static pages) |

## Earlier gate results (3B)

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default `npm test` | 227 files / 1,952 passed / 1 skipped |
| `npm run test:db` | 11 files / 60 passed |
| Clean `npm ci` (npm 11.19.0), then tsc, vitest and lint | PASS |
| Production build on that install (credential-free copy) | PASS (53/53 static pages) |
| Lockfile accepted by npm 11.6.2 and 11.19.0 (`npm ci --dry-run`) | Yes; each installs exactly 9 fewer packages |

## Earlier gate results (2D)

| Check | Result |
| --- | --- |
| Old-vs-new browser comparison (3 tours, 10 scenarios) | Identical (E27) |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default `npm test` | 235 files / 2,036 passed / 1 skipped |
| `npm run test:db` | 11 files / 60 passed |

## Earlier gate results (2C)

| Check | Result |
| --- | --- |
| Save payload equivalence | Byte-identical across 5 variants and 10 RPC calls (E26) |
| `npm run lint` | exit 0 |
| tsc | PASS |
| Default `npm test` | 234 files / 2,033 passed / 1 skipped |
| `npm run test:db` | 11 files / 60 passed |

## Earlier gate results (2B + OS-13)

| Check | Result |
| --- | --- |
| `eslint --max-warnings=0 .` | **exit 0 (fully green)** |
| tsc | PASS |
| Default `npm test` | 233 files / 2,028 passed / 1 skipped |
| `npm run test:db` | 11 files / 59 passed |
| Old-vs-new browser comparison (disclosure, gutter dock) | Painted behavior identical in every scenario (E24) |
| OS-13 | End-to-end tests pass. Severity corrected to Low: table constraints already blocked the backdating case (E25) |

## Still open

- OS-5, AS-05, OS-12, CS-2.
- CS-1: the owner is verifying.
- P2-O1…O6 observations (E23, E26).
- Direct-write RLS on `base_payroll_cycle_configs` (E25); `custom_access_token_hook` grants (E18); `get_user_role()` is unused.
- Leaked-password protection (Auth setting).
- The optional `actions/*` version bump.
