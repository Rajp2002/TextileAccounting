# Weavly refactor program — status

Updated 2026-09-26 (night). **F2 is complete:**
- Its migration is applied to production (verified).
- It is committed and pushed to `main` with this change.

The fix packages F1 and F2 are done. **No package is in progress.** Details and proofs: EVIDENCE E20 and E21.

## Decisions needed

1. **Owner check, postponed until the owner's session usage resets (remind the owner).** In production:
   - open `/owner/stock/audit`, record a count and finalize;
   - check one challan's History.
2. **Choose the next package.** Candidates:
   - **F3 (small hardening):**
     - capture the three drifted production functions (E18) as migrations;
     - fix the `free_server_time` mutable search_path.
   - **Phase 2 (consistency)** from the program, scoped in a plan first.
   - **Open product decisions** (these need owner input first): OS-5 export scope, AS-05 locked-org scope.

## Decisions recorded (user, 2026-09-26)

- **F2:**
  - Approved, then committed and pushed to `main`.
  - Migration `20260926135315` applied to production and verified.
  - The owner confirmed the production signing keyring (not independently verified by Claude).
- **F1:**
  - Committed and pushed (`eda53bc4` docs, then `e3541dfb` fix; see the E20 commit record). CI passed.
  - Migrations applied and verified.
  - OS-2b auto-draft kept.
  - Backfill skipped (0 affected challans).
- **Earlier:** 1F, 1A, 1B-1 and 1B-2 are done and on `main`, as are the lockfile fix and the privilege check.
- **Owner decisions:**
  - CS-1 (multi-weft) is out of scope until the owner verifies the method.
  - AS-02 (Free auto-confirm) is accepted for now.
  - OS-5 and AS-05 scope: the owner is unsure.

## F2 results

| Check | Result |
| --- | --- |
| `npm run test:db` | PASS: 9 files, 50 tests |
| Pre-fix proofs | AS-01, CS-3 and OS-4 each reproduced on the old code, and refused with F2 |
| OS-4 mutation checks and rollback | Pass; rollback verified on a disposable database |
| Default `npm test` | 232 files / 2,023 passed / 1 skipped |
| tsc | PASS |
| Lint | Full 3 / 80 (unchanged); 0 new on the changed files |
| Production | Pre-image matched; applied as `20260926135315`; post-image `fc49b5fd…` verified; advisor shows nothing new |

## Still open

- OS-5 (export scope), AS-05 (locked-org scope), OS-12, CS-2.
- CS-1: the owner is verifying.
- The three drifted production functions (E18).
- Security advisor backlog: `free_server_time` mutable search_path; leaked-password protection is off.
- The optional `actions/*` version bump.
