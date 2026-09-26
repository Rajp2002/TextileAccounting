# Weavly refactor program — status

Updated 2026-09-26 (night). **Phase 2 in progress.**
- **2B and OS-13 are committed and pushed with this change**, together with the CI change to the full lint gate.
- **Lint is fully green.**
- **2C:** committed and pushed.
- **2D:** committed and pushed. CI passed.
- **Phase 3:** the inventory is done (68 unreachable source files, E28).
- **Batch 3A:** committed and pushed (`c36eb72d`, `6ba75687`). CI passed.
- **Batch 3C:** approved, committed and pushed with this change (E29).
- **Paused.** The owner deferred batch 3B (session limits).
- Details: EVIDENCE E24–E27.

## Next session

1. **Batch 3B** (deferred by the owner): the 8 unused `components/ui` primitives from the E28 inventory, plus any npm packages they free. Show the package list before changing `package.json` or the lockfile.
2. **Then, per the approved order:**
   - 3F: dead factory-workflow branches in `estimator/actions.ts`, including the market-run payload copy.
   - 3D: offline sync.
   - 3E: auth, billing and compliance orphans, reviewed file by file with the owner.
3. **Open follow-ups:**
   - live-settings test coverage (E29);
   - P2-O1…O5;
   - OS-5, AS-05, OS-12, CS-2, CS-1;
   - `custom_access_token_hook` grants;
   - leaked-password protection.
4. **Phase 5 note:** CLAUDE.md's "Baseline" section still describes lint as red. It is now clean, and CI runs `npm run lint`.

## Decisions recorded (user, 2026-09-26)

- **2B and OS-13:** committed and pushed.
- **CI:** now enforces the full `npm run lint` (owner-approved). The changed-file ratchet script `scripts/ci/lint-changed.mjs` and its test remain but are no longer used by CI (a Phase 3 candidate).
- **2C:** committed and pushed.
- **P2-O6 (party-name spacing):** delegated by the owner to Claude. Decision: **no change**. Inner repeated spaces are rare, and aligning the two paths would change stored party names and exact-match party lookups for a cosmetic gain. Pinned as CHARACTERIZATION.
- **2D:** committed and pushed.
- **Batch 3C:** approved and deleted (2026-09-27).
- **Batch 3B:** deferred by the owner (2026-09-27).
- **Batch 3A:** approved and deleted. `BaseSetupWorkspace.tsx` (rollback adapter) was deleted by owner decision.
- **Batch order approved:** 3C → 3B → 3F → 3D → 3E. Each batch still lands only after its own approval.
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

## Gate results (2D)

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
