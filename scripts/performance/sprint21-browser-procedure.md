# Sprint 21 route measurement procedure

The counted sample is a direct cold entry to the canonical production deployment using an isolated paid Base Plan owner account.

For each sample:

1. Record deployment ID, Git SHA, Function region, Supabase project reference/region, viewport, timestamp, and whether the sample followed a natural Function cold-start interval.
2. Open a new browser context or tab with the authenticated session preserved. Disable browser HTTP cache where the automation surface supports it.
3. Navigate directly to one route. Do not hover or prefetch the route first.
4. Wait for the route-specific DOM marker: `data-route-primary-usable="true"` on the route milestone element. Record `performance.getEntriesByName('route_shell_visible')`, `route_primary_usable`, and `route_secondary_ready` relative to `route_navigation_start`.
5. Capture console errors, failed critical resources, hydration warnings, and a screenshot showing that the primary task is enabled.
6. Save one redacted JSON row. Do not include tokens, customer values, phone numbers, costing amounts, or full record payloads.

Sample row shape:

```json
{
  "route": "/owner/estimator",
  "timestamp": "2026-08-10T00:00:00.000Z",
  "shellVisibleMs": 640,
  "primaryUsableMs": 2180,
  "secondaryReadyMs": 3010,
  "deploymentId": "deployment-id",
  "gitSha": "commit-sha",
  "functionRegion": "bom1",
  "supabaseProjectRef": "project-ref-only",
  "supabaseRegion": "ap-south-1",
  "viewport": "1440x900",
  "cold": true
}
```

Use the accompanying metrics script to calculate p50, p75, p95, minimum, maximum, and sample count:

```sh
node scripts/performance/sprint21-route-metrics.mjs samples.json summary.json
```
