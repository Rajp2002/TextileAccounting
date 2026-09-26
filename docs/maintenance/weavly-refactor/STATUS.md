# Weavly refactor program — status

Updated 2026-09-26 (evening). **Package 1B-1 is complete and committed** (`95ae0240`, pushed to `main` with this docs commit). **Current package: 1B-2** (paid-save chain and OS-4 reproduction), approved by the user together with a read-only production check of default privileges. Work continues in the worktree on branch `maintenance/weavly-refactor`.

## Decisions recorded (user, 2026-09-26)

- **1B-1:** commit and push to `main` (approved). **1B-2** and the read-only production `pg_default_acl` check are approved.
- **Lockfile fix:** commit straight to `main`. Done: `09213fde` pushed. It adds the two missing nested `@emnapi` entries; E16 has the verification.
- **CS-1 (multi-weft):** rows hold each yarn's own picks (34 + 34), so the weft 100/N split is the defect (E15). **The fix is out of scope for now**; the owner will verify the correct method for multi-weft qualities first. The tests keep characterizing current behavior.
- **1B approved.** It is split for reviewability:
  - **1B-1 (now):** harness, self-checks, the OS-1/OS-2/OS-3 reproductions, tenant and locked-org boundaries, the Free debit, and the saved-costing immutability trigger.
  - **1B-2 (next, proposed):** the paid-save chain (attestation plus `save_estimator_costing_revision_v2`: replay, `no_change`, stale version) and OS-4 payroll idempotency, both of which need large payloads or seed data.
- **Earlier:** CS-3 key reported added (unverified); AS-02 accepted temporarily.

## Package 1B-1 plan (recorded before editing)

- **Problem:** RPC, RLS and trigger behavior has text-only coverage, and no harness covers migrations `0913`–`0922` (E10). E12 escalations need executable reproductions.
- **New paths:**
  - `scripts/test-db/cluster.mjs`: `initdb` in the OS temp dir, TCP on 127.0.0.1 only, no Unix socket, trust auth, and a loopback guard on every connection. Supabase stubs as in E9. It replays all migrations except the four pg_cron/pg_net schedules into a template database; each test file gets its own copy. The cluster is stopped and deleted at teardown.
  - `vitest.db.config.ts`, `__tests__/db/{global-setup,helpers}.ts`, `__tests__/db/*.dbtest.ts`.
  - `package.json` gains one script, `test:db`.
- **Preserved:** no migration, schema, application or dependency changes (`pg` is already installed). `npm test` does not pick up `*.dbtest.ts`, and CI is unchanged.
- **Test labels:** INVARIANT, CHARACTERIZATION, or KNOWN DEFECT (a KNOWN DEFECT test asserts today's failure and flips once a separately approved fix lands).
- **Acceptance:**
  - `npm run test:db` passes.
  - No Postgres process or data directory remains afterwards.
  - The loopback guard rejects remote hosts.
  - The full vitest, tsc and lint gates are unchanged, apart from new files linting clean.
  - A reverse-checked patch is saved while the work is uncommitted.
- **Rollback:** reverse the patch, or revert the commit once committed.

## 1B-1 gate results

| Check | Result |
| --- | --- |
| `npm run test:db` | PASS: 5 files, 24 tests, about 6 s; no cluster or data directory left |
| DB mutation check | 5/5 mutations caught; restored copy 24/24 |
| Default `npm test` | 232 files / 2,019 passed / 1 skipped (unchanged; `*.dbtest.ts` excluded) |
| tsc | PASS |
| New files lint | 0/0 |
| Full lint | 3 errors / 80 warnings; the −1 is from UI commit `9f12af19` |
| Patch reverse-check | PASS |

Limits: Supabase default privileges are an INFERRED fidelity assumption, and PostgREST hooks, real JWTs, pg_net and cron are not exercised.

## Still open

- OS-1/OS-2/OS-3/OS-5 fixes; AS-01 onboarding admin fallback; AS-05 locked-org scope.
- A fail-closed CS-3 code change once the key is verified.
- A read-only production count of multi-weft costings (when the owner resumes CS-1).
- The optional bump of `actions/checkout` and `actions/setup-node` to non-deprecated major versions.
