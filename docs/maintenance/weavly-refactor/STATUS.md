# Weavly refactor program — status

Updated 2026-09-26 (night). **F3 is complete:**
- Its three migrations are applied to production (verified).
- It is committed and pushed to `main` with this change.

**No package is in progress.** The fix packages F1–F3 are done. Details: EVIDENCE E20–E22.

## Decisions needed

1. **Choose the next package.** Candidates:
   - **Phase 2 (consistency)** from the program, scoped in a plan first.
   - **Open product decisions** (these need owner input first): OS-5 export scope, AS-05 locked-org scope.
   - **Smaller backlog items:**
     - `custom_access_token_hook` grant drift (E18 item 2);
     - the unused `get_user_role()`;
     - OS-12;
     - CS-2.
2. **Owner action (optional):** enable leaked-password protection in Supabase Auth settings (advisor WARN).

## Decisions recorded (user, 2026-09-26)

- **F3:**
  - Approved, committed and pushed.
  - Migrations `20260926174334`, `20260926174338` and `20260926174343` applied and verified.
  - Dropping the three legacy policies was approved as a separate authorization change.
- **F1 production UI check:** done by the owner. The audit page recorded a count and finalized, and challan History shows the transactions.
- **F2:**
  - Committed and pushed (`31dc8b3b`, `87d9d374`). CI passed.
  - Migration `20260926135315` applied.
  - Signing keyring confirmed by the owner.
- **F1:** committed and pushed (`eda53bc4` then `e3541dfb`), applied and verified.
- **Earlier:** 1F, 1A, 1B-1 and 1B-2 are done, as are the lockfile fix and the privilege check.
- **Owner decisions:**
  - CS-1 (multi-weft) is out of scope until the owner verifies the method.
  - AS-02 (Free auto-confirm) is accepted for now.
  - OS-5 and AS-05 scope: the owner is unsure.

## F3 results

| Check | Result |
| --- | --- |
| `npm run test:db` | PASS: 10 files, 56 tests |
| Pre-fix proof and mutation checks | Parity tests fail without the migrations; the drop test fails without its DROP lines |
| Idempotency and rollback | Verified on disposable databases |
| Default `npm test` | 232 files / 2,023 passed / 1 skipped |
| tsc and lint | PASS; full lint 3 / 80 (unchanged) |
| Production | Pre-state matched; applied; restated objects byte-identical; legacy policies gone; `free_server_time` pinned; advisor search-path warning cleared |
| Parity vs production | Policies, triggers and RLS flags identical; functions identical apart from comments in one legacy overload |

## Still open

- OS-5, AS-05, OS-12, CS-2.
- CS-1: the owner is verifying.
- `custom_access_token_hook` grants (E18 item 2); `get_user_role()` is unused.
- Leaked-password protection (Auth setting).
- The optional `actions/*` version bump.
