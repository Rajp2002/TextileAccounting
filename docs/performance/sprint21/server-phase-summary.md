# Sprint 21 server phase summary

Status: instrumentation and route boundaries added; production comparison pending.

The existing redacted performance helper remains the logging surface and is enabled in production only with `WEAVLY_PERF_LOGS=true`. Proxy now emits opt-in, rate-limited route-only `claims` and `revocation` phase records; the owner shell logs separate request-scoped route-context and sidebar timers. The route data changes reduce the critical work as follows:

- Proxy uses one `getClaims()` validation path and retains one revocation lookup; organization/subscription REST lookups were removed from Proxy.
- Owner route context performs authoritative profile, organization/lockdown, and plan checks inside the secure server boundary.
- Cost Estimate's first server render reads factory defaults without creating a missing profile; saved qualities, workers, party suggestions, and review badges load after the primary editor.
- Rate Book's primary GET reads explicit rate/review columns only; usage/conflict scans are a separate read-only action.
- Saved Costings' first read uses explicit summary columns and summary-only quality metadata; complete snapshots and linked production details load on user intent.
- Billing's plan/status/entitlement inputs remain critical; the independent referral panel streams with a local loading and retryable error state. Payment decisions still use server-owned subscription/payment history.

Legacy yarn gaps are handled only by the explicit `reconcileLegacyYarnRates` maintenance action (or a controlled migration), never by a Rate Book page request.

No access token, customer value, phone number, costing amount, or full record payload belongs in phase logs. The production artifact must add representative phase distributions, request counts, response bytes, and server region metadata after deployment.
