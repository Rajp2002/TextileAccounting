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

The clean campaign branch was created from current `origin/main` and therefore includes upstream commits `17d9ab5` and `c88db01`. Those changes shorten and instrument the production sign-in critical path. They are not authored or claimed as `ae65791` campaign work, but they are part of the final tested branch.

Authenticated QA verification then passed for owner and supervisor sessions, session logout/restoration cycles, server-authoritative role redirect, and gated route rendering. Credentials remained in the protected local secret store and are absent from artifacts.

## Database, auth, and server behavior of campaign code

- No database migrations, indexes, views, functions, triggers, RLS policies, queries, or RPCs changed.
- No authentication, authorization, middleware, tenant resolution, or session cache code changed in `ae65791`.
- No optimistic financial/inventory state was introduced.
- No production data or environment was touched.

## Measured experiment rejected

The global persisted React Query provider was temporarily scoped to the dashboard route group and onboarding, then rebuilt with the identical manifest measurement. `/login` gained 672 raw bytes, 405 gzip bytes, and one initial chunk while authenticated routes showed no material benefit. The experiment was fully reverted.

## Functional and performance verification

- Focused bundle-boundary, i18n, and payroll tests passed.
- Clean upstream production build gate: 97 test files, 687 tests, no skips; TypeScript and 42-page generation passed.
- Live English → Hindi → Gujarati → English switching passed.
- Protected owner and supervisor QA sessions passed; no production data was used.
- Owner and supervisor route sweeps, role redirect, mobile viewport, and streamed readiness checks passed.
- Production manifests were measured from tree-equivalent before and optimized after builds.
- Full lint is recorded in the final evidence commit after documentation reconciliation.
