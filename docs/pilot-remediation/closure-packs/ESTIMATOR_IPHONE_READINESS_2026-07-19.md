# Estimator physical-iPhone readiness closeout

Date: 2026-07-19 IST

## Scope and result

The Estimator continued-step matrix is **24 pass, 0 fail, 0 blocked**. This
closeout is specific to the Base Estimator release and does not change the
formal wider-pilot matrix or its external-evidence gates.

Physical iPhone Safari verified:

- mobile navigation, Settings, Billing and Logout remained reachable;
- the Estimator had no blocking horizontal overflow;
- `40 Ne` converted to `132.875 D`;
- numeric fields remained visible with the keyboard open and Done dismissed it;
- `1,000 m` tape produced approximately `952 m` beam capacity and `2` beams;
- cost breakdown and the mobile quality action remained reachable;
- Save created one costing and reopen restored it; and
- the final retest no longer zoomed text fields on focus.

## Defects found and fixed

1. Plain-LAN iPhone Safari could expose neither `crypto.randomUUID()` nor a
   usable equivalent at the direct call site, so Save failed silently before
   the request reached the server. Estimator request IDs now use a shared RFC
   4122 UUID helper with Web Crypto and legacy fallbacks.
2. iOS Safari enlarged text controls whose rendered font was below 16 px. A
   mobile-only, Estimator-scoped 16 px rule prevents focus zoom without
   disabling user-controlled page zoom.
3. `Save as New Quality` was hidden below the small-screen breakpoint. The
   same action is now visible as the accessible compact label `New Quality`.

## Verification before merge

- `npm test -- --run`: 102 files passed; 708 tests passed; 1 intentional skip.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run lint`: passed.
- `npm run build`: passed with the production environment and 43 generated
  routes/pages.
- `git diff --check`: required before commit.

## Data safety

The automated QA fixture and the physical-iPhone QA tenant were deleted. The
organization, profile, subscription and Auth user checks returned zero. No
payment was made and no non-QA factory was used.

## Release state

`pass`: PR `#24` merged as commit
`60005bc1db5d07a8655d3dc2e61d8a9080b47c27`. Vercel production deployment
`dpl_92ja3kPm6xb2idwWa84NzaC3Feya` reached `READY` and serves the canonical
alias `https://textile-accounting.vercel.app`.

The disposable Base-account production smoke (`ESTPROD-1784461234425-CB8F64`)
proved sign-in, Estimator calculation, Save, Saved Cost Estimates persistence,
Load Specs reopen, and Update Cost Estimate readiness. The live values included
`40 Ne` to `132.875 D`, approximately `952 m` beam capacity, `2` beams for a
`1,000 m` order, and one persisted costing. Production error logs for the
deployment contained zero errors during the smoke window; `/`, `/login`,
`/manifest.webmanifest`, and `/sw.js` returned HTTP 200.

Cleanup deleted the disposable organization, profile, Base subscription,
costing, and Auth user. The post-cleanup reconciliation returned zero for all
five record classes. No payment was made and no non-QA tenant was changed.
