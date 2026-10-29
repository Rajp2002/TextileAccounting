# Lite page loading, 2026-10-29

A third pass on the Lite pages (estimator, Saved Costings, Rate Book, Settings, Billing), after the two passes in `docs/performance/latency-20261028/`. Those passes timed full page loads; this one also times the server actions each Lite page sends right after it hydrates, which is where most of the remaining waiting was.

## Headline

| What | Before | After |
| --- | ---: | ---: |
| Every server action on a signed-in page | re-rendered the whole layout and page into its response and cleared the browser's router cache | returns only its result |
| Estimator saved qualities and rate badges (`getEstimatorSecondaryData`), harness | 276 ms, 19 backend calls, 8 waits | 128 ms, 9 calls, 4 waits |
| Rate Book usage (`getCostRateUsage`) | 203 ms, 14 calls | 127 ms, 6 calls |
| Settings company profile (`getDocumentBrandingSettings`) | 234 ms, 13 calls | 158 ms, 8 calls |
| Settings costing defaults | a separate action after hydration (170 ms, 11 calls), and the defaults card kept its fallback values (0% wastage, 10% margin) | in the page's HTML |
| Settings account email | a browser call to Supabase Auth after hydration | in the page's HTML |
| Estimator page content (the post-sign-in landing page), harness | 108 ms | 86 ms |
| Saved Costings for a Lite trial account (every new account) | 134 ms, 4 waits | 108 ms, 3 waits |
| Settings first-load JS | 439.0 KB gzip | 414.2 KB gzip |

Harness numbers: 30 ms per Supabase call, 10 ms per Redis call, median of 7. Waits and calls do not depend on the modelled delay.

## How it was measured

The harness from the previous pass (`scripts/performance/signed-in-latency/`: production build with `isolated-command.mjs`, `next start`, fake Supabase/Upstash, ES256 sessions), with these additions:

- **Server actions** (`run.mjs` routes with `action`): POSTed as the browser sends them (`Next-Action` header, the action id from `.next/server/server-reference-manifest.json`), with the `last_activity` cookie the page load just renewed. `responseBytes` records the body size. `--stale-activity` sends them without that cookie, which reproduces the old Proxy behaviour on the new build.
- **A Lite trial account** (`fixtures.mjs` `trial`): a three-month trial row and the dormant Free grant every new account gets. One saved quality for the Lite account, so the saved-quality read also reads its latest costing.
- **Page content** (`contentMs`): when the streamed HTML first carries `data-route-primary-usable="true"`, the page's own route milestone (loading skeletons render `false`). It separates the page's content from the sidebar, which streams on its own.
- **Phone** (`phone.mjs`): counts the server actions each load sends and how many came back re-rendered (`x-action-revalidated`), with when the last one finished. `--ab <checkout>` serves a second build on the next port and alternates every sample between the two, so both see the same CPU state.

Baseline: `main` at `6a65965`, built in a separate worktree. `baseline.json` and `after.json` are the server runs; `after-stale-activity.json` is the new build with the old cookie behaviour; `phone-ab.json` is the alternating phone run (390x844, CPU slowed 4x, 7 samples per build).

```bash
node scripts/performance/isolated-command.mjs bash -c 'node scripts/reset-build-type-cache.mjs && ./node_modules/.bin/next build --webpack'
node scripts/performance/signed-in-latency/run.mjs docs/performance/lite-load-20261029/after.json --iterations 7 --only "lite:,trial:"
node scripts/performance/signed-in-latency/compare.mjs docs/performance/lite-load-20261029/baseline.json docs/performance/lite-load-20261029/after.json --js
node scripts/performance/signed-in-latency/phone.mjs docs/performance/lite-load-20261029/phone-ab.json --samples 7 --ab <baseline checkout> --only lite:/owner/estimator,lite:/owner/quotes,lite:/owner/settings
```

In this container the build needed `NODE_OPTIONS=--max-old-space-size=10240` (the default heap ran out) and, for `next/font/google`, `NODE_EXTRA_CA_CERTS` and `HTTPS_PROXY` set inside the isolated command. `npm ci` needs npm 11 (`npx npm@11.6.2 ci`); npm 10 rejects the lockfile.

## Findings and changes

### 1. Every server action re-rendered its page (Proxy's activity cookie)

Proxy renews the `last_activity` cookie on every signed-in request. Next 16 merges cookies set by Proxy into a server action's own cookie store (`mergeMiddlewareCookies` in `next/dist/server/async-storage/request-store.js`), and a cookie set there counts as the action changing cookies (`MutableRequestCookiesAdapter` sets `pathWasRevalidated`). So every action that reads cookies, which is every action that creates a Supabase client or calls `requireRole`, was treated as revalidating:

- the server re-rendered the whole owner layout and page after the action (identity, plan, organization, sidebar and page reads again: about 4 more waits and 8 more calls) and sent that RSC payload back (about 25 KB per action);
- the response carried `x-action-revalidated: 1`, so the browser re-applied the page tree and dropped its router cache, including the sidebar's prefetches.

The estimator, Rate Book and Settings each send read-only actions as soon as they hydrate, so every Lite page load paid this. `phone-ab.json` shows it in the browser: before, every load's action came back re-rendered (estimator 1 of 1, Settings 1–2 of 1–2); after, none.

**Change** (`proxy.ts`): a server action (a POST with `Next-Action`) renews a timestamp younger than five minutes no longer. Page loads, navigations and API requests renew it as before. The one-hour inactivity sign-out can therefore only happen sooner, by at most five minutes, never later. A stale, missing, unreadable or future timestamp is still renewed. Tests: `__tests__/proxy-terminal-session-recovery.test.ts`.

**What relied on the accidental revalidation.** `next.config.ts` keeps pages visited in the last 30 seconds (`staleTimes.dynamic`) and clears them when an action revalidates. Mutations that never called `revalidatePath` were clearing that cache only through this cookie. Every server-action module was checked:

- `saveEstimatorQuoteV3` (the costing save) now revalidates `/owner/quotes`, replays included, so a new costing shows at once on Saved Costings. The costing-to-Rate-Book trigger was dropped in `20260906210000`, so nothing else it changes is server-rendered.
- `saveBaseOnboardingDraftAction` and `saveBaseOnboardingFactoryAction` now revalidate `/onboarding/base`, since the wizard opens from the saved draft.
- Every other mutation already revalidates (directly, through `setCostRateActive`, or through `revalidateNextPath`), or the screen it changes is client state (supervisor access, logo candidates, export history), or it changes cookies itself (`recordTourEventAction` via `auth.updateUser`).

### 2. The estimator's deferred data verified the owner twice

`getEstimatorSecondaryData` called the `getEstimatorTemplates` action, which ran `requireRole` again (React's request cache does not apply inside server actions) and read the plan only after the saved qualities. It now verifies once and passes the org to `readEstimatorTemplates`, which reads the plan alongside the qualities. `getEstimatorTemplates` (the refresh after a save) gets the parallel plan read too.

### 3. Settings fetched its own data after hydrating

Settings requested the factory cost profile through a server action and the account email through a browser call to Supabase Auth, both after hydration, and actions run one at a time, so the company-profile action waited behind the cost profile. The defaults card also initialises its form from its first props (`useState`), so it kept the fallback defaults even after the real ones arrived.

**Change**: the Settings layout reads the cost profile and passes the defaults columns and the verified email in the Settings bootstrap; the page uses them as `initialData` and skips the Auth call. The read starts in the layout ahead of `AccessGate`, and `getFactoryCostProfile` starts its two reads with Proxy's session hint while `requireRole` verifies the identity (used only for the same user and org; RLS limits them to the caller's org either way). The estimator page starts the same read before its identity check, so its content no longer waits a round trip after it.

A first version read the profile only after the identity check. That moved Settings' content one round trip later, and on the slowed phone it more often landed behind the first long script task: LCP went from 1,328 ms to about 1,900 ms. Starting the read early removed that (1,320 ms in `phone-ab.json`).

### 4. Saved Costings checked prior Free costings after everything else

A Lite owner who started on Free sees those costings on Saved Costings, and every trial account has a (dormant) Free grant, so the page read the grant and then counted its costings, after all other reads. Both reads now start with Proxy's session hint and run with the page's other reads (request-cached by org; used only for the verified org).

### 5. Settings shipped the Base-only cards to Lite

`PlanAwareSettingsView` imported the payroll-cycle and supervisor cards statically. They now load with `next/dynamic` and render on Base only; neither carries a tour anchor. Settings first-load JS: 439.0 → 414.2 KB gzip (Free's account page shares the view).

## Results

### Server (`baseline.json` → `after.json`)

| Account | Route | Page content ms | Full page ms | Waits | Calls | First-load JS (KB gz) |
| --- | --- | --- | --- | --- | --- | --- |
| lite | `/owner/estimator` | 108.4 → 85.8 | 109.7 → 104.7 | 3 → 3 | 8 → 8 | 464.3 → 464.9 |
| lite | `/owner/quotes` | 106.5 → 107.9 | 108.6 → 110.3 | 3 → 3 | 9 → 9 | 400.4 → 400.6 |
| lite | `/owner/rates` | 108.2 → 106.5 | 109.3 → 107.6 | 3 → 3 | 9 → 9 | 332.2 → 332.8 |
| lite | `/owner/settings` | 74.9 → 77.0 | 101.5 → 99.2 | 3 → 3 | 6 → 8 | 439.0 → 414.2 |
| lite | `/owner/billing` | 115.7 → 109.7 | 116.3 → 110.8 | 3 → 3 | 10 → 10 | 293.9 → 293.9 |
| trial | `/owner/estimator` | 102.7 → 74.8 | 103.9 → 98.6 | 3 → 3 | 8 → 8 | |
| trial | `/owner/quotes` | 133.6 → 108.4 | 134.1 → 109.4 | 4 → 3 | 10 → 10 | |
| trial | `/owner/settings` | 66.8 → 75.6 | 95.0 → 101.9 | 3 → 3 | 6 → 8 | |

Owner pages stay at 3 waits because the sidebar's yarn-review read is the third; the page content is what moved. The estimator's first byte is about 13 ms later (69.6 → 82.9) because its content is now ready in time for the first flush, so the first bytes carry the page instead of the skeleton. Settings' content time is unchanged within noise while now carrying the defaults and email.

### Server actions (`baseline.json` → `after-stale-activity.json` → `after.json`)

The middle column is the new build with the old cookie behaviour: the action changes alone.

| Action (page) | Before | Action changes only | After |
| --- | --- | --- | --- |
| `getEstimatorSecondaryData` (estimator, on hydration) | 276 ms, 19 calls, 8 waits | 205 ms, 16 calls, 6 waits | 128 ms, 9 calls, 4 waits |
| `getEstimatorTemplates` (estimator, after a save) | 237 ms, 14 calls, 7 waits | 202 ms, 14 calls, 6 waits | 128 ms, 7 calls, 4 waits |
| `getFactoryCostProfile` (Settings before this change; estimator fallback) | 170 ms, 11 calls, 5 waits | 134 ms, 13 calls, 4 waits | 63 ms, 6 calls, 2 waits |
| `getDocumentBrandingSettings` (Settings, on hydration) | 234 ms, 13 calls, 7 waits | 233 ms, 15 calls, 7 waits | 158 ms, 8 calls, 5 waits |
| `getCostRateUsage` (Rate Book, on hydration) | 203 ms, 14 calls, 6 waits | 199 ms, 14 calls, 6 waits | 127 ms, 6 calls, 4 waits |

Response bodies before were 25–27 KB each (the re-rendered page); after, only the result.

### Phone (`phone-ab.json`, alternating, medians of 7)

| Route | Actions re-rendered | Last action done | Usable | LCP | FCP | Total blocking |
| --- | --- | --- | --- | --- | --- | --- |
| lite `/owner/estimator` | 1 of 1 → 0 of 1 | 3,020 → 2,909 | 2,425 → 2,342 | 1,812 → 1,716 | 392 → 452 | 1,266 → 1,211 |
| lite `/owner/settings` | 1–2 of 1–2 → 0 of 1 | 2,415 → 2,226 | 1,851 → 1,807 | 1,328 → 1,320 | 312 → 304 | 862 → 819 |
| lite `/owner/quotes` (control: no change for this account) | none | | 1,757 → 1,642 | 372 → 320 | 292 → 320 | 689 → 663 |

(ms.) Saved Costings for this account has no server or bundle change, so its difference is the noise floor here: about ±100 ms. "Last action done" is when the estimator's saved qualities and Settings' company profile arrive. The estimator's first paint is later because its first bytes now carry the page rather than the skeleton (see above). Before, in 3 of 7 estimator samples the coverage shows the browser loading the 329 KB estimator chunk a second time while it applied the re-rendered page (about 2,000–2,100 KB of JS instead of 1,478 KB); after, in none.

## Checks

`npx tsc --noEmit` clean, `npx vitest run` 421 files / 4,225 passed / 1 skipped (the gated live Supabase test), `npm run lint` clean (0 warnings). `npm run test:db` was not run (no change to migrations or SQL).

## Not verified

- Nothing against real Supabase or Vercel; per-call latency in production is not known. Waits, calls and re-renders are exact; milliseconds come from the 30 ms model.
- No real phone; the phone numbers are Chromium with the CPU slowed 4x and no network throttling. On a real mobile network each removed request (the Settings Auth call, the action round trips) saves a network round trip on top.
- The Proxy change was exercised in unit tests and through the harness; the five-minute renewal window was not observed over a real hour of use.
