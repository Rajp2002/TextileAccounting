# Sprint 21 residual risks

- Production has not been deployed or measured in this implementation turn; no route target is claimed as passed.
- The repository documents production Supabase project `vzhwahudircrpgtitwzd` in `ap-south-1`; the `bom1` region change must still be validated against the canonical deployment and rolled back if the deployed project differs.
- `getClaims()` is a local verification optimization only for asymmetric signing keys; symmetric projects can still perform Auth network validation.
- Proxy no longer reads organization lockdown/onboarding state. Scoped owner and supervisor layouts retain authoritative lockdown checks; the complete production route matrix must confirm onboarding and other route-specific redirects remain unchanged.
- Legacy Rate Book gaps require the explicit `reconcileLegacyYarnRates` operation or a controlled maintenance migration; no page GET performs that write.
- Saved Costings now has a summary-first path, but global pagination/search distribution and analyzer-based route bundle budgets still require follow-up verification.
- The local emitted bundle report is over budget for Cost Estimate (357,201 gzip bytes) and Settings (183,924 gzip bytes); residual chunks are named in `bundle-before-after.md`. This is not a production transfer measurement.
- Local Supabase schema lint could not run because the local Postgres container was unavailable. The new trigger migration still requires the canonical migration review, apply, and tenant/idempotency tests.
- Cache Components was not enabled; it remains a gated application-wide decision.
