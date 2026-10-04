# AD02 — founder sign-in and shell

Local development implementation; no production identity, factor, grant, account, deployment or configuration was changed.

## Delivered

- Sibling `(admin-auth)` and `(admin-console)` route groups keep `/admin/login` and `/admin/verify` outside any tenant guard. `/admin/login` alone is public; the challenge checks current founder identity before factor metadata. The console layout independently requires the founder principal.
- Email/password uses the existing Supabase cookie session. Provider errors remain generic. The challenge accepts only the candidate's currently verified TOTP factor and establishes the authoritative server session only after verification. No enrollment, signup, replacement factor or separate password store is implemented.
- Same-origin checks and action-specific existing auth rate limiting protect both server actions, including action-ID calls through other routes. Proxy also applies the existing route-level auth limiter. Return targets allow only fixed founder destinations or factory/ticket UUID detail paths.
- Fresh responsive navigation: Today, Factories, Support, Payments, System; Audit and Formal operations are secondary. Skip-to-content, focus treatment, loading/error/denial states and an explicit shared-session sign-out explanation are present.
- Proxy routes authenticated founder/support requests to their own live guards without stale role, onboarding or paid-plan hints intercepting them. Customer routing remains in place. Founder server inactivity replaces the customer activity cookie for the dedicated console routes; polling does not renew the founder server state.
- On signed-in `/login` only, an RLS-protected self-profile read of role/revocation routing fields corrects a stale owner hint for a current admin profile without requiring an organization. This adds no profile query to ordinary customer or dedicated console requests and does not confer any founder capability. Deep links carry an allowlisted `returnTo` through login and challenge; incoming pathname markers are stripped before Proxy writes its own marker.
- Former admin files moved to `/admin/legacy`; no records or services were removed. `WEAVLY_ADMIN_LEGACY_READS_ENABLED` defaults closed. When separately approved, the page shows a read-only formal-source inventory. The former seven-tab UI remains unimported source reference; no high-impact controls are exposed by this read view. Legacy mutations/exports have an independent server gate owned by AD01.
- No existing `/admin?tab=` caller or query contract was found. `/admin` is now the fresh landing destination, with no duplicate page URL ownership.

## Validation

The focused command below passed **73 tests across 7 files** on 4 October 2026, after repairing the proxy fixture to use the configured project cookie name:

```sh
node scripts/performance/isolated-command.mjs npx vitest run __tests__/admin-auth-flow.test.ts __tests__/admin-proxy-routing.test.ts __tests__/proxy-terminal-session-recovery.test.ts __tests__/p1-auth-login-route.test.ts __tests__/base-privacy-request-workflow.test.ts __tests__/base-security-incident-workflow.test.ts __tests__/sign-in-telemetry.test.ts
```

An additional **8 tests across 2 files** passed for full page URL ownership, rendered accessibility/session affordances, default-off legacy reads, guard-before-read behavior and a read view without mutation/export controls:

```sh
node scripts/performance/isolated-command.mjs npx vitest run __tests__/admin-shell.test.tsx __tests__/admin-legacy-gates.test.tsx
```

Focused ESLint passed for auth routes, shell/components, legacy source, route/input helpers, proxy and all four new suites. Final integration evidence and screenshots are recorded by AD10; unit mocks are not live-provider MFA evidence.

After the safe deep-link and current self-profile routing refinements, **48 tests across 3 files** passed (`admin-proxy-routing`, `proxy-terminal-session-recovery`, `auth-login-performance`). These include a current admin with a stale owner hint and no organization, unchanged owner routing, no extra profile lookup outside signed-in `/login`, and no email/source-error/revoked-profile promotion. The four new AD02 suites now contain **53 passing tests** across the focused runs.

MFA implementation was checked against the official [Supabase TOTP challenge flow](https://supabase.com/docs/guides/auth/auth-mfa/totp) and [challengeAndVerify API](https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify). The changelog Markdown endpoint could not be fetched by the browsing tool; the public changelog index was checked separately. These source checks do not verify a deployed project configuration.

The first integrated typecheck found no AD02 errors, but failed other in-progress slices (`factories.ts` nullable audit targets and `payments-domain.ts` bigint literals with the repository target). Final integration status must use the final AD10 result.

## Remaining release gates

- Real founder AAL1/AAL2 challenge, interrupted MFA, recovery, expiry and account switching require a running explicitly isolated Auth environment and approved synthetic fixture setup. Production founder UUID, MFA/recovery and grant are not provisioned.
- Legacy operational ownership and any enabling of its read or high-impact paths remain explicit release decisions. Default disabled code is not evidence those existing obligations were completed.
- Protected-console mobile/keyboard/browser-back evidence requires authenticated fixture access. Anonymous login/deep-link evidence can run without it.

## Rollback

Disable the server founder capability and affected data endpoints first. Preserve the additive grant/session/audit/support records. Revoke affected sessions where authorized. Disable `WEAVLY_ADMIN_LEGACY_READS_ENABLED` independently. Keep current public privacy/security/contact routes and reviewed retained-service runbooks; never restore an old role-only admin route or weaken tenant authentication as a fallback. Rolling shell code back cannot delete customer tickets or change money/access facts.
