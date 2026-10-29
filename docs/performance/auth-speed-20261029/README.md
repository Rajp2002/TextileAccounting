# Sign-in and log out speed, 2026-10-29

Branch `claude/faster-sign-in-sign-out`, from `main` at `6a659651`.

## How it is measured

`scripts/performance/signed-in-latency/auth.mjs` runs the production build (`next start`, built with `scripts/performance/isolated-command.mjs`, so no secrets and no hosted URLs) against the fake Supabase/Upstash backend from the 2026-10-28 latency pass. The fake backend now also answers a password sign-in and the rate limiter's script call. Every Supabase call waits 30 ms and every Redis call 10 ms (a modelled Vercel bom1 → Supabase/Upstash Mumbai round trip).

- **Browser:** headless Chromium with the service worker blocked fills in the real login form (Lite and Free owners) or presses the real log out button (Lite owner). Times run from the form submit: when the next document starts (the auth request is done), when it has loaded, and when the hand-over overlay lifts, which is what the owner waits for. One warm-up, then 5 runs, medians. `--rtt 100` adds 100 ms to every browser request, a phone's round trip to Vercel.
- **Request:** the auth request the browser sent, replayed 9 times from Node after two warm-ups: median time, response size, backend calls and sequential waits (the longest chain of calls where each began after the previous ended).

```bash
node scripts/performance/isolated-command.mjs bash -c 'node scripts/reset-build-type-cache.mjs && ./node_modules/.bin/next build --webpack'
node scripts/performance/signed-in-latency/auth.mjs docs/performance/auth-speed-20261029/<name>.json [--rtt 100]
```

In a cloud container, Google Fonts needs the proxy CA during the build: run the build through `env NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt HTTPS_PROXY=… ` inside `isolated-command.mjs`, and give it `NODE_OPTIONS=--max-old-space-size=8192`.

## Findings

1. **The animation round sets the wait, not the network.** The next page is loaded 0.25 to 0.6 s after the submit, but the overlay lifts at 1.79 s every time: one full 1.6 s round plus the 180 ms fade (`AUTH_TRANSITION_ROUND_MS`, `components/auth/auth-handoff.ts`). Production timings from 2026-10-03 (`docs/performance/auth-transition-stutter-handoff.md`) put the Safari sign-in at 1.67 to 1.88 s, at or just above the round. Server and network savings only show when the work would otherwise run past the round (slow phone networks, cold starts). **Not changed; needs the owner's decision (below).**
2. **Sign-in re-rendered the login page into its response.** `signIn` was a Server Action and sets cookies; in Next 16 any cookie write in an action marks the path revalidated (`MutableRequestCookiesAdapter` sets `pathWasRevalidated`), so the response carried the re-rendered root layout and login page (15.5 KB) that the browser drops when it navigates to the workspace. Action IDs also change between builds, so a login tab left open across a deploy could not sign in. **Fixed:** the form posts to a route handler, `/auth/signin`.
3. **A Free owner's sign-in read the Free grant after the plan row.** For Free accounts the plan row resolves to no paid tier, so the grant read followed it. **Fixed:** for a Free signup (`app_metadata.free_signup`) the grant read starts alongside the plan read; other owners never read it.
4. **Log out made three Supabase calls in series:** Auth `/user` (fresh identity for the founder-session revocation), the `admin_founder_session` revoke RPC, then Auth `/logout`. The revoke updates `private.platform_admin_sessions` by user id and never reads `auth.sessions`, so it does not need the provider session. **Fixed:** the identity check (which needs the live session) runs first on the route's own client, then the revocation and the provider sign-out run together. Fail-closed confirmation is unchanged.

## Results

`before.json` → `after.json` (no added browser latency):

| Flow | Request | Response | Waits | Next page starts | Next page loaded | Overlay lifts |
| --- | --- | --- | --- | --- | --- | --- |
| Sign-in, Lite | 103.1 → 103.1 ms | 15,486 → 33 B | 3 → 3 | 120.3 → 107.4 ms | 385.7 → 350.7 ms | 1,787 → 1,789 ms |
| Sign-in, Free | 131.3 → 95.0 ms | 15,475 → 22 B | 4 → 3 | 162.4 → 107.3 ms | 458.9 → 418.5 ms | 1,789 → 1,789 ms |
| Log out, Lite | 115.9 → 81.1 ms | 0 → 0 B | 3 → 2 | 123.2 → 94.7 ms | 252.0 → 233.0 ms | 1,790 → 1,792 ms |

`before-rtt100.json` → `after-rtt100.json` (100 ms added to every browser request):

| Flow | Next page starts | Next page loaded | Overlay lifts |
| --- | --- | --- | --- |
| Sign-in, Lite | 202.6 → 193.8 ms | 619.3 → 566.4 ms | 1,789 → 1,788 ms |
| Sign-in, Free | 251.2 → 187.9 ms | 616.5 → 577.7 ms | 1,787 → 1,787 ms |
| Log out, Lite | 121.2 → 106.9 ms | 374.3 → 351.6 ms | 1,789 → 1,788 ms |

"Loaded" medians come from 5 runs and move by a few tens of ms between runs; request times and waits are stable. In production each removed wait saves one real bom1 → Mumbai round trip, and the 15 KB no longer crosses the phone's network.

## Not verified

- No run against real Supabase (QA does not resolve; production must not be used locally). Waits and call counts are exact; milliseconds are modelled.
- No Safari or installed-PWA check. The `--rtt` latency is Chromium's network emulation, not a real phone network.

## Needs the owner's decision

**The round length.** The only change that would make sign-in and log out feel clearly faster is a shorter round. Keeping "always one full round" but playing it in, say, 1.0 s instead of 1.6 s would save about 0.6 s on every sign-in and log out; the marks' keyframes, `--auth-round` in `app/globals.css` and `AUTH_TRANSITION_ROUND_MS` change together. Lifting the overlay as soon as the next page is ready (cutting the round short) was rejected on 2026-10-03.
