# Navigation reorganization — review evidence

## Baseline (2026-09-11)

Working tree started clean. Vitest: 246 files passed; 1707 tests passed, 1 skipped. Pre-refactor screenshots were not captured. Post-refactor browser evidence was collected against a local production build, with the actual production database target and isolated QA tenant verified before writes. The user’s predeployment verification requirement takes precedence over the browser-login skill’s production-only workflow. Production deployment remains unapproved.

| Existing destination | Actual path | Target | Access / affected files |
| --- | --- | --- | --- |
| Cost Estimate | /owner/estimator; /free | unchanged | estimator; owner-sidebar |
| Saved Costings / Quotations | /owner/quotes; /free/costings | Saved Costings | existing saved costing entitlements |
| Yarn Rate Book | /owner/rates | unchanged | rate_book |
| Production | /owner/production | unchanged | production |
| Configuration | /owner/operations | /owner/assignments | production_management; BaseAssignmentWorkspace, BaseProductionClient |
| Setup workers | /owner/setup | /owner/workers | production_management; BaseSetupWorkspace, loaders, actions |
| Setup machines | /owner/setup?section=machines | /owner/machines (Base workspace) | production_management; independent register |
| Legacy Looms | /owner/machines | preserve existing full-suite composition | legacy_full_suite; MachineManagement, machines/loaders |
| Workers (legacy) | /owner/fixed-workers | preserve access to existing records | legacy workflow access |
| Stock, Dispatches, Payroll | /owner/stock, /owner/dispatches, /owner/payroll | same paths | existing operational capabilities |
| Settings, Billing | /owner/settings, /owner/billing; Free equivalents | footer | existing account/plan boundaries |

Other full-suite destinations must remain reachable under their existing workflow predicates; their records are not Base worker/machine records and must not be merged.

## Dependencies and parity inventory

Setup is BaseProductionClient(view=setup) plus BaseSetupWorkspace. The loader reads the entire Base production graph (workers, machines, assignments, jobs, entries, salary, advances, settlements). There is no shared client query cache in this composition: server actions invalidate production and related paths; router.refresh replaces server props. Setup search/status are local state. Supported selectors are section=workers|machines, add=worker|machine, worker=UUID, returnTo; no supported hash/edit-record selector was found. worker focuses search, it does not automatically edit. Configuration supports worker and shift context.

Worker fields: id, name, shift_availability, is_active, pay_type, role, monthly_salary, salary_effective_from, salary_history, start_date, end_date, updated_at; rate_per_meter retained in read model. Create/edit handlers preserve optimistic timestamp, immutable compensation type, salary effective-date and paid-history rules. No delete button exists in the Base register. Inactive workers can be included. No sorting/pagination control exists (complete paginated server reads).

Machine fields: id, name, machine_type, custom_label, is_active. Blank new names use existing server-generated names. Existing machine types, duplicate validation, active toggle, and mutation restrictions remain authoritative. No delete button exists in this Base register.

Assignments use existing shift eligibility, effective dates, one worker per machine per shift, inactive/history handling and server actions. Tours use stable configuration IDs and opt-in local state; retain completion IDs. Production/payroll calculations and persisted identifiers are outside this refactor.

## Implemented composition and access

The shared definition is `lib/owner-navigation.ts`. Desktop navigation and the existing mobile drawer render the same ordered, expanded groups. Existing mobile quick links remain; there is no new bottom-tab system. Navigation filters capabilities before removing empty sections. The owner layout adds skip-to-content and a focus target; Radix Sheet supplies modal semantics. A small page-scoped title hook re-applies localized titles when delayed Next metadata updates the head; it disconnects on page unmount. Assignment summary counts respect explicit worker/machine context without changing eligibility or mutation maps.

Base order: Cost Estimate, Saved Costings, Yarn Rate Book; Production, Machine Assignments, Godown Stock, Dispatches, Machines; Workers, Payroll. Settings and Plan & Billing precede language, account identity, and Log out in the footer. Free retains account-required estimator and saved costings; Lite retains paid costing and rates. Neither gets operational links. Unresolved entitlement exposes no module links. Existing full-suite workflow predicates and legacy destinations remain intact.

**Route collision resolved:** `/owner/machines` already manages legacy full-suite machine records. Base accounts load their independent register there; canonical Base internal links include `?register=base`, so an old Base Setup bookmark continues to reach the same dataset even after an experience change. Full-suite navigation retains plain `/owner/machines` and `/owner/fixed-workers`; it does not newly expose Base-only workflows. No records are copied between the datasets.

Workers and Machines have independent server loaders, register components, loading/error boundaries, and tenant keys. They read only their own complete paginated dataset. Mutations reuse existing authorized actions and business validation; related production, assignment, payroll and canonical register invalidations remain coordinated. The old combined component is a small rollback adapter over the same extracted components.

Base management is owner-only under `production_management`; there is no separate authorized read-only Base register role in the current model. The existing owner/plan denial behavior applies rather than inventing a read-only entitlement. Both loader and mutation boundaries enforce access independently of navigation. Register query state contains only search/status/category/record context; compensation inputs are not serialized into URLs or analytics.

## Verification results

| Area | Status | Evidence / limits |
| --- | --- | --- |
| Baseline suite | Passed | 246 files; 1707 passed, 1 skipped, clean baseline `43ffd763f71a00789716b724784ec5e9729a31bd`. |
| Final regression suite | Passed | `npm test`: 249 files; 1736 passed, 1 skipped. Existing costing, payroll, production, access and billing regression tests included. This does not substitute for production E2E of those modules. |
| Navigation/loader/render tests | Passed | Shared order, Free/Lite/Base/full-suite visibility, precise active matching, localization keys, allowlisted legacy/return mapping, tenant-scoped independent reads, denied reads, error behavior, register isolation and filters. |
| Build / type checking | Passed | Final `NEXT_TELEMETRY_DISABLED=1 npx next build --webpack` completed, including TypeScript and all route generation. Final browser reloads confirmed localized page titles settle correctly after streamed loading. |
| ESLint | Failed strict zero-warning gate; no errors | All changed TypeScript files: two pre-existing `no-explicit-any` warnings at `app/actions/tour-preferences.ts:18,47` (confirmed in baseline). Earlier focused check and final-edit lint checks passed with zero warnings. `git diff --check` passed. Final browser console check returned no errors/warnings. |
| Worker add/edit | Passed | Piece-rate and fixed-salary NAVQA workers created and edited through browser; same identifiers retained. Salary zero rejected by native validation; pay-type conversion disabled. Salary role edit retained compensation. |
| Machine add/edit | Passed | NAVQA machine created via Save and return, custom label edited, then visible in assignments under same ID. |
| Assignment round trip | Passed | Worker → filtered assignments → add machine → Save and return retained worker/day context. Creation alone had zero assignments (SQL checked). Existing job prerequisite blocked assignment until a NAVQA job/context existed; explicit picker save then created one assignment. Machine → assignments showed that machine. Fixed-salary worker excluded from eligible selector. |
| Dirty dialog | Passed, limited | Dirty Cancel invoked discard warning; discarded edit did not persist. Keep-editing branch was not reliably controllable with browser tooling and remains a manual check. |
| Base/Lite browser access | Passed | Base grouped navigation and independent registers. Verified Lite session showed only costing/footer and direct Workers upgrade wall. Free and full-suite tested by automated capability tests, not fresh authenticated E2E. |
| Mobile 320 CSS px | Passed, limited | Same grouped drawer; footer visible with independently scrollable nav. Escape restored trigger focus. Successful Workers navigation closed drawer and focused main. Screenshots below. At 320×400, 20 forward and 20 reverse Tab stops all remained inside the modal drawer. 200% text and theme checks remain manual: the browser zoom shortcut did not change the rendered dimensions/font size in this automation surface. |
| Tours | Passed, limited | Entering new pages and filtered assignments did not launch a tour. Stable opt-in assignment launcher present. Automated existing tour tests passed; full manual tour traversal/history not rerun. |
| Legacy URLs / locales | Passed, limited | Plain Setup redirected to Workers; Setup `section=machines` redirected to Base Machines. Workers salary filter survived Back from Machines; Forward reopened Machines; refresh settled on the correct Machines title. Operations with an unavailable UUID and `shift=night` redirected to Assignments, preserved night, and showed a generic unavailable message. Hindi/Gujarati register, headings, links and grouped nav rendered; screenshots captured. Remaining selector permutations and sign-in return checks remain below. |
| Failures / environment | Resolved local build overlap; logout not verified | One legacy URL request during build regeneration hit a missing Next client-reference manifest. Local server was stopped for rebuild; the same legacy machine bookmark succeeded after restart. Existing Lite logout UI did not complete in the local test session; no production logout defect is asserted. |
| Native language review | Not run; existing runtime gaps observed | New navigation, headings, filters, summaries and return labels render in English/Hindi/Gujarati. Existing assignment action/drag labels still include partial English (for example Assign), and the pre-existing generic translator translates fragments of record names in the assignment board. Registers protect visible names. These existing localization defects are recorded for language review; no claim of complete native-language approval. |
| Broader security/business matrix | Not run as E2E | No destructive checks, settled payroll/payment writes, tenant switch, full Free allowance/upgrade, installed-PWA offline update, complete theme/reduced-motion or full-suite browser matrix. Existing automated coverage passes. Owner steps below identify remaining checks. |

## Authorized QA record audit

Actual target: Supabase `vzhwahudircrpgtitwzd` (Textile Saas). QA organization: **Base pilot testing**, `12b58c71-bf3f-445f-b3f2-51a7f22a5587`; owner role and active Base subscription verified. The app was local; its database was production. The user explicitly approved scoped NAVQA fixture writes after automatic review initially rejected the machine-save action. The approved retry succeeded.

| Fixture | Identifier | Operation |
| --- | --- | --- |
| NAVQA-0911 Piece worker reviewed | `72b1c79e-14e3-4f98-adfe-edd4d7470732` | Create piece-rate, then name edit. |
| NAVQA-0911 Salary worker | `43fe010d-213c-46ca-9d44-62cf0c0d588c` | Create fixed salary, then role edit to QA staff reviewed. |
| NAVQA-0911 Machine / Loom reviewed | `86749857-6125-474f-bfe5-3996d2a23207` | Create Other machine; edit custom label. |
| NAVQA job | `b4898e7f-8b20-4f62-970f-8e44e60d28f8` | One-metre prerequisite job, no recorded production. |
| NAVQA assignment | `c74a81cb-9f59-41cb-a930-58daa198cfb6` | Explicit day assignment of the NAVQA piece worker to the NAVQA machine. |

One new job with customer reference `NAVQA-0911 assignment prerequisite`, target 1 metre, was created from an existing isolated QA costing and selected only for the NAVQA machine. No production was recorded. Existing worker/machine/job records were not edited. No payroll settlement, payment, costing-version creation, migration, RLS change, dependency upgrade or deployment occurred. Fixtures remain for owner review; no destructive cleanup was performed.

## Screenshots

These are post-refactor local-build screenshots, not a pre/post visual comparison.

- [Workers desktop](screenshots/workers-desktop.png)
- [Machines desktop](screenshots/machines-desktop.png)
- [Assignments desktop](screenshots/assignments-desktop.png)
- [Save and return](screenshots/machine-save-return.png)
- [Mobile navigation at 320 px](screenshots/mobile-navigation-320.png)
- [Workers mobile at 320 px](screenshots/workers-mobile-320.png)
- [Lite direct-route denial](screenshots/lite-workers-denied.png)
- [Hindi Machines](screenshots/machines-hindi.png)
- [Gujarati Machines](screenshots/machines-gujarati.png)
- [Gujarati assignments](screenshots/assignments-gujarati.png)
- [Short-height mobile drawer](screenshots/mobile-short-height.png)

## Owner acceptance checks

Use the existing NAVQA records above in Base pilot testing. Do not test destructive changes on real factory records.

1. Open Workers, edit each compensation type, cancel a dirty form and choose Keep editing; confirm the draft remains. Confirm immutable pay type, salary effective-date and status restrictions. Exercise a recoverable failed save and retry using approved fixtures.
2. Open Machines, edit NAVQA custom label, reach its filtered assignments. From assignments open Manage workers / Manage machines, return, and confirm no automatic assignment save. Current Base payroll has a server-derived period (no period selector); its Manage workers return preserves that workflow. Legacy payroll cycle behavior is untouched.
3. Open `/owner/setup`, `?section=machines`, `?add=worker`, `?add=machine`, and `/owner/operations?worker=<NAVQA worker ID>&shift=day`. Verify direct loads, refresh, Back/Forward and sign-in return. No historical generic edit-ID/hash format existed to preserve.
4. Check Free/Lite operational denial and existing upgrade action opening the standalone plan chooser. Review full-suite legacy routes with an authorized full-suite QA account.
5. Review Hindi and Gujarati wording with fluent reviewers. Check 200% text, short-height sidebar scrolling, all supported themes, drawer Tab/Shift-Tab containment, Escape, dismissal focus and successful-navigation focus. Confirm installed PWA old bookmarks reach bridges online, then exercise its established offline behavior.
6. Verify tenant switch and stale-data/draft behavior using two authorized QA workspaces, without copying records. Recheck representative production/stock/dispatch/payroll and saved costing views read-only. Approve the local diff before any production deployment.

## Reversible rollback (no business-data rollback)

Keep this refactor commit and the baseline hash recorded before release. Do not revert database data or QA records as part of a navigation rollback.

1. Restore only `components/navigation/owner-sidebar.tsx` from baseline `43ffd763f71a00789716b724784ec5e9729a31bd` (for example, `git restore --source=<baseline> -- components/navigation/owner-sidebar.tsx`). This returns visible Setup and Configuration links and the prior mobile composition. Retain extracted components, canonical routes, mutation invalidation and shared record types.
2. Replace `app/(dashboard)/owner/setup/page.tsx` bridge with an owner/capability-checked server page that reads `section`, loads `loadBaseProductionInitialData(profile.org_id, getSuratTodayString())`, and renders the retained `BaseSetupWorkspace` with `initialSection` set to machines only for `section=machines` or `add=machine`. The adapter uses the same WorkersRegister/MachinesRegister and forms, so do not restore a second copy of old mutations. Keep the existing Setup AccessGate layout.
3. Replace `app/(dashboard)/owner/operations/page.tsx` bridge with `export { default } from '../assignments/page'`. Keep its existing gate. Assignments remains the implementation route; never redirect assignments back to operations while operations redirects forward. Thus both old and canonical URLs remain usable without a loop.
4. Keep `/owner/workers` and the Base branch of `/owner/machines` functional for already shared canonical links. Keep `LegacyMachinesPage` and the full-suite route branch. Do not blindly restore the old machines page: it would hide the Base register for canonical bookmarks.
5. Run the suite, production build, old/new direct URL and mutation-return smoke tests, then obtain rollout approval. Update navigation tests for the rollback’s intentionally restored labels. No permanent redirects or feature-flag infrastructure need clearing.

The rollback adapter preserves old composition through shared implementations; exact original UI styling can be reviewed separately without changing identifiers or data.



Exact Setup rollback page for step 2 (keep its AccessGate layout):

```tsx
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { getSuratTodayString } from '@/lib/time'
import BaseSetupWorkspace from '../production/BaseSetupWorkspace'
import { loadBaseProductionInitialData } from '../production/loaders'

export default async function SetupPage({ searchParams }: {
  searchParams: Promise<{ section?: string; add?: string }>
}) {
  const { profile } = await requireRole(['owner'])
  const access = await getCachedOrgPlanAccess(profile.org_id)
  if (!hasCapability(access.effectiveTier, 'production_management')) return null
  const params = await searchParams
  const initialData = await loadBaseProductionInitialData(profile.org_id, getSuratTodayString())
  return <BaseSetupWorkspace initialData={initialData}
    initialSection={params.section === 'machines' || params.add === 'machine' ? 'machines' : 'workers'} />
}
```

## Changed files

All source/test changes are listed below; screenshot artifacts are linked above. No package manifest, lockfile, migration or RLS file changed.

```text
__tests__/base-production-continuity.test.ts
__tests__/base-production-core.test.ts
__tests__/batch3a-owner-machines-server-loading.test.ts
__tests__/estimator-only-experience.test.ts
__tests__/free-plan-settings-billing.test.ts
__tests__/management-navigation.test.ts
__tests__/management-register-loaders.test.ts
__tests__/management-register-rendering.test.ts
__tests__/owner-analytics.test.ts
__tests__/ux-012-terminology-baseline.test.ts
app/(dashboard)/owner/assignments/error.tsx
app/(dashboard)/owner/assignments/layout.tsx
app/(dashboard)/owner/assignments/loading.tsx
app/(dashboard)/owner/assignments/page.tsx
app/(dashboard)/owner/layout.tsx
app/(dashboard)/owner/machines/LegacyMachinesPage.tsx
app/(dashboard)/owner/machines/error.tsx
app/(dashboard)/owner/machines/layout.tsx
app/(dashboard)/owner/machines/loading.tsx
app/(dashboard)/owner/machines/page.tsx
app/(dashboard)/owner/operations/loading.tsx
app/(dashboard)/owner/operations/page.tsx
app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx
app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx
app/(dashboard)/owner/production/BaseMachineJobs.tsx
app/(dashboard)/owner/production/BaseProductionClient.tsx
app/(dashboard)/owner/production/BaseSetupWorkspace.tsx
app/(dashboard)/owner/production/actions.ts
app/(dashboard)/owner/production/loaders.ts
app/(dashboard)/owner/production/registers/MachineEditor.tsx
app/(dashboard)/owner/production/registers/MachinesRegister.tsx
app/(dashboard)/owner/production/registers/WorkerEditor.tsx
app/(dashboard)/owner/production/registers/WorkersRegister.tsx
app/(dashboard)/owner/production/registers/loaders.ts
app/(dashboard)/owner/production/registers/normalize.ts
app/(dashboard)/owner/setup/loading.tsx
app/(dashboard)/owner/setup/page.tsx
app/(dashboard)/owner/workers/error.tsx
app/(dashboard)/owner/workers/layout.tsx
app/(dashboard)/owner/workers/loading.tsx
app/(dashboard)/owner/workers/page.tsx
app/actions/tour-preferences.ts
components/billing/AccessGate.tsx
components/navigation/owner-route-loading.tsx
components/navigation/owner-sidebar.tsx
hooks/use-localized-page-title.ts
lib/base-production-navigation.ts
lib/i18n/base-continuity-phrases.ts
lib/i18n/base-plan-phrases.ts
lib/i18n/configuration-tutorial.ts
lib/i18n/locales/en.ts
lib/i18n/locales/gu.ts
lib/i18n/locales/hi.ts
lib/i18n/tour-invitations.ts
lib/management-navigation.ts
lib/owner-navigation.ts
```
