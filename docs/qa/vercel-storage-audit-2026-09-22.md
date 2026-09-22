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
