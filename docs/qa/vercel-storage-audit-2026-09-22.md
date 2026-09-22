# Vercel storage audit — 2026-09-22

## Findings

- Team usage for the last 30 days showed 9.51 GB Deployment Storage and 11.73 GB Functions Storage. The latter was attributed almost entirely to `textile-accounting` (11.70 GB). These dashboard figures must not be equated to current live disk usage: Vercel documents storage billing as daily project maxima accumulated over the billing period.
- Three merged preview deployments were deleted with approval: `dpl_CxvYpXGekHKT8r1wxeqJ3K4dkNXe`, `dpl_HkQBJmxHN1qZjzJDZ1NupNHRVqeh`, and `dpl_GEtJ8VYU5CX63WkzWynw3LhjiHvm`. The latest production deployment and existing production rollback history were preserved.
- Retention was already one day for previews/canceled/errored builds and seven days for production. Many older builds were already in Recently Deleted. Active branch previews can survive expiration. The API also returned `deploymentsToKeep: 10`; its effective interaction with current Hobby defaults was not established, and it is not an editable property in the public update-project schema. No retention setting was changed.
- The existing local September 17 build referenced 89,116,324 unique uncompressed bytes, of which 68,303,020 were generated server source maps. Sentry's installed Webpack plugin deliberately limits default map deletion to client artifacts.
- `public/videos/hero-tutorial.mov` and `public/videos/tutorial.webp` had no application references. Together they contributed 18,285,154 bytes to public output on every build.
- The tracked repository contained 338 files under `output/`, including QA screenshots and exports. These were absent from server traces. They are repository hygiene concerns, not evidence of function bundle bloat, and were preserved.
- The large local `.next/cache` and `.next/dev` directories are distinct from deployment output. The old `.vercel/output` directory dated from August 2 and was not used as evidence for the current deployment's size.
- No Vercel deployment job was found in `.github/workflows`; the observed branch preview plus main production builds are consistent with normal Git integration. The project uses the default Next.js output directory and a single function region (`bom1`). No evidence justified an architectural rewrite, broader file exclusions, or removing monitoring.

## Changes

- Exclude only generated `.next/server/**/*.map` files from page/API output traces. Leave the maps on disk for Sentry uploads and preserve every runtime JavaScript file and dependency. This does not disable Sentry instrumentation. Middleware/instrumentation trace maps are left intact because Next.js does not apply this route option to them.
- Remove the unused tutorial video and thumbnail.
- Add `node scripts/audit-deployment-storage.mjs` to report uncompressed, deduplicated traced sizes, map sizes, large public assets, and missing trace dependencies after a build. This reports build artifacts, not Vercel billing estimates.

## Validation

- `npm run build`: passed, including 287 test files, 2,353 passing tests, one skipped test, TypeScript, and prerendering.
- Focused ESLint and `git diff --check`: passed.
- Fresh build: 32,175,411 unique traced bytes; 11,234,476 bytes of maps remain in middleware/instrumentation traces. Page/API traces contain no generated server maps. No traced files are missing.
- Public output after the build: 2,644,891 bytes, including generated PWA files.
- Local production smoke checks: `/`, `/login`, `/privacy`, `/offline` returned 200; `/owner` redirected to login; `/api/free/status` returned 401 without a session.
- The earlier and fresh local builds are different app revisions. Their size comparison is directional, not a controlled percentage reduction or a prediction of Vercel's compressed storage charges.

## Operational limits

Existing deployment artifacts do not shrink when repository code changes. The optimized configuration affects subsequent builds. Historical usage and recovery retention can keep dashboard totals elevated after cleanup; a reduced cloud quota reading was not observed during the initial cleanup.

References: [Vercel storage](https://vercel.com/docs/deployment-storage), [retention exceptions](https://vercel.com/docs/deployment-retention), [Next.js output tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

## Follow-up: shared instrumentation and middleware traces

The first change did not cover `instrumentation.js.nft.json` or `middleware.js.nft.json`. Inspection of the installed Vercel Next.js builder confirmed that it appends instrumentation dependencies to every Node function, including middleware. Use Next.js’s `compiler.runAfterProductionCompile` hook after Webpack/Sentry upload completion to remove generated server-map references from existing traces and move those maps to `.next/debug-source-maps/server`. This runs before final tracing and Vercel packaging. A shell post-build hook was tested and found too late: the Vercel `onBuildComplete` adapter had already packaged functions. Runtime JavaScript and external dependency maps remain untouched. A regression test verifies these boundaries, archive preservation, and idempotence. The build must continue using Webpack, whose Sentry uploads finish before this hook; revalidate ordering before a bundler migration.

On the same existing local build, unique traced bytes decreased from 32,175,411 to 20,940,981 (zero traced source-map bytes, zero missing dependencies). This controlled local comparison excludes platform packaging and is not a billing estimate.

Production deployment `dpl_6RsQ2WitfcGbQVmda6J2rkQQ7eWP` exposed 303 lambda route outputs but only three unique packaged functions: pages 7,439,547 bytes, API 3,306,270 bytes, middleware 4,209,018 bytes. Pages/API deploy to `bom1`; middleware deploys to eight regions. This corrects the earlier implication that all function storage uses only one region. Summing routes would greatly overcount shared packages. Summing unique packages per reported region gives 44,417,961 bytes, still not Vercel's historical usage metric.

Four further obsolete previews were deleted: `dpl_JA1UG9esewnwJAp6pc38X4rj2D5Z` and `dpl_9wTHaYpTRoddPkt7JTZSSfBLoVEM` have commits ancestral to main; `dpl_5BSvmEjZgsX4kMasatbkW21QimaL` and `dpl_BW7ivL7rBajmfrc9gCire49H8UBt` correspond to merged PRs #106 and #104. Production rollback history was preserved.

The refreshed 30-day dashboard still showed 11.73 GB / 10 GB Functions Storage and 9.59 GB / 10 GB Deployment Storage. Today's view showed zero before reporting useful data; it is not evidence of zero storage or compliance. Code changes cannot retroactively subtract historical daily maxima, and there is no documented public API to force-purge the recovery period. Do not claim the quota is resolved until refreshed account usage confirms it.

The daily graph showed approximately 11.7 GB stored across the last week; seven-day and 30-day totals matched. Treat the visible total as a storage history reading, not proof that a billing reset alone will resolve it. Recently Deleted exposes View Source and Restore but no purge action. The 30-day recovery period is a material blocker to immediate physical reclamation.
