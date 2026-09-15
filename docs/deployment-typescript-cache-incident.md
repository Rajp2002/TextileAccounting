# TypeScript build stall — 14 September 2026

## Evidence

- Last healthy cached deployment `6mPRRjnAAvVfYQte78KdAT2wqPka`: TypeScript finished in 37.6 seconds.
- Deployment `GhAvrvWP8uXHo6JYV1J5xSDJeyEZ` at `0d6db5e0`: compilation finished in 97 seconds, then the last log was `Running TypeScript`. Vercel eventually reported `BUILD_EXCEEDED_MAXIMUM_TIME` after approximately 46 minutes.
- Deployment `GcpuBNuAjZfQHfj35je5dhmRD4GK` at `77a511b6`: compilation finished in 101 seconds, then the same TypeScript stall; canceled after 10 minutes 21 seconds.
- Cache-free redeployment `4Q454Q7bDndQf1DuW3YYQWdbhsLV`, also at `77a511b6`: logs explicitly confirm cache was skipped. TypeScript finished in 37.7 seconds; build finished in about five minutes and deployed successfully.
- The last healthy deployment uploaded a 1.17 GB build cache. The cache-free retry produced a 649.56 MB cache. Size alone does not establish corruption or an out-of-memory condition.

## Diagnosis and limits

The same commit succeeding without restored cache strongly implicates restored build state. The exact old cache artifact and worker memory/CPU traces are unavailable, so corruption, a specific TypeScript bug, or memory exhaustion cannot be proven from the logs.

The lockfile uses Next.js 16.2.12 and TypeScript 5.9.3. Next.js's versioned `runTypeCheck.ts` implementation reads incremental state from `.next/cache/.tsbuildinfo` when `tsconfig.json` enables `incremental`, as this project does:

https://github.com/vercel/next.js/blob/v16.2.12/packages/next/src/lib/typescript/runTypeCheck.ts

Earlier local validation used drifted installed dependencies (Next.js 16.3.5), so it was not an exact reproduction of Vercel. Use `npm ci` for lockfile parity. The corrected test fixtures were valid standalone TypeScript fixes; Next.js filters diagnostics from test files, so they should not be described as the cause of this deployment timeout.

## Safeguard

`npm run build` now removes only `.next/cache/.tsbuildinfo` before invoking Next.js. The prebuild test gate and Next.js type validation remain enabled. Dependency, webpack, application, and local editor caches remain untouched. This is a targeted mitigation for the suspected incremental state problem, not proof of the original root cause.

The path assumes the current default `.next` distDir. Update the script if that configuration changes. Build through `npm run build` so the safeguard runs.

## Local verification

- Restored lockfile parity with `npm ci --ignore-scripts --no-audit --no-fund`; Next.js 16.2.12, TypeScript 5.9.3, and Vitest 4.1.8 match the lockfile.
- Focused tests: `build-type-cache.test.ts` and `release-runtime-config.test.ts`, 8 passed. The reset test covers a missing cache, unusable restored state, and preservation of webpack and editor caches.
- Production build: `npm run build --ignore-scripts` passed with network access for Google Fonts and Sentry uploads disabled locally. The reset log appeared, compilation passed, TypeScript finished in 92 seconds, and all 64 static pages generated. `--ignore-scripts` skipped the already separately checked prebuild lifecycle for this local invocation only; the project's prebuild test gate remains unchanged.
- Full-suite local attempts were stopped after unusually slow worker startup; no full-suite success is claimed for this patch.
- This safeguard has not yet been deployed to Vercel. A future cached deployment must confirm the reset log and successful TypeScript completion; local success cannot establish the original remote root cause.

## If a build stalls again

Confirm the `[build] Reset .next/cache/.tsbuildinfo` log appears. Save the deployment ID, final logs, and build diagnostics before canceling. If TypeScript still stalls, the safeguard has not resolved the underlying cause: compare a cache-free retry and collect worker CPU/memory diagnostics rather than disabling type validation or assuming a larger build machine is needed.
