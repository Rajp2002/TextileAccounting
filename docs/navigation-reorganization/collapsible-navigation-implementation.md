# Base collapsible navigation

## Final scope

The user's later clarification supersedes the original brief's Free exception: **only effective Base navigation receives disclosures**. Free retains Cost Estimator and Saved Costings as flat links; Lite retains those plus Yarn Rate Book. Legacy trial/premium navigation remains flat. This is presentation policy only; existing feature grants and trusted authorization checks are unchanged.

## Actual route map and prerequisites

| Group | Child | Base destination | Compatibility |
| --- | --- | --- | --- |
| Costing | Cost Estimator | `/owner/estimator` | Free retains `/free` |
| Costing | Yarn Rate Book | `/owner/rates` | Lite remains a flat link |
| Costing | Saved Costings | `/owner/quotes` | Free retains `/free/costings` |
| Stock | Fabric | `/owner/stock` | Existing default/bookmark retained |
| Stock | Yarn | `/owner/stock/yarn` | Existing separate page retained |
| Workforce | Workers | `/owner/workers` | Worker-only register already exists; legacy `/owner/fixed-workers` remains unchanged |
| Workforce | Payroll | `/owner/payroll` | Existing cycle and settlement state preserved |

All seven navigation destinations have distinct paths. Stock does not need a query selector, canonicalization or new routes. Existing page queries are preserved when selecting the current listing; nested paths remain distinct from their listing destination. No business module, calculation, stock action, payroll operation, dependency or schema was changed.

## Implementation map

- `lib/disclosure-navigation.ts`: transforms the existing permission-filtered navigation into Base groups, provides the Base-only presentation gate, exact-page matching and local state transitions. Original Production/Account destination order remains intact. Legacy workforce extras remain in place.
- `components/navigation/navigation-disclosure.tsx`: reusable native button/nested-link renderer for all three groups. Replaces the earlier Stock-specific component. Unique IDs, hidden child lists, active styling independent of expansion, current-location semantics, Escape focus return, native modified-click handling and 44px minimum targets.
- `components/navigation/owner-sidebar.tsx`: one-open-group state per navigation surface, commit-based pathname reset, same-page drawer dismissal, breakpoint reset, shared compact/mobile group definitions and Sheet Escape priority. Parent controls do not navigate to a default page. Existing account footer remains.
- `app/(dashboard)/owner/layout.tsx`: keys the sidebar by organization/user/effective tier to discard stale navigation state on workspace/access change; page content is not keyed by disclosure state.
- `lib/owner-navigation.ts`, `lib/stock-navigation.ts`: retain the original permission and route definitions, Stock label and common Stock route ownership.
- `app/(dashboard)/owner/stock/layout.tsx`, `StockNavigation.tsx`: Base removes the in-page category links; legacy flat navigation retains them so Yarn remains reachable. Existing cached session/access resolution decides presentation inside the unchanged production AccessGate.
- `StockPageTitle.tsx`, stock `loading.tsx`, `error.tsx`: localized category titles through loading/error states. Existing stock clients and server pages remain separate and unchanged.
- `lib/i18n/locales/{en,hi,gu}.ts`, `lib/i18n/yarn-stock.ts`: translated navigation labels and stock headings. Duplicate loading keys from the earlier patch were found by type checking and removed; existing loading keys are reused.
- `__tests__/disclosure-navigation.test.ts`, `navigation-disclosure.test.tsx`, `stock-navigation.test.ts`: grouping scope/order, visibility, state transitions, route ownership, exact-vs-detail matching and component semantics.
- `scripts/qa/navigation-browser/`: isolated Vite fixture rendering the actual sidebar, Sheet, translations and CSS. Router transitions are simulated; logout and image rendering are fixture adapters. No production authentication, business APIs or business data are used.

No affected navigation-selector references were found in the inspected tour registry/components. No tour launch behavior was added.

## Interaction and state

The shell stores one optional group ID, independently from the committed pathname. Parent toggles affect only that state. A different committed pathname clears it. A cancelled/uncommitted transition retains it. Same-list selection prevents redundant navigation and returns focus to the parent (or dismisses the drawer on mobile), preserving existing query filters and page state. Native modified clicks are not intercepted. Opening groups does not mount business pages or eagerly prefetch child routes.

Stock uses its existing loading boundary. The drawer closes on a committed path change and sends focus to main; ordinary dismissal returns focus to the trigger. Escape first collapses a focused expanded group, then follows Sheet dismissal. Breakpoint changes reset expansion and dismiss the mobile drawer when entering desktop.

## Verification evidence

- `node node_modules/vitest/vitest.mjs run __tests__/navigation-disclosure.test.tsx __tests__/disclosure-navigation.test.ts __tests__/stock-navigation.test.ts __tests__/management-navigation.test.ts --maxWorkers=1`: **54 tests passed, 4 files**.
- Focused ESLint with `--max-warnings=0` covered navigation components, grouping logic, owner/stock layout wrappers, tests and fixture; passed before the final small Base-only no-op guard. Final check recorded below.
- `git diff --check`: passed.
- Repository-wide `tsc --noEmit` ran approximately ten minutes without completion and was stopped. A scoped tsconfig extending the repository config was used for affected files; it caught the duplicate locale keys, which were corrected. Final result recorded below.
- `node node_modules/vitest/vitest.mjs run --maxWorkers=2`: stopped after several minutes without completed test output. It is not passing evidence. The earlier Stock turn's separate job-summary test timed out; no clean-checkout baseline is claimed.
- Broad build/lint results are recorded below; incomplete checks remain release gates.

### Actual browser fixture checks

Verified in the in-app browser at `http://127.0.0.1:4187/owner/stock` and simulated destination paths:

- Base starts collapsed; Costing order is Estimator, Rate Book, Saved Costings.
- Opening Stock closes Costing without changing the displayed page.
- Yarn and Payroll selections change the fixture destination and collapse the group; reopening and same-page Yarn selection work.
- A typed fixture draft survives toggling and same-page selection.
- Blocking the fixture router before commitment leaves the old route/draft/group available; Escape collapses and focuses the parent.
- Free shows two flat feature links; Lite shows three flat feature links; no Base groups appear for either.
- At 390×844, the drawer opens with collapsed groups; Space expands the focused parent; Saved Costings selection closes the drawer and focuses main; reopening resets groups.
- First Escape collapses Stock while keeping the drawer open; next Escape closes the drawer and focuses its trigger.
- Gujarati and Hindi labels render in the actual sidebar and mobile drawer. Inline screenshot evidence was captured in the task: collapsed desktop Yarn-active navigation, Gujarati mobile Costing expanded, Hindi mobile Workforce expanded.

These are **component fixture results**, not authenticated Next router, real estimator drafts, payroll/stock operations, screen-reader certification or release sign-off. No baseline production screenshots were taken. The screenshot matrix is partial; remaining authenticated category screenshots, native new-tab checks, full high-contrast/reduced-motion checks and real guard flows remain review gates.

## Rollback

Revert this focused navigation patch, including its Stock presentation wrappers and locale changes. Preserve unrelated working-tree changes. There is no database/data rollback and no production deployment was performed.

## Final verification results

- Scoped TypeScript: `node node_modules/typescript/bin/tsc --project /tmp/grouped-tsconfig.json` **passed** after duplicate locale keys were removed. The temporary config extends the repository tsconfig, disables incremental output, and includes the affected sidebar/disclosure, grouping library, Stock wrappers, grouping test and fixture entry; imported dependencies are checked normally. This is not a repository-wide type-check pass.
- Final focused ESLint: `node node_modules/eslint/bin/eslint.js components/navigation/owner-sidebar.tsx __tests__/navigation-disclosure.test.tsx lib/i18n/locales/en.ts lib/i18n/locales/gu.ts lib/i18n/locales/hi.ts --max-warnings=0` **passed**. The earlier focused pass covered the other changed files and fixture.
- Production build: `node node_modules/next/dist/bin/next build --webpack`, bounded to 180 seconds, reached optimized compilation and **timed out**. No completed build or release sign-off is claimed.
- Repository ESLint: `node node_modules/eslint/bin/eslint.js --max-warnings=0`, bounded to 90 seconds, **timed out** without a completed result.
- Additional fixture browser checks: Rate Book selection opens its Costing destination; browser Back restores Saved Costings with all groups collapsed. A middle-click leaves the originating route/group unchanged; creation of a second tab was not confirmed.
- Temporary browser viewport overrides were reset; the fixture server was stopped after verification.

## Cloud validation follow-up

PR #117 cloud validation passed 1,767 tests (17 skipped) and compiled successfully, then caught an owner-layout key using `profile.id` instead of the authenticated `user.id`. The key was corrected before merge. Production migration history was checked against all 291 repository migrations; none are pending.
