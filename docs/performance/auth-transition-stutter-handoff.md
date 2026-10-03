# Handoff: sign-in animation stutters while the workspace loads

Written 2026-10-03 for the next session (Claude Opus 5.5). Branch: `claude/signin-signout-redirect-delay-4fb5a6`. Read this whole file first; it is meant to replace the conversation that produced it.

## Outcome (2026-10-03, later the same day)

Fixed by making both marks compositor-driven, with the same look (owner approved the approach after checking a side-by-side probe in desktop Safari):

- **Cause, measured.** Production (desktop Safari, after #176): the workspace is hydrated and painted 826 to 1,145 ms after the click, well inside the 1.6 s round. The stutter is the few hundred ms of script and hydration mid-round. The marks animated `stroke-dashoffset` and SVG-part transforms; Safari runs all of that on the main thread (WebKit's layer-based SVG engine is still off by default), Chromium runs the SVG transforms on the compositor but not the dashes. With the main thread busy for 1.5 s in headless Chromium, the old loom's shuttle kept moving over bare warp and the old spool stopped laying wraps; the rebuilt marks kept going.
- **Fix.** `components/auth/thread-marks.tsx` draws the marks as SVG on HTML layers and moves only the layers, by `transform` or `opacity`. Picks are laid by a bar sliding into a clip shaped like the finished pick (its end stays under the shuttle); the spool's newest wrap is uncovered by a half-plane riding the thread's end, square to it (`spoolLayFrames()` in `spool-geometry.ts`); the twist steps through eight dash phases. Frame-by-frame against the old marks, at most 0.9% (loom) and 0.33% (spool) of pixels differ, all antialiasing. `__tests__/auth-transition.test.tsx` fails if a mark keyframe animates anything but transform/opacity, if an animated class lands on an SVG element, if the lay keyframes drift from the geometry, or if the twist ever shows no phase.
- **Measuring note.** `frame-gaps.mjs` counts `requestAnimationFrame` frames, which are main-thread frames: they cannot show whether a compositor animation is smooth and will look the same before and after this fix. To see what reaches the screen, use Chromium's screencast (`Page.startScreencast`) during a busy loop, or a screen recording on Safari.
- **Not done (not needed on desktop Safari).** The overlay still closes on a main-thread timer at 1.6 s; if a slow phone is still hydrating then, the lift is late (the marks keep moving smoothly meanwhile). Deferring workspace startup work was not pursued.

## Paste this to start the session

> Continue the work on branch `claude/signin-signout-redirect-delay-4fb5a6` (Weavly, a Next.js PWA). Read `docs/performance/auth-transition-stutter-handoff.md` completely before doing anything else. The one problem to solve: the sign-in animation stutters while the workspace loads and hydrates behind it. Brainstorm first (use the brainstorming skill), start by measuring, and bring me options with a recommendation before changing any design or doing anything large. Do not commit, push or merge until I ask.

## The one problem

When the owner signs in, a full-screen overlay plays a small loom animation (one 1.6 s "round"). The next page (the owner workspace, `/owner/estimator` or `/free`) loads behind it, then the overlay lifts. The owner's report after testing on desktop Safari in production:

- Log out is "super clean".
- Sign-in is "laggy": the animation is not fluid because the workspace is hydrating behind it. ("In the back you can see everything hydrating.") The owner's stated priority: **fix the stutter.**

What the owner wants overall (their words, condensed): the sign-in/sign-out request and the next page's load run in parallel with the animation; the animation always plays one full round; the moment the round ends they are on the next page, with no still tail after it and no cutting the round short; and it feels professional and fluid.

## What exists now (this branch, last commit `fa1419e4`)

Sign-in and log out cross the auth boundary with a deliberate **full-page navigation** (do not replace it with a client-side router transition; the repo comments and `CLAUDE.md` explain why: cookies, Safari/PWA stalls, and cache isolation on log out). To keep the overlay across that navigation, the page being left hands it to the next page:

- `components/auth/auth-handoff.ts`: `captureAuthHandoff(startedAt)` stores `overlay.outerHTML` plus the epoch time the round began in `sessionStorage` (`weavly:auth-handoff`) just before `location.replace`. `buildAuthHandoffScript()` returns the inline script that rebuilds it on the next page.
- `components/auth/auth-handoff-script.tsx`: server component that renders that script as the first child of `<body>` in `app/layout.tsx`, so it runs before first paint. It validates the stored markup, inserts it inside a `<weavly-handoff>` element (see gotchas), sets `data-resumed`, puts every looping CSS animation on the frame the round has reached (`currentTime = elapsed`), finishes the one-time entrance animations, and closes the overlay exactly 1.6 s after the click (180 ms fade, then removes it and clears storage).
- `app/(auth)/login/login-form.tsx`: after `signIn()` succeeds it does `flushSync(() => setIsRedirecting(true))` (so the overlay shows the "signed in" copy), writes the sign-in telemetry trace, calls `captureAuthHandoff(transitionStartedAt)`, then `window.location.replace(redirectTo)`. No waiting for the round.
- `components/auth/logout-button.tsx`: POSTs `/auth/signout` immediately (`fetch`, `redirect: 'manual'`, so the 303's Set-Cookie still clears the session), then as soon as that returns calls `captureAuthHandoff` and `location.replace('/login')`.
- `components/auth/auth-transition.tsx` (the overlay), `thread-marks.tsx` (the loom and spool SVG marks), `auth-transition-timing.ts` (`AUTH_TRANSITION_ROUND_MS = 1600`, `AUTH_TRANSITION_LEAVE_MS = 180`, must match `--auth-round` and the leave animation in `app/globals.css`).
- `app/globals.css` (search "Auth transition"): the overlay is 90% see-through with a 6 px backdrop blur by default. The newest commit makes a **handed-over sign-in** overlay solid (`.auth-transition[data-resumed][data-mode="sign-in"]`: solid canvas, no blur, `will-change: opacity`) so the hydrating page is not visible through it. Log out keeps the see-through look and is unchanged.
- Tests: `__tests__/auth-transition.test.tsx` (26 tests, includes running the inline script against stand-ins). Baseline at `fa1419e4`: `npx vitest run` = 270 files, 2384 passed, 1 skipped; `npx tsc --noEmit` and `npm run lint` clean.

## History, so you do not repeat it

| Commit / PR | What it did | Why it was not enough |
| --- | --- | --- |
| `9c62b09b` | Held sign-in/out until one full 1.6 s round had played, then navigated. | The page load (0.5 to 1 s) ran after the round: a still tail. |
| `ffb34fcf` (#175) | Started the navigation one learned page-load early so the next page would land as the round ended. | Failed. The browser swaps the next document in as soon as it can paint, well before its content or hydration, and that moment differs per browser. Production logs from desktop Safari showed the page change at about 55% (sign-in) and 78% (log out) of the round, so the animation was cut short. **Timed redirects cannot work; do not try again.** |
| `002efdb6` (#176) | The handoff above: navigate immediately, resume the overlay on the next page. | Fixed the cut and the tail. Left the stutter and a visible hydrating page behind a see-through overlay. |
| `fa1419e4` (this branch, not merged to `main`) | Solid, unblurred overlay for sign-in. | Hides the hydrating page. Does not fix the stutter (below). |

`main` is at `52cd7db5` (includes #176). `fa1419e4` and the harness/doc commit after it exist only on this branch.

## What is known about the stutter

Evidence, with its limits:

1. **It is the main thread, not the look.** `docs/performance/auth-transition-harness/frame-gaps.mjs` (Chromium, 4x CPU throttle, landing page under the handed-over overlay, `next dev`) drew the same ~5 animation frames in the 1.6 s window with and without the blur/transparency, with the same longest frame gap (~367 ms) and ~3.3 s of long tasks. So removing blur/transparency changes what you see, not how smooth it is. Those numbers are dev-mode and heavily throttled; treat them as direction, not magnitude.
2. **The marks are main-thread animations.** Loom: `stroke-dashoffset` on the picks, `transform` on SVG groups (cloth take-up, shuttle, reed). Spool: `stroke-dashoffset`, `transform` (translate, rotate). `stroke-dashoffset` animations always run on the main thread, and as far as I know Safari does not composite transform animations on SVG child elements either (not verified in Safari here), so any long task (script evaluation, hydration) freezes the marks. Opacity and transform on HTML elements can run on the compositor.
3. **Why log out is clean.** `/login` is a light page; little competes with the animation. The workspace is heavy (large client bundle, React hydration, query-cache restore, analytics, tours, a burst of sidebar route prefetches).
4. **Real timings (owner's desktop Safari, production, the #175 build, 2026-10-03 08:36 to 08:37 UTC):** sign-in request `auth_round_trip_ms` 524 and 596; `route_paint_ms` (navigation start to the hydrated page's first paint) 978 and 783; `total_ms` 1879 and 1673. Server work is small (`sign_in_server_action` ~215 ms, dashboard layout ~30 to 50 ms). The five sidebar route prefetches (`/owner/quotes`, `/rates`, `/billing`, `/settings`, `/estimator` RSC requests) fire right as the workspace lands.
5. **Not known:** which tasks actually block the main thread on the real workspace in Safari, and for how long. Nobody has profiled it. It cannot be reproduced locally because it needs a signed-in session (see "Environment").

## Suggested plan (a recommendation, not an instruction)

1. **Measure first.** Two ways, ideally both:
   - Ask the owner to record a Safari Web Inspector Timeline (JavaScript and Events, Layout and Rendering) across a sign-in, and read the top tasks between navigation start and the overlay lifting.
   - Add small client telemetry for the overlay window: sample `requestAnimationFrame` gaps while the overlay is on screen (max gap, count over 50 ms) and send it with the existing sign-in timing report (`components/telemetry/sign-in-timing-reporter.tsx`, `app/api/telemetry/sign-in/route.ts`, `lib/sign-in-trace.ts`). As far as I know Safari has no Long Tasks API (check), so frame gaps are the practical signal. The owner tests on production after each merge and the numbers appear in Vercel runtime logs (see below).
2. **Cheap, deterministic mitigation to evaluate first:** defer non-essential workspace startup work until the overlay lifts. Detect it with `document.querySelector('weavly-handoff')` or add an explicit flag/event. Candidates to check (not yet profiled): sidebar `Link` prefetching (default prefetch, ~5 RSC requests on landing), analytics/web-vitals/plan-event POSTs, `AuthBoundaryCleanup` (IndexedDB cleanup), tours, persisted query-cache restore, Sentry init, `SignInTimingReporter`.
3. **If main-thread JS is still unavoidable, make the animation not depend on the main thread** (this changes the look of the deliberate signature marks, which `design.md` says to leave alone, so get the owner's approval): re-express the marks with `transform`/`opacity` on HTML elements, or draw them to a canvas in a worker (`OffscreenCanvas`), or play a short looping muted video/animated image rendered from the existing SVG. Whatever you pick must keep the resume-on-the-same-frame behaviour across the page change and work in iOS Safari/PWA standalone mode.
4. **Reduce what the destination executes at startup** (bundle splitting, lazy hydration, Suspense boundaries); related earlier work is `2bf05b17` ("shrink first-load JS for login, landing and the post-sign-in workspace").

Rejected or already tried: timed/early redirects (above); client-side router navigation (breaks the auth boundary guarantees); a hidden iframe preload (same-origin iframes share the main thread); Speculation Rules prerender (Chromium only, not Safari/iOS, and runs the page's scripts early); `visibility: hidden` or `content-visibility` on the page behind the overlay (the cost is script execution, not paint; hiding layout risks wrong measurements in components that size themselves on mount).

## Gotchas learned the hard way

- **Inject into `<body>` only inside an unknown tag.** React hydrates `<body>` and skips children whose tag it does not expect, but it claims a `<div>` for Next's own hidden metadata `<div>` and, on an attribute mismatch, throws away the server HTML ("Hydration failed because the server rendered HTML didn't match the client"). That is why the overlay lives in `<weavly-handoff>`. The CSS that hides toasts over the overlay matches both the original and the handed-over overlay.
- **A "no errors" check can be a false negative.** `next dev` hydrates slowly, so with real timing React often hydrates after the overlay is gone. `handoff-check.mjs` with `FRESH_ROUND=1` forces hydration to overlap the overlay and prints whether it did.
- **Playwright init scripts are serialized**, so they cannot use closure variables. Pass arguments to `addInitScript(fn, arg)`.
- The sign-in page calls `flushSync` before capturing, so the stored markup has the "signed in" copy; do not capture before that render.
- Reduced motion: no handoff (the mark is still), and the overlay never waits. Keep that.
- Telemetry: `POST /api/telemetry/logout` returns 401 after log out (no session), so `logout_client_timing` is never recorded.

## Environment and safety (from `CLAUDE.md`, restated because it matters)

- `npm run dev` talks to the **shared QA Supabase project**. `npm run build` and `npm start` load **production** env locally; do not run them. Never run `supabase db push`, `db pull`, `migration repair`, or functions deploys. Do not print env values.
- A worktree has no `.env.local`. For a local check: `ln -s ../../../.env.local .env.local` (gitignored; remove it afterwards). Use `npx next dev --webpack -p 3011` (Turbopack dev fails on a docs file Tailwind scans). QA Supabase did not resolve in DNS when last checked (2026-09-30), so a signed-in session cannot be created locally; signed-in verification means a deploy and the owner signing in.
- The checks here never sign in: the sign-in request is held in the browser and never sent, and the form values are placeholders.
- This branch is already checked out in the worktree it was created in; a second worktree cannot check out the same branch at the same time. Continue in that worktree, or branch from it.
- CI is informational (no required checks) but runs `tsc`, `vitest`, `lint`; keep `npm run lint` at zero warnings. Many tests are source-contract tests that read file text: update them deliberately when you change copy, class names or structure.

## Measuring in a browser (the harness)

`docs/performance/auth-transition-harness/` (Node ESM, headless Chromium via the Playwright copy bundled with the Codex runtime; paths are env-overridable, see `common.mjs`):

- `handoff-check.mjs`: leaves `/login` at several times and checks the overlay is on the next page's first frame, resumed on the right animation frame, closes at 1.6 s, storage is cleaned, and React hydrates without errors. `FRESH_ROUND=1 LEAVES=400,800 node docs/performance/auth-transition-harness/handoff-check.mjs`
- `frame-gaps.mjs`: frame gaps and long tasks under the overlay with CPU throttling, comparing the current look with `VARIANT_CSS`. `TARGET=/ THROTTLE=4 RUNS=4 node docs/performance/auth-transition-harness/frame-gaps.mjs`. Single runs are noisy (a cold run can show a multi-second stall); use at least 4.

Both need the dev server up and the target pages warmed once (`curl` them) so first-compile time does not eat the 1.6 s window.

## Reading real timings from production

Vercel MCP `get_runtime_logs` with team `team_IdyTSnqYdDMy01w7YrgIK9P9`, project `prj_Eg9Cmax0d3yooB1iJmbDorUBF6Q4`: `query: "sign_in_client_timing"` (sign-in client timings per stage), `query: "signout"` (`auth_logout`), `since: "3h"`. After a merge the deploy takes about 1 to 2 minutes. The owner tests on desktop Safari, usually two or three sign-ins and sign-outs right after.

## How the owner likes to work

Short, direct updates; evidence before claims; scope checks to what changed and avoid hour-long runs; say plainly what was and was not verified; do not commit, push or merge until asked. The usual loop is: the owner says "push commit and merge and I will test it", the change deploys, they test on Safari and report what they saw.

## Definition of done

On the owner's Safari, signing in plays the full loom round with no visible stutter, the next page appears as the round ends already hydrated and usable, nothing is visible through the overlay, log out stays as clean as it is now, and there are no hydration errors. Prove it with numbers from the frame-gap telemetry or a Safari timeline, not only with the dev-server harness.
