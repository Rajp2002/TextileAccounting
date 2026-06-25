# Pilot Remediation Loop State

Run under control: `PILOTQA-20260621-2058-8QIH`

Source-of-truth artifacts:

- `output/qa/PILOTQA-20260621-2058-8QIH/FINAL_REPORT.md`
- `output/qa/PILOTQA-20260621-2058-8QIH/FAILURE_DATA_IMPACT_REPORT.md`
- `output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md`
- `output/qa/PILOTQA-20260621-2058-8QIH/results.json`
- Referenced evidence logs under `output/qa/PILOTQA-20260621-2058-8QIH/logs/`

## Current Verdict

Status: No-Go for pilot.

Final classification from the completed matrix:

| Status | Count | Pilot meaning |
| --- | ---: | --- |
| `pass` | 124 | Runtime/test evidence exists. |
| `fail` | 91 | Must be fixed, de-scoped, or explicitly accepted only where non-pilot scope. |
| `blocked` | 30 | Not pilot-ready until evidence is captured or the feature is removed from pilot scope. |
| `code_verified` | 131 | Source evidence only. This is not a pass. |
| `not_applicable` | 1 | Excluded by scope. |
| `not_run` | 0 | Matrix was fully classified. |

Critical blockers: 10. High failures: 31. Critical blocked golden-journey follow-ons: 14.

## Operating Rules

1. `FINAL_REPORT.md` and `FAILURE_DATA_IMPACT_REPORT.md` decide priority.
2. `code_verified` is unresolved evidence debt until promoted by runtime or test evidence.
3. No item can move to resolved without a regression test, a runtime QA artifact, or a written reason that runtime QA is the only valid proof.
4. Work is grouped by root-cause cluster, not page.
5. Fix order is security, production/stock correctness, dispatch/receipt correctness, payroll/kharchi, idempotency/offline, then release gates.
6. Each cluster starts with the domain invariant, then code or migration design.
7. Production data changes are forbidden except rollback-only probes, isolated QA tenants, or disposable environments.
8. Anything not ready for pilot must be hidden, disabled, de-scoped, or documented as unsupported before pilot.

## Remediation Loop

Each loop batch must follow this sequence:

1. Select a root-cause cluster from `FAILURE_BACKLOG.md`.
2. Copy the relevant invariant from `DOMAIN_INVARIANTS.md` into the implementation ticket.
3. Define the smallest code/migration change that enforces the invariant.
4. Add or update regression tests. If automated coverage is impossible, document the required runtime QA path before implementation starts.
5. Run local commands in `RETEST_PLAN.md`.
6. Execute runtime QA only in the QA tenant or disposable environment.
7. Save evidence under the next QA output folder and reference it in `FIX_LOG.md`.
8. Mark rows resolved only after evidence exists and the matrix rows can be promoted to `pass`, `not_applicable`, or explicitly `unsupported`.

## First Loop Batch

Batch: `BATCH-01A-MUTABLE-PROFILE-AUTHZ`

Root cause: profile authorization fields are mutable by authenticated users, and server authorization/claims depend on those mutable fields.

Priority source:

- `FINAL_REPORT.md`: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005` are critical failures and security is recommended first.
- `FAILURE_DATA_IMPACT_REPORT.md`: authorization boundary is practical fix priority 1 because it can corrupt all domains.
- `logs/security-review.json`: rolled-back production evidence proved supervisor self-update to owner and custom claim minting.

Failure IDs in batch:

- Critical: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`
- Kept open for Batch 1B or later security batches: `SEC-006`, `AUTH-016`, `AUTH-012`, `AUTH-013`, `SEC-013`

Batch 1A objective:

Authenticated users must not be able to mutate role, organization, or any other field used for authorization. Server authorization must remain correct after direct API attempts, token refresh, browser refresh, and owner/supervisor route checks.

Out of scope for Batch 1A:

- `SEC-006` and `AUTH-016`, unless directly affected by the profile authorization-boundary fix.
- Production correction/stock atomicity.
- Dispatch package numbering and receipt-state repair.
- Payroll legacy RPC removal.
- Offline kharchi and cache clearing.
- Release-gate repair, npm audit, Sentry, and migration-drift repair, except normal verification commands that prove Batch 1A did not regress the app.

## Batch 1A Acceptance Criteria

Batch 1A is accepted only when all of the following are true:

1. `authenticated` has no direct column privilege allowing update of `public.profiles.role`, `public.profiles.org_id`, or equivalent authorization fields.
2. `public.profiles` RLS update policy prevents role/org mutation even if a caller can update allowed personal profile fields.
3. A QA supervisor cannot change self role/org through Supabase client, PostgREST, server action, or RPC path.
4. After a failed self-mutation attempt and token refresh, the supervisor still receives supervisor claims and owner-only server actions remain denied.
5. Owner login, supervisor login, onboarding redirects, and route guards still work.
6. Evidence includes regression test output, SQL metadata output, and browser/runtime QA notes. Source review alone is insufficient.

## Current Batch State

Batch 1A (`SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`) is implemented and review-ready with evidence in `FIX_LOG.md`.

Evidence captured:

- Pre-fix QA reproduction proved supervisor self-mutation of `profiles.role` and `profiles.org_id`, token refresh claim escalation, and owner route/server-loader access.
- Supabase migration `20260625195248_harden_profile_authorization_boundary.sql` was applied to project `vzhwahudircrpgtitwzd`.
- Post-fix SQL metadata shows `authenticated` cannot update `profiles.id`, `profiles.role`, or `profiles.org_id`.
- Post-fix QA probe shows direct role/org mutations denied, role/org unchanged, token refresh remains supervisor, owner-only RPC denied, and owner login/claims still work.
- Post-fix browser QA shows supervisor is redirected from `/owner/today` to `/supervisor/dashboard`, owner-only API returns 403 for supervisor, and real owner can load `/owner/today`.

Resolution status:

- `SEC-002`, `SEC-003`, `SEC-004`, and `SEC-005` are candidates for matrix promotion to pass after human review.
- `code_verified` is still not treated as pass.
- `SEC-006` and `AUTH-016` remain open for Batch 1B.
- No production/stock, dispatch, payroll, estimator, offline, npm audit, Sentry, release-gate, or migration-drift work was included in Batch 1A.
