# Weavly refactor program — status

Updated 2026-09-26 (night). **Phase 2 started. Current package: 2A (lint warnings)**. It is complete in the worktree, uncommitted, and stopped at its gate. Plan and details: EVIDENCE E23.

## Decisions needed (2A gate)

1. **Commit and push 2A to `main`?** It is type and dead-binding cleanup across 32 files, with no behavior change. Lint goes from 3 errors / 80 warnings to 3 errors / 0 warnings.
2. **Next package.**
   - Recommended: **2B**, the 3 react-hooks lint errors. That makes lint fully green, so CI can then enforce `--max-warnings=0`.
   - Other options: 2C (estimator save payload dedupe), 2D (shared tour runner). Plan in E23.
3. **New suspected defect OS-13** (payroll cycle settings fallback bypasses the RPC's checks and is non-atomic). Fix it as its own small package (RPC-only, like AS-01)? This is an authorization and integrity change, so it needs separate approval.

## Decisions recorded (user, 2026-09-26)

- **Phase 2:** started by the owner. 2A is complete (uncommitted).
- **F3:**
  - Committed and pushed (`7ef4f60c`, `2794f4a0`). CI passed.
  - Migrations `20260926174334`, `20260926174338` and `20260926174343` applied and verified.
  - Legacy policies dropped.
- **F1 production UI check:** done by the owner.
- **F2:**
  - Committed and pushed (`31dc8b3b`, `87d9d374`). CI passed.
  - Migration `20260926135315` applied.
  - Signing keyring confirmed by the owner.
- **F1:** committed, pushed, applied and verified.
- **Phase 1:** 1F, 1A, 1B-1 and 1B-2 done, as are the lockfile fix and the privilege check.
- **Owner decisions:**
  - CS-1 (multi-weft) is out of scope until the owner verifies the method.
  - AS-02 (Free auto-confirm) is accepted for now.
  - OS-5 and AS-05 scope: the owner is unsure.

## 2A gate results

| Check | Result |
| --- | --- |
| tsc | PASS |
| Full lint | 3 errors (2B) / **0 warnings** (was 80) |
| Default `npm test` | 232 files / 2,023 passed / 1 skipped |
| `npm run test:db` | 10 files / 56 passed |
| Build | NOT RUN (type-only and dead-binding changes) |

## Still open

- OS-13 (new), OS-5, AS-05, OS-12, CS-2.
- CS-1: the owner is verifying.
- P2-O1…O5 observations (E23).
- `custom_access_token_hook` grants (E18); `get_user_role()` is unused.
- Leaked-password protection (Auth setting).
- The optional `actions/*` version bump.
