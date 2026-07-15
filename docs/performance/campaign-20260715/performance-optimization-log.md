# Performance optimization log

## PERF-001 — defer non-English translation resources

### What changed

`lib/i18n/context.tsx` now ships only English in the initial provider graph. Hindi, Gujarati, legacy, and generated legacy translations are loaded concurrently after a non-English language is requested. Loaded resources are reused for the life of the browser module.

The active content language remains English until all resources for the requested language are available, preventing partially translated hydration. A failed chunk load restores English and removes the rejected promise so a later request can retry.

### Why

The production manifest showed a 625,809-byte raw shared chunk dominated by translation data on every tested route. Most users do not need all three languages before first interaction.

### Files

- `lib/i18n/context.tsx`
- `__tests__/performance-bundle-boundaries.test.ts`

### Cache behavior and boundaries

- Scope: one browser JavaScript module instance.
- Keys: only the closed set `hi` and `gu`.
- Values: immutable, build-versioned translation assets.
- Invalidation: deployment chunk hashes and page reload; rejected loads are evicted immediately.
- Tenant/security: contains no user, organization, session, financial, stock, payroll, or permission data.
- Bound: at most two promises/resources; no unbounded cache.

### Risks and controls

- Risk: a brief English fallback while a selected dictionary downloads. Control: atomic activation after all resources resolve.
- Risk: language chunk failure. Control: restore English, persist the safe fallback, and allow retry.
- Risk: translation regression. Control: live English/Hindi/Gujarati switching plus existing runtime glossary tests.

## PERF-002 — defer the payroll PDF engine

### What changed

`PayrollClient.tsx` imports only the `PayslipItemization` type during compilation. `generateMeterPayslip` and `generateFixedPayslip` are imported on demand from the existing module when the user clicks PDF Slip. A load/generation failure shows an explicit error toast.

### Why

The payroll initial graph included the 330,613-byte raw jsPDF chunk despite PDF export being a secondary action.

### Files

- `app/(dashboard)/owner/payroll/PayrollClient.tsx`
- `__tests__/performance-bundle-boundaries.test.ts`

### Correctness and cache behavior

- The PDF generator, formatting, itemization, settlement inputs, and financial calculations were not changed.
- The standard browser module loader caches the immutable code chunk by deployment hash. No business data is cached.
- The operation remains client-side and read-only; it does not add or duplicate a mutation.

### Risks and controls

- Risk: first PDF click pays the chunk download cost. Control: explicit pending network behavior from the browser and a failure toast; no false success is shown.
- Risk: download regression. Control: emitted chunk confirmed, type checking passed, and payslip/read-model tests passed. Authenticated click verification remains blocked by PERF-003.

## Database, auth, and server behavior

- No database migrations, indexes, views, functions, triggers, RLS policies, queries, or RPCs changed.
- No authentication, authorization, middleware, tenant resolution, or session cache code changed in the campaign commit.
- No optimistic financial/inventory state was introduced.
- No production data or environment was touched.

## Measured experiment rejected

The global persisted React Query provider was temporarily scoped to the dashboard route group and onboarding, then rebuilt with the identical manifest measurement. `/login` changed from 598,136 raw / 197,270 gzip bytes and 22 initial chunks to 598,808 raw / 197,675 gzip bytes and 23 chunks; dashboard routes showed no material benefit. Because the experiment made the target route slightly worse, it was fully reverted and is not present in either campaign commit.

## Functional and performance verification

- Focused tests: 13 passed across bundle boundaries, i18n runtime, and payroll settlement history.
- Full prebuild suite: 95 files passed; 676 tests passed and one skipped.
- Focused ESLint: passed.
- TypeScript `tsc --noEmit`: passed.
- Production build: passed after the final code change; 95 test files and TypeScript were included in the build gate.
- Browser: English→Hindi→Gujarati→English passed; expected headings and `html[lang]` values observed.
- Production manifests: five identical route scenarios measured before and after.
