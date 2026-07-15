# Performance optimization log

## PERF-001 — defer non-English translation resources

### What changed

`lib/i18n/context.tsx` now ships only English in the initial provider graph. Hindi, Gujarati, legacy, and generated legacy translations load concurrently only after a non-English language is requested. Loaded resources are reused for the life of the browser module.

The active content language remains English until all resources for the requested language are ready, preventing partially translated hydration. A failed chunk load restores English and removes the rejected promise so a later request can retry.

### Why

The production manifests showed roughly 570.6 KB raw / 150.4 KB gzip of avoidable translation code on every measured route. Most sessions do not require all three languages before first interaction.

### Files

- `lib/i18n/context.tsx`
- `__tests__/performance-bundle-boundaries.test.ts`

### Cache behavior and boundaries

- Scope: one browser JavaScript module instance.
- Keys: only the closed set `hi` and `gu`.
- Values: immutable, build-versioned translation assets.
- Invalidation: deployment chunk hashes and page reload; rejected loads are evicted immediately.
- Tenant/security: no user, organization, session, financial, stock, payroll, or permission data.
- Bound: at most two promises/resources; no unbounded cache.

### Risks and controls

- First non-English selection incurs a download; resources activate atomically after all imports resolve.
- Chunk failures restore and persist the safe English fallback and remain retryable.
- Live English/Hindi/Gujarati switching and existing glossary/runtime tests cover behavior.

## PERF-002 — defer the payroll PDF engine

### What changed

`PayrollClient.tsx` imports only the `PayslipItemization` type during compilation. `generateMeterPayslip` and `generateFixedPayslip` load on demand from the existing module when the user clicks PDF Slip. Load or generation failure shows an explicit error toast.

### Why

The payroll initial graph included jsPDF even though PDF export is a secondary action.

### Files

- `app/(dashboard)/owner/payroll/PayrollClient.tsx`
- `__tests__/performance-bundle-boundaries.test.ts`

### Correctness and cache behavior

- Generator formatting, itemization, settlement inputs, and financial calculations are unchanged.
- The browser module loader caches the immutable code chunk by deployment hash; no business data is cached.
- The operation remains client-side and read-only and adds no mutation.

### Risks and controls

- First PDF click pays the chunk cost; a failure toast prevents false success.
- The deferred chunk, type boundary, build, and payslip/read-model tests passed.
- The QA cycle had no paid settlement; the click was deliberately not forced through a financial mutation.

## Upstream authentication integration

The clean campaign branch was rebased onto current `origin/main` at `f8a47d7`. The upstream authentication changes shorten and instrument the production sign-in critical path and make redirects/logout deployment-safe. They are not authored or claimed as `8d4d767` campaign work, but they are part of the final tested branch.

Authenticated QA verification then passed for owner and supervisor sessions, session logout/restoration cycles, server-authoritative role redirect, and gated route rendering. Credentials remained in the protected local secret store and are absent from artifacts.

## PERF-010 — prevent supervisor setup load freeze

Production read-only smoke reproduced an overlapping initial setup request: loom, worker, order, and assignment data rendered, but the active request left `loading` true for more than 15 seconds, disabling shift submission indefinitely.

The dashboard now waits for the tenant/user-scoped draft key before making its setup request, reducing the initial setup fetches from two to one. Active requests always settle loading in `finally`; stale completions cannot clear a newer request, and a genuine failure produces a retryable error rather than an endless spinner. No shift mutation or optimistic state was introduced.

Files: `app/(dashboard)/supervisor/dashboard/page.tsx` and `__tests__/batch24d-submit-draft-isolation.test.ts`. Production deployment `dpl_2dhb5j87YkJQCZ1pVe54Gtrda4nY` reached Ready for merge commit `9c0a4c2`. Five canonical hard reloads all settled with no loading text in 5,024–6,543 ms (p50 5,450 ms; p95 6,543 ms), versus the censored pre-fix reproduction that remained blocked after 15 seconds.

## Database migration reconciliation and tenant-safe views

- Nine production history versions were matched to their one-to-one repository migrations after name/content/catalog verification; history metadata was repaired without replaying schema or touching business rows.
- A full shadow replay exposed `organizations.join_code` being referenced before creation. The historical migration now creates the already-deployed column shape idempotently, and the complete 212-migration replay produces an empty public-schema diff against the linked database.
- Migration `20260715113013_harden_summary_views_security_invoker.sql` sets `security_invoker=true` on six summary views whose underlying tables already enforce RLS. The production security advisor moved from six `security_definer_view` errors to zero.
- Direct owner reads succeeded and tenant-negative probes returned zero cross-tenant rows. The migration changes metadata/comments only; rollback is six `ALTER VIEW ... RESET (security_invoker)` statements.

## Database, auth, and server behavior of campaign code

- The performance optimization commit `8d4d767` changed no database query, migration, or authentication boundary.
- Release migration `341f151` changes only migration replay completeness and view execution identity; it changes no rows, calculations, functions, triggers, policies, indexes, or RPCs.
- No authentication, authorization, middleware, tenant resolution, or session cache code changed in the campaign commits.
- No optimistic financial/inventory state was introduced.
- No production business data was mutated.

## Measured experiment rejected

The global persisted React Query provider was temporarily scoped to the dashboard route group and onboarding, then rebuilt with the identical manifest measurement. `/login` gained 672 raw bytes, 405 gzip bytes, and one initial chunk while authenticated routes showed no material benefit. The experiment was fully reverted.

## Functional and performance verification

- Focused bundle-boundary, i18n, and payroll tests passed.
- Final production build gate: 99 test files passed; 697 tests passed and one intentional skip; TypeScript and 43 static pages passed.
- Live English → Hindi → Gujarati → English switching passed.
- Protected owner and supervisor sessions passed in local QA and production read-only smoke; no production business mutation was used.
- Owner and supervisor route sweeps, role redirect, mobile viewport, and streamed readiness checks passed.
- Production manifests were measured from tree-equivalent before and optimized after builds.
- Full lint and `git diff --check` passed before push.
