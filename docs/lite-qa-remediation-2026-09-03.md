# Lite QA remediation — 3 September 2026

Scope: requested findings from `LITEQA-20260903-1547-DCBU`: comparison, winding scope, lint/dependencies, Supabase advisors, and Lite organization metadata. Original QA artifacts remain unchanged. This is a code/migration handoff, not a production release or full QA sign-off.

## Implemented

- **F-02 comparison:** `lib/saved-costings.ts` preserves missing/non-numeric evidence as `null`, including summary deltas. `lib/estimator.ts` rejects missing/coerced required canonical audit numbers before they reach comparison. Multi-layer rates now reach the existing “Not available” display, without `/kg` or a fabricated negative price delta. Explicit numeric zero and numeric strings remain supported. Tests cover warp/weft, both comparison directions, missing legacy/canonical evidence, and immutable layer rates.
- **F-04 winding:** the detailed input now explains total **warp + weft kg per 100 m**; the separate warp-only note explicitly names **warping and sizing**. English, Hindi and Gujarati wording was updated. The engine and saved snapshot calculation remain unchanged: 3 kg warp + 4 kg weft at ₹4/kg = ₹0.28/m; disabled winding contributes zero.
- **TECH-002 lint:** removed unused declarations and replaced unsafe `any` usage with typed event/DOM handling and test fixtures. `npm run lint` now enforces `--max-warnings=0`; no rules were disabled.
- **TECH-005/006 dependencies:** patched pinned `fast-uri` 3.1.5 → 3.1.6 and the legacy minimatch `brace-expansion` override 1.1.17 → 1.1.18; compatible transitive fixes are in `package-lock.json`. No forced framework downgrade or major-version audit fix. Initial audit: 18 findings, 14 high. Final production and full audits: zero findings.
- **F-06 metadata:** both signup inserts explicitly set `product_experience: 'base'`. This historical marker denotes the shared Lite/Base workspace, not Base production access. Runtime resolution normalizes Lite/Base while retaining the actual subscription tier and Premium workspace switching. The migration conservatively repairs only organizations whose entire subscription history is Lite/Base, preserving Premium/trial/unknown histories, onboarding state, billing and costing records. A read-only production count found **12 eligible organizations**; none were changed in this session.

## Supabase migration and disposition

Migration: `supabase/migrations/20260903115520_lite_qa_metadata_and_advisor_hygiene.sql`.

Prepared changes:

- Explicit restrictive deny-client policy on `estimator_costing_attestations`, preserving existing revoked client grants and server access.
- Five covering indexes: attestation organization/user, saved-costing source lineage/template, and subscription plan.
- Split estimator `ALL` + `SELECT` policies into per-operation policies, retaining locked-account reads and denying locked writes. Cache only statement-constant JWT values; entitlement and lockdown checks remain row-dependent.
- Cache user ID in subscription/payment/billing-profile read policies, preserving role coverage and owner scope.
- Consolidate four profile SELECT policies using their existing OR semantics, preserving both current-user and organization reads, including live-membership fallback during claim refresh. Existing profile UPDATE protection remains untouched.

### Live baseline (read-only, production `vzhwahudircrpgtitwzd`)

The initially queried retired QA project `eutycrtzzxmlkcpipgod` is inactive; its empty advisor response is **not** production evidence.

Production security advisors: **62** notices — 8 RLS/no-policy INFO, 53 authenticated SECURITY DEFINER WARN, 1 leaked-password-protection WARN. Performance advisors: **469** — 146 unindexed foreign keys, 153 auth initplan, 38 unused indexes, 131 multiple permissive policies, 1 duplicate index. These are pre-migration counts; no claim is made that production is advisor-clean.

| Finding | Disposition |
| --- | --- |
| Attestation RLS enabled/no policy | Already fail-closed: live catalog confirms RLS enabled, no anon/authenticated DML privileges, and server privileges present. Migration documents that denial explicitly; never grant owners attestation access. |
| Lite Rate Book/revision RPCs and subscription predicates executable as SECURITY DEFINER | Intentionally retained, not blanket-revoked. Review found profile-derived owner/organization checks, entitlement and lockdown guards, scoped record IDs, and revision/version checks. RLS helpers must remain callable. This is a scoped engineering rationale, not blanket security-owner acceptance of all 53 legacy functions. |
| Lite RLS performance and FK notices | Scoped migration prepared and tested. Runtime policy outcomes must remain equivalent. |
| Leaked-password protection disabled | **Open production configuration action.** Enable via Supabase Auth settings and verify signup/reset behavior. Not changed by SQL or this session. |
| Remaining legacy/internal-table/RPC/index notices | **Open separate backlog**, not silently accepted, suppressed or reported fixed. Unused indexes were not removed solely because a low-traffic QA system has not used them. |

Profile baseline used for the policy-equivalence fixture, all permissive SELECT policies `TO public`:

```sql
"Tenant Isolation": id = auth.uid() OR org_id = (auth.jwt()->>'org_id')::uuid
"Users can read org profiles": org_id = get_user_org_id()
"Users can read own profile": id = auth.uid()
"Users can view own profile": auth.uid() = id
```

The three “Users can …” SELECT names and the `get_user_org_id()` helper are present in the live catalog but absent from tracked migration creation statements. Their drops and the helper fallback are conditional for fresh database replay. The isolated fixture also verifies the profile policy without those legacy objects.

## Verification

- `npm ci`: passed from updated lockfile; zero audit findings. npm still emits upstream peer/deprecation notices during install; these are not ESLint or vulnerability findings.
- `npm run lint`: passed, zero errors and warnings.
- Final full `npm test`: 198 files, 1,215 passed, one intentionally skipped live Supabase integration test (`RUN_LIVE_SUPABASE_TESTS` unset).
- `npm audit --omit=dev --audit-level=high` and `npm audit --audit-level=high`: both passed, zero vulnerabilities.
- `git diff --check`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed, including webpack/PWA compilation, TypeScript and all 50 static pages; no stale Browserslist warning.
- `scripts/qa/verify-lite-qa-migration.mjs`: passed against isolated PGlite 0.5.8, using the real repository entitlement predicate. Migration syntax, five indexes, conservative metadata exclusions, and **162 before/after probes across nine identities/lifecycle states** passed. Owner CRUD, locked read-only behavior, foreign inserts/reassignment rejection, expired/supervisor/anonymous denial, claim-refresh profile reads, and server-only attestation access were preserved. No production mutation was used for this test.

Docker was unavailable. PGlite was installed only under a temporary directory, not added as an application dependency. To rerun the fixture, install `@electric-sql/pglite@0.5.8` in a disposable directory and set `PGLITE_MODULE` to its `dist/index.js` absolute path before running the script from the repository root.

## Release boundary

The application has not been deployed and the migration has **not** been applied to production. After approval/application, rerun both advisors, verify the metadata count is zero for the eligible scope, and smoke-test authenticated Lite comparison, winding, signup, Rate Book save/review, and saved-costing revisions. Embedded policy tests are not substitutes for those live post-deploy checks.

The original report's markup-versus-margin decision, broader Hindi/Gujarati copy, export-history routing and monthly-overhead onboarding findings were not part of this request and are not declared resolved here.

References: [fast-uri patch advisory](https://github.com/advisories/GHSA-5jgf-p345-68v8), [brace-expansion advisory](https://github.com/advisories/GHSA-rgw5-rvv9-x895), [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), [RLS/no-policy advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [authenticated definer advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
