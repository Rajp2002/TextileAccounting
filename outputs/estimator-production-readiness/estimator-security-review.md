# Estimator Security Review

Production boundary probes passed for two isolated tenants. Base users could read Estimator data but could not read/update/insert Premium machine data or call Premium analytics. Premium users retained machine, analytics, and Estimator access. Cross-tenant template and quote reads returned no data; forged cross-organization quote linkage failed at the database constraint. A stale owner claim was denied after the live profile role changed, proving authorization does not rely only on JWT claims.

Controls deployed include live profile membership checks, live subscription checks, route and server-action entitlement gates, RLS, organization-scoped uniqueness, same-organization foreign keys, restricted sensitive functions, service-only payment activation, tenant-bound checkout context, and server-authoritative calculation validation.

No sensitive application data was observed in runtime logs. Cross-tenant denials did not disclose target records. Private audit credentials and platform bypass tokens are excluded from artifacts.

Remaining security-adjacent work is operational: triage dependency advisories and repair Sentry source-map upload credentials. Neither is evidence of a demonstrated Estimator tenant-boundary bypass.
