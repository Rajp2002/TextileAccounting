> Superseded by [Base collapsible navigation](./collapsible-navigation-implementation.md). The final implementation groups only Base navigation and retains legacy Stock category links.

# Stock sidebar refinement

Implemented locally; production deployment and complete release verification are outstanding.

## Destinations and state

- Fabric Stock remains `/owner/stock` (existing default and legacy destination).
- Yarn Stock (`/owner/stock/yarn`) was deleted on 2026-10-14; Stock is a plain sidebar link to Fabric again.
- Both retain their existing separate server pages and stock clients.
- `lib/stock-navigation.ts` defines category destinations and the common pathname resolver.
- Stock starts collapsed. Disclosure state belongs to each navigation surface, independently of active-route styling.
- A committed pathname change collapses the disclosure; cancelled/uncommitted navigation does not. Current-list selection preserves filters and history, collapses, and dismisses the mobile drawer. Modified clicks retain native link behavior.
- Existing stock loading boundary remains, with a category heading; route-owned localized titles persist through loading/errors.

## Changed-file responsibilities

- `components/navigation/stock-disclosure.tsx`: accessible Stock button, child links, selection, Escape, focus, native modified clicks, reduced motion; child prefetch disabled so opening the group does not start stock fetches.
- `components/navigation/owner-sidebar.tsx`: shared desktop/mobile rendering, same-page drawer dismissal, Sheet Escape coordination, Stock quick-link fallback opens the drawer.
- `lib/owner-navigation.ts`: Stock label and shared route matching; existing placement/access filtering retained.
- `lib/stock-navigation.ts`: shared destination/category definitions.
- `app/(dashboard)/owner/stock/layout.tsx`: remove page selector and mount localized document-title owner.
- `app/(dashboard)/owner/stock/StockPageTitle.tsx`: localized route-specific browser title.
- `app/(dashboard)/owner/stock/StockNavigation.tsx`: deleted obsolete category selector.
- `app/(dashboard)/owner/stock/loading.tsx`, `error.tsx`: category-specific loading/error headings and localized loading announcement.
- `lib/i18n/locales/en.ts`, `hi.ts`, `gu.ts`: Stock/category labels and Fabric heading.
- `lib/i18n/yarn-stock.ts` (deleted 2026-10-14 with Yarn Stock).
- `__tests__/stock-navigation.test.ts`: destination matching, adjacency isolation, preserved URLs and locale coverage.

## Access and preserved behavior

Both stock action modules currently require the production capability and owner role; writes additionally require a writable organization. Existing layout AccessGate and sidebar workflow filtering remain. There are no separate category entitlements in the inspected implementation. No backend, inventory action, migration, dependency, billing, stock-client state, or business-operation changes were made. No selector references were found in the inspected tour registry.

## Verification

- `npx vitest run __tests__/stock-navigation.test.ts __tests__/management-navigation.test.ts --maxWorkers=1`: 31 tests passed, two files.
- Repeated using `node node_modules/vitest/vitest.mjs run __tests__/stock-navigation.test.ts __tests__/management-navigation.test.ts __tests__/base-job-summaries.test.ts --maxWorkers=1`: navigation files passed again; 34 passed overall, one job-summary test timed out at 5000ms. That test and its implementation are unchanged; a clean-checkout baseline was not run, so this is not claimed as a proven pre-existing failure.
- Focused ESLint covering changed navigation, route wrappers, resolver and test: passed. Separate lint of stock loading component: passed.
- `git diff --check`: passed.
- `npm test` / `npm run build`: broad suite attempts did not complete; the former reported the same job-summary timeout. They are not passing evidence.
- Direct `next build --webpack`: reached optimized compilation, then stopped after several minutes without a final result. Build remains unverified.
- Browser: initial local server bind was sandbox-blocked; approved retry started. Browser connection timed out. Server eventually returned the login page. No authenticated stock interaction or screenshots were verified.

## Remaining review gates

Complete full type check, repository lint and production build. Run authenticated desktop/mobile navigation, keyboard/focus, native new-tab interactions, Back/Forward, loading failures, three-language layout, zoom/reduced motion and permission checks. Capture the requested screenshot matrix. Existing stock operations were not exercised against live inventory.
