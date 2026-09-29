# Weavly colour system — Phase 7 migration report

Date: 2026-09-29  
Branch: `claude/weavly-brand-colour-system-942ff8`  
Starting commit: `8425ed1d`  
Specification: [WEAVLY_COLOR_SYSTEM.md](./WEAVLY_COLOR_SYSTEM.md)

## Delivered

Migrated the remaining 22 TSX files plus `app/globals.css` (23 application files). Updated one existing test file deliberately. This report accompanies the Phase 7 implementation commit.

- **Admin:** `admin-ui.tsx`, admin page and layout. Cotton surfaces, Neel typography, semantic status colours, and selected tabs with Neel-50 fill and a 2px saffron marker.
- **Free plan / estimator:** `FreeUsageCard`, `FreeTransactionRecovery`, `BasePlanFactoryGlossary`, `FreeClient`, and `use-free-meter`. Remaining-allowance segments use Neel-600 on Cotton-300; pending/exhausted warnings use ochre, errors use madder, and activation uses moss. Recovery actions use Ink; glossary decoration is neutral/Neel.
- **Authentication:** verify, reset-password, forgot-password, confirm, auth-code-error, and logout. Errors and error input borders use madder; success feedback uses moss; labels and helper text use canonical text roles.
- **Marketing / legal:** landing header and root page, terms, privacy, refund policy, feature-archived, and locked-account page. The header keeps the spec's black marketing chrome, replaces gradient CTAs with flat saffron and Ink labels, and uses inverse text tokens. The locked-account page uses Paper and a white sheet, with madder reserved for the suspension warning; requesting an unlock is an Ink action. Legal table headers use Cotton-200.
- **Settings:** organization data-export page uses a white sheet, canonical panel border and text colours.

Obsolete `dark:` colour overrides were removed from the touched surfaces in favour of the canonical light palette. This does not introduce a dark theme or remove the existing global dark-theme scaffolding. Business logic, authentication, data access, translations, and tour anchors were preserved.

## Global CSS audit

The original broad scan matched 59 lines in `globals.css`. Four were intentional `--wv-stone-400` primitive/chart references. The other 55 were legacy palette selectors or their explanatory comment.

- Removed the raw grey/slate/zinc helper-text override now that its utility consumers have been migrated.
- Removed obsolete raw-palette branches from the contrast safety selectors. Retained their semantic/black-surface branches for light text on dark surfaces and light cards nested within dark containers; replaced their hard-coded slate text colours with canonical text tokens.
- Repointed ten compatibility aliases (`yarn-orange`, factory green, warning amber, risk red, info blue and their variants) at canonical primitives/semantics. These aliases still have estimator consumers, so deleting them would break those surfaces. Both yarn-orange aliases use readable Saffron-700, which supports existing light-surface text and white-label fills.
- Replaced the standalone PWA's old `#FFF8EA` background with the Paper canvas token, matching the manifest.
- Tokenized global selection, woven-grid lines, tour halo colours, and white tour borders.
- Kept canonical primitive literals, Indigo-based shadows, and the intentional black/white intro-stage treatment.

The requested broad legacy-family scan over tracked TS/TSX/CSS, excluding tests and docs, now returns **only four lines**, all intentional `--wv-stone-400` references in `globals.css`. There are **zero remaining legacy numbered Tailwind palette references** in application TS/TSX/CSS.

## Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed, exit 0; no TypeScript errors |
| `npx vitest run` with `RUN_LIVE_SUPABASE_TESTS` explicitly unset | Passed: 230 files; 1,981 tests passed, 1 skipped (baseline unchanged) |
| Direct Tailwind/PostCSS processing of `app/globals.css` | Passed; confirmed generated selected-surface, danger-text, control-border, allowance-fill and inverse-focus utilities |
| `git diff --check` | Passed |
| Legacy numbered palette scan | Only the four intentional Stone primitive/chart references remain |
| React best-practices review | Styling changes preserve component boundaries, hook execution, event handlers, accessible names, disclosure/meter semantics, and list keys |

`__tests__/free-usage-counter.test.ts` now counts Neel-600 filled segments and Cotton-300 track segments instead of Stone utility names. Assertions still verify the 2/2, 1/2, and 0/2 balances, exhausted state, loading/error states, and accessible meter values; they were not relaxed.

## Verification limits and remaining scope

No browser or authenticated visual verification was performed. No build/start command, Supabase CLI mutation, shared-QA sign-in, or live database test was run. CSS processing ran directly through PostCSS without starting Next.js or loading application environment files.

Completing this utility scan does not prove every historical arbitrary hex or inline colour across the repository is migrated. Existing estimator compatibility-alias consumers may still need a contextual action/hover audit; this phase canonicalizes their values rather than rewriting those earlier-phase components. PDF/export colour handling and a complete dark-theme design remain outside this phase. The specification's original discovery-status statements describe its initial audit, not the current migration state.
