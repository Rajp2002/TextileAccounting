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

`fixed_pending_runtime_proof`: physical-device QA and the integrated release
gate pass. Promotion to `pass` requires the exact merged commit to become the
READY production deployment, a disposable Base-account production save/reopen
smoke, and zero-residue cleanup.
