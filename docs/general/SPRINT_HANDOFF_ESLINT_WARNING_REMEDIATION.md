# Sprint Handoff: ESLint Warning Remediation

Date: 2026-06-02  
Branch: `codex/commercials-source-of-truth`  
Commit: `8363302 fix: resolve ESLint warnings, 278 -> 0 remaining`

## Outcome

This sprint eliminated the ESLint warning backlog while preserving the existing zero-error lint gate.

- Starting state: 278 ESLint warnings, 0 errors.
- Final state: 0 ESLint warnings, 0 errors.
- `@typescript-eslint/no-explicit-any` suppressions added: 0.
- Tracking updated in `USER_WORKFLOWS.md`.
- Changes were committed and pushed to `origin/codex/commercials-source-of-truth`.

## Baseline Audit

The baseline was captured before code changes using:

```bash
npm run lint 2>&1 | grep "warning" | sed 's/.*warning //' | sort | uniq -c | sort -rn
```

Rule breakdown:

| Rule | Count |
| --- | ---: |
| `@typescript-eslint/no-explicit-any` | 171 |
| `@typescript-eslint/no-unused-vars` | 106 |
| Unused ESLint directive | 1 |
| `react-hooks/exhaustive-deps` | 0 |
| Structural warnings | 0 |

Highest concentration files:

| File | Warning Count |
| --- | ---: |
| `app/(dashboard)/owner/estimator/EstimatorClient.tsx` | 33 |
| `app/(dashboard)/admin/admin-ui.tsx` | 19 |
| `app/(dashboard)/owner/orders/OrdersClient.tsx` | 18 |
| `app/(dashboard)/supervisor/dashboard/page.tsx` | 17 |
| `app/(dashboard)/owner/settings/audit/AuditTable.tsx` | 13 |
| `app/(dashboard)/owner/fixed-workers/page.tsx` | 12 |

## Fix Walkthrough

### Category A: `@typescript-eslint/no-explicit-any`

Replaced broad `any` annotations with local DTOs, `unknown`, typed error handling, and existing domain types where available.

Key patterns:

- Catch blocks now use `unknown` and narrow to `Error` or object-shaped values before reading fields.
- Supabase/query responses were represented with local row DTOs when generated database types were unavailable.
- JSON payloads use `Record<string, unknown>` or specific payload interfaces.
- Component callback and reducer payload types were narrowed instead of leaving value channels as `any`.
- No suppression comments were added.

Notable files:

- `app/(dashboard)/owner/estimator/EstimatorClient.tsx`
- `app/(dashboard)/admin/admin-ui.tsx`
- `app/(dashboard)/supervisor/dashboard/page.tsx`
- `app/(dashboard)/owner/fixed-workers/page.tsx`
- `components/AddWorkerDialog.tsx`
- `components/MachineManagement.tsx`
- `lib/referral.ts`
- Supabase edge functions under `supabase/functions/`

### Category B: `@typescript-eslint/no-unused-vars`

Removed genuinely unused imports, state variables, helper functions, and destructured values.

Key patterns:

- Removed unused icon imports and unused UI imports.
- Removed unused helper components in archived or simplified views.
- Removed unused state setters where state is read-only.
- Used existing values in logs/details where the value was intentionally computed.

Notable files:

- `app/(dashboard)/owner/settings/audit/AuditTable.tsx`
- `app/(dashboard)/owner/dispatches/DispatchesClient.tsx`
- `app/(dashboard)/owner/estimator/FactoryCostWizard.tsx`
- `app/(dashboard)/supervisor/workers/page.tsx`
- `components/settings/supervisor-float-manager.tsx`
- `components/factory-today/PendingReceiptsCard.tsx`

### Category C: React Hooks

Baseline had no `react-hooks/exhaustive-deps` warnings.

One stale unused hook suppression in `OrdersClient.tsx` was removed. Removing it exposed a real `react-hooks/set-state-in-effect` error, which was fixed by deriving the initial selected order from URL search params instead of synchronously setting state in an effect.

### Category D: Structural Warnings

Baseline had no `@typescript-eslint/no-empty-object-type` or similar structural warnings.

### Category E: Remaining Warnings

The last remaining warning category was an unused generated-file directive/noise path. ESLint ignores were moved fully into `eslint.config.mjs`, and generated PWA fallback bundles were ignored there.

`.eslintignore` was deleted because ESLint 9 no longer supports it and emitted a runtime warning.

## Verification

All required checks passed after remediation:

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

Results:

- `npm run lint`: 0 errors, 0 warnings.
- `npx tsc --noEmit`: pass.
- `npx vitest run`: 26 test files passed, 242 tests passed, 1 skipped.
- `npm run build`: pass; no build warning output.

Post-build lint was also rerun because the PWA plugin regenerates files under `public/`; lint remained clean.

## Important Notes

- No `database.types.ts` file was present in the repo during this sprint, so generated Supabase table types could not be used directly.
- The PWA build can regenerate `public/sw.js`, `public/workbox-*.js`, and `public/fallback-*.js`. These are intentionally ignored by ESLint through `eslint.config.mjs`.
- `public/workbox-4754cb34.js.map` was removed as stale generated output during the production build pass.
- Several source-inspection tests assert exact regression guard strings for Razorpay and production logging. Keep those guard messages intact unless the tests are updated at the same time.

## Handoff Checklist

Use this checklist before merging or starting the next sprint:

1. Pull `origin/codex/commercials-source-of-truth`.
2. Confirm the latest commit is `8363302`.
3. Run `npm run lint` and confirm 0 warnings.
4. Run `npx tsc --noEmit`.
5. Run `npx vitest run`.
6. Run `npm run build`.
7. If a future build regenerates PWA assets, rerun `npm run lint` afterward.

## Suggested Next Sprint Follow-ups

- Generate and commit Supabase database types so future query DTOs can use canonical table and RPC types.
- Consider elevating `@typescript-eslint/no-explicit-any` from warning to error now that the count is zero.
- Add a CI lint assertion that fails on warnings, not only errors.
- Decide whether generated PWA source maps should remain tracked or be consistently ignored/cleaned.
