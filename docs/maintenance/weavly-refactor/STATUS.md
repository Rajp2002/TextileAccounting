# Weavly refactor program — status

Updated 2026-09-26 (night). **F1 is complete, applied to production (verified) and committed and pushed with this change.** **Current package: F2** (AS-01 onboarding admin fallback, CS-3 fail-closed signing key, OS-4 reversed-request guard), approved by the user.

## Decisions needed

1. **Check the audit page in production** (`/owner/stock/audit`): load it, record a count, finalize. Also check one challan's History once one is settled or reversed.
2. **F2 gate decisions** will follow when F2 is ready (commit/push, and applying its migration).

## Decisions recorded (user, 2026-09-26)

- F1: commit and push; apply the migrations to production (done: versions `20260926132159`, `20260926132310`, `20260926132412`, verified by source hash); keep OS-2b auto-draft; backfill left to Claude and skipped (0 affected challans); F2 approved.

- 1B-2 commit and push: done (`e5b3383a`, `2aa3d6c7`). F1 approved: done (uncommitted).
- Earlier: 1B-1, the lockfile fix, the privilege check and the Web Vitals read are done. CS-1 is deferred by the owner. AS-02 is accepted temporarily. The signing key is reported set but unverified by Claude.

## F1 gate results

| Check | Result |
| --- | --- |
| `npm run test:db` | PASS: 8 files, 47 tests; no cluster left |
| Pre-fix proof | 10/14 new tests fail without the migrations, each with its defect signature; the 4 invariants hold either way |
| Latent bug | Verified: with only the aggregate fix, the page still fails with `record "v_audit" is not assigned yet` |
| Migration diffs vs the functions they replace | Only the intended edits |
| Default `npm test` | 232 files / 2,019 passed / 1 skipped |
| tsc | PASS |
| Full lint | 3 / 80 (unchanged); ratchet 0 new on changed app files |
| Browser check | NOT RUN (needs the migrations on QA) |

## Still open

- OS-4 (reversed-request guard), OS-5 export scope, AS-01, AS-05, the CS-3 fail-closed change.
- The three drifted production functions (E18).
- CS-1 (owner verifying).
- The optional `actions/*` version bump.
