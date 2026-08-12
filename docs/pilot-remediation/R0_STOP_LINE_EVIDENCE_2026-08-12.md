# Sprint R0 — Stop-the-line evidence record

**Recorded:** 2026-08-12 (Asia/Kolkata)
**Decision:** **NO-GO / unsigned working record**
**Scope:** Base-only pilot stabilization; no public launch and no referral campaign

This record captures the state that was actually observed. It does not convert
source tests or a QA rehearsal into production approval.

## Release baseline

| Item | Observed state | Evidence / disposition |
| --- | --- | --- |
| Repository | `main`, HEAD `d0acdad2d2a0ca0bde0691934c8463a184940c05` | R0 release commit `d0acdad` is pushed to `origin/main`; the working tree still has unrelated untracked user artifacts. |
| Vercel project | `textile-accounting` / `prj_Eg9Cmax0d3yooB1iJmbDorUBF6Q4` | Team `team_IdyTSnqYdDMy01w7YrgIK9P9`. |
| Current production deployment | READY, deployment `dpl_6seeWedMM7znuLMjWnKvNVhDWeYS` | Production still reports commit `77376b38…`. R0 deployment `dpl_9HTi1bmr7s7BnBZTwPPpn1sD3kCV` for `d0acdad2…` is queued, not yet READY; the R0 changes are not deployed. |
| Production Supabase | `vzhwahudircrpgtitwzd` | PostgreSQL 17.6; current migration head `20260808121531_harden_quotation_sent_stamp_search_path`. |
| QA Supabase | `eutycrtzzxmlkcpipgod` | PostgreSQL 17.6; no named tenant ID was supplied in this run. |
| Self-serve billing flag | `BILLING_SELF_SERVE_PLAN_TIERS=['base']`; default `base` | Server guard now rejects Premium/unknown tiers before pricing, lifecycle, claim, or provider calls. |
| Referral campaign flag | `REFERRAL_CAMPAIGN_ENABLED` absent/default-off; `REFERRAL_PILOT_ORG_IDS` absent | New server gate requires both an explicit `true` switch and a named organization allowlist. Campaign remains closed. |
| Backup / contacts | Not evidenced | Required backup variables/artifact and rollback/forward-fix contact tree were not supplied. |

## Migration and schema proof

The repository contains the reviewed files, in the required order:

1. `20260809193000_zero_warp_crimp_defaults.sql`
2. `20260809193305_sprint21_sync_saved_quality_yarns_to_rate_book.sql`
3. `20260810182342_referral_year_credits.sql`

Production was read-only inspected and **not mutated**. Before deployment it
reported:

- migration head `20260808121531`, so all three reviewed versions are absent;
- `factory_cost_profile`, `estimator_templates`, and `estimator_quotes`
  defaults still at `5`/`5.0`;
- `referral_year_credits` absent;
- `organization_export_runs` present; and
- zero lock waiters at inspection time.

The QA rehearsal applied the three SQL bodies sequentially and refreshed the
PostgREST schema cache with `NOTIFY pgrst, 'reload schema';`. The resulting QA
objects/defaults were present and lock waiters remained zero. Supabase recorded
that rehearsal with generated versions `20260812104410`, `20260812104418`, and
`20260812104428`, rather than the repository filenames; this is QA rehearsal
evidence only, not exact production migration-head proof. QA also lacks
`organization_export_runs`, so it is not yet a valid production-like export
clone.

**R0-02 status:** QA SQL rehearsal **pass with evidence limitation**;
production deployment **blocked** pending recoverable backup proof, exact
versioned migration deployment, low-traffic owner, schema-cache verification,
and golden-journey smoke.

## Implemented local controls

- Organization export includes `referral_year_credits` and
  `organization_export_runs`, queries every catalog dataset before generating
  output, recursively redacts sensitive fields, records failed runs, and now
  returns an actionable migration/schema-cache readiness error instead of a
  generic or false success.
- Self-serve checkout uses `BILLING_SELF_SERVE_PLAN_TIERS` on the server and
  defaults an absent tier to Base. Premium and forged tiers are rejected before
  `getBillingPlan`, lifecycle resolution, checkout claim creation, or Razorpay.
- Referral conversion remains database-serialized and idempotent with the
  five-credit cap and final-30-day redemption rules. New referral display/apply
  paths are closed unless the named pilot gate is explicitly enabled.
- Dependency paths were updated without `npm audit fix --force`:
  `brace-expansion` 5.0.9, `fast-uri` 3.1.5, `nanoid` 3.3.18,
  `dompurify` 3.4.13, and `jspdf` 4.2.1.

## Verification run

| Check | Result |
| --- | --- |
| Focused R0/billing/referral/export tests | 37 passed / 37 |
| Full Vitest suite | 936 passed, 1 skipped, 150 files |
| ESLint | Passed |
| Next production build | Passed (`next build --webpack`; PWA worker generated) |
| `npm audit --omit=dev` | 0 total vulnerabilities (602 production dependencies) |
| Supabase advisors | QA new R0 referral objects had no relevant new security lint; broader existing advisor backlog remains for R1. |

## Acceptance matrix

| Story | Status | Blocking evidence |
| --- | --- | --- |
| R0-01 | Partial | Baseline captured, but no signed contacts/backup/QA tenant record. |
| R0-02 | Partial | QA rehearsal passed; production is missing all three exact migrations and backup proof. |
| R0-03 | Code-ready / runtime open | Export contract hardened; QA lacks `organization_export_runs`; production download/redaction/tenant runtime not exercised. |
| R0-04 | Code-ready / runtime open | Database invariants and local contracts exist; isolated paid/referral/concurrency/redemption runtime evidence is not captured. Campaign is default-off. |
| R0-05 | Code-ready / provider open | Server boundary passes local tests; Razorpay failure/retry/replay cases are not deployed/provider evidence. |
| R0-06 | Pass locally | Audit, tests, lint, and build pass; browser PDF/PWA/download evidence remains a release-gate task. |
| R0-07 | Blocked | No deployed R0 revision or production migration head equal to repository head. |
| R0-08 | Partial | Default-off named-org referral gate is installed; support/alert owners, named accounts, and disable drill are not recorded. |

## Stop conditions still active

- Do not apply the three R0 migrations to production through a tool that would
  record generated timestamps instead of the exact repository versions.
- Do not release until a recoverable production backup is created and restored
  or otherwise independently verified.
- Do not enable `REFERRAL_CAMPAIGN_ENABLED` without the approved pilot org UUIDs,
  responder, support contact, and safe-disable drill.
- Do not claim Go while the deployed revision differs from the tested R0
  revision and while production export/referral/provider runtime evidence is
  absent.

## Release-owner completion checklist

1. **Completed:** commit `d0acdad2d2a0ca0bde0691934c8463a184940c05` is on
   `origin/main`; wait for Vercel deployment `dpl_9HTi1bmr7s7BnBZTwPPpn1sD3kCV`
   to become READY and verify its exact SHA.
2. Verify the backup artifact and restore/reconciliation evidence; record the
   owner, expiry/retention, and rollback/forward-fix contacts.
3. Deploy the three exact migrations in order during the approved low-traffic
   window, refresh PostgREST, and re-check migration history, defaults, RLS,
   locks, and row impact.
4. Deploy that exact application revision, then run the R0-03/R0-07 export,
   referral, Base checkout, browser/PDF/PWA, and provider recovery cases.
5. Record named pilot accounts, monitoring thresholds/responders, support path,
   and the signed conditional Go/No-Go decision.
