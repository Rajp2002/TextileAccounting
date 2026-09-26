# Weavly refactor program — status

Updated 2026-09-26 (night). **Package 1B-2 is complete** (EVIDENCE E18, E19) and committed and pushed to `main` with this docs change (user-approved). **Current package: F1**, the inventory audit and challan archive fixes, approved by the user.

## Decisions needed

1. (Approved: commit and push 1B-2; F1 approved.)
2. **Current package: F1, the inventory audit and challan archive fixes.** Corrective migration files that flip the OS-1, OS-2 and OS-3 KNOWN DEFECT tests, proven on the harness first.
   - Why first: these are the only confirmed defects breaking user-visible features today. The audit page always errors, owners cannot save audit counts, and settled or reversed challans never reach History.
   - What it needs: schema-change approval. Applying the migrations to production is **your action**, since `supabase db push` is off-limits for Claude.
   - Alternatives: **1C** (access-boundary tests: auth helpers, billing routes, webhook, onboarding) or **F2** (AS-01 onboarding fallback, CS-3 fail-closed signing key, OS-4 reversed-request guard).
3. **Signing key:** still unverified by Claude (the Vercel connector returns 403). Please confirm a post-change production deploy and one Free calculation.

## Decisions recorded (user, 2026-09-26)

- Commit and push 1B-1 to `main`: done, `95ae0240` + `28c00db0`.
- 1B-2 approved: done.
- Read-only `pg_default_acl` check approved: done. The harness matches production for 170/171 shared functions and all tables. Three production-only functions show schema drift (E18).
- Lockfile fix: done, `09213fde`; CI is green.
- CS-1 multi-weft fix out of scope until the owner verifies the method. AS-02 accepted temporarily.

## 1B-2 gate results

| Check | Result |
| --- | --- |
| `npm run test:db` | PASS: 7 files, 36 tests (24 from 1B-1 + 12 new), about 7 s; no cluster left |
| DB mutation check | tier-check mutation → 2 failures; revoked save RPC → 7 failures; restored copy 36/36 |
| Default `npm test` | 232 files / 2,019 passed / 1 skipped (unchanged) |
| tsc | PASS |
| New/changed files lint | 0/0 |
| Full lint | 3 errors / 80 warnings (unchanged) |

## Findings from 1B-2

- **The paid save chain works end to end in PostgreSQL.** The attestation, save, replay, `noChange`, stale-version, tamper and cross-tenant checks all hold.
- **CS-9 confirmed by execution:** the service-role attestation succeeds for an unpaid org. The owner-side RPC is the real plan gate.
- **OS-4 narrowed:**
  - Plain retries *are* idempotent.
  - Re-sending a settlement request after it was reversed re-pays the worker. This regressed from the 2026-09-01 version.
- **Schema drift:** three production functions exist outside `supabase/migrations`.

## Still open

- OS-1, OS-2, OS-3 and OS-4 fixes; OS-5 export scope; AS-01; AS-05; the CS-3 fail-closed change.
- A read-only multi-weft count, when the owner resumes CS-1.
- Deciding whether to bring the three drifted production functions under migrations (Phase 5 or a separate decision).
- The optional `actions/checkout` and `actions/setup-node` major-version bump.
