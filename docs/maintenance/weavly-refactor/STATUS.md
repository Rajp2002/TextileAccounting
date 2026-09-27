# Weavly refactor program — status

Updated 2026-09-27. **Phase 3 in progress.**
- **2B and OS-13 are committed and pushed with this change**, together with the CI change to the full lint gate.
- **Lint is fully green.**
- **2C:** committed and pushed.
- **2D:** committed and pushed. CI passed.
- **Phase 3:** the inventory is done (68 unreachable source files, E28).
- **Batch 3A:** committed and pushed (`c36eb72d`, `6ba75687`). CI passed.
- **Batch 3C:** committed and pushed (`7b03576d`, `16481b76`, E29). CI passed.
- **Batch 3B:** committed and pushed (`4de225d0`, `57bd9b0c`, E30). CI and the Vercel production build passed.
- **Batch 3F:** approved, committed and pushed with this change (`1259c566`, E31). It removes the dead factory-workflow server paths and leaves 3 refusal stubs until 3G.
- Details: EVIDENCE E24–E31.

## Next session

1. **Batch 3G** (approved 2026-09-27; analysis in progress): the hidden UI behind `canUseProduction = false` in the Estimator and Quotations screens. That covers market-run mode, the party-order and order-conversion controls and dialog, the `saveMarket` tour step and its strings, the 3 stubs from 3F, and the dead quotation sub-paths in `saveEstimatorQuoteV3`. It needs an old-vs-new browser check.
2. **Then, per the approved order:**
   - 3D: offline sync;
   - 3E: auth, billing and compliance orphans, reviewed file by file with the owner.
3. **Open follow-ups:**
   - live-settings test coverage (E29);
   - P2-O1…O5;
   - OS-5, AS-05, OS-12, CS-2, CS-1;
   - `custom_access_token_hook` grants;
   - leaked-password protection.
4. **Phase 5 note:** CLAUDE.md's "Baseline" section still describes lint as red. It is now clean, and CI runs `npm run lint`. (3B already corrected the stack and primitives lines.)
5. **Local note:** the main checkout was fast-forwarded to `57bd9b0c` and reinstalled with `npm ci` (2026-09-27).
6. **Phase 5 docs:** `TECHNICAL_ANALYSIS.md` and `USER_WORKFLOWS.md` still describe the retired party-order, conversion and market-run flows.

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
- **Batch 3G:** added and approved by the owner (2026-09-27). It runs after 3F and before 3D.
- **Batch order approved:** 3C → 3B → 3F → 3G → 3D → 3E. Each batch still lands only after its own approval.
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

## Gate results (3F)

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
