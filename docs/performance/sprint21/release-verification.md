# Sprint 21 release verification

Status: local implementation gate passed; not a release approval. Production deployment and 20-sample distributions are still required.

Local checks completed so far:

- Full Vitest: 146 files passed; 916 tests passed and 1 skipped.
- TypeScript: `npx tsc --noEmit` passes.
- ESLint: 0 errors; one pre-existing unused-variable warning remains in `lib/i18n/runtime.ts`.
- Production build: `npm run build` passes with Next Webpack, TypeScript, static-page generation, and route optimization.
- Bundle evidence: `scripts/performance/sprint21-bundle-report.mjs` produced `bundle-after.json` from the final local production build; Rate Book and Saved Costings meet local emitted-byte budgets, while Cost Estimate and Settings retain named residuals.
- Route evidence tooling: `sprint21-route-metrics.mjs` accepts the redacted sample contract and the pending after artifact validates as JSON.
- Rate Book page-load discovery writes were removed from the server action; the new Saved Quality sync migration is present but has not been applied to production in this workspace turn.
- Route-aware loading shells and semantic route milestone markers are present for all five Base routes.

Release gate still open:

- Apply and verify the migration in the canonical production change process.
- Commit, push, merge, and deploy the intended change before any production QA; the authenticated QA router classifies the current state as `deployment_pending`.
- Run auth/tenant/RLS, estimator, rate idempotency, Saved Costings detail, Settings mutation, Billing, localization, mobile, accessibility, and browser regression suites.
- Capture at least 20 comparable cold samples per route, including five labeled cold-start samples.
- Populate after, server-phase, bundle, and residual-risk artifacts from real deployment evidence.
- Do not mark any route pass/no-go until p75 is calculated from comparable raw samples.
