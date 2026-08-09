# Sprint 21 auth and tenant regression

Status: code-level guards updated; full deployed matrix pending.

Implemented safeguards:

- Proxy claims are an optimistic routing hint only. Owner layout, Server Actions, Route Handlers, RPCs, and RLS remain authoritative.
- Proxy no longer uses a service-role organization/subscription REST read.
- One Proxy revocation lookup remains for normal requests. The cached server auth helper skips only when Proxy supplies an internal marker that Proxy strips from browser input; it retains a fallback Redis check for direct/internal callers.
- Owner and supervisor layouts perform tenant-scoped organization lockdown checks before sensitive content is returned.
- Saved Costings detail reads and Rate Book reads filter by the authenticated owner's tenant.
- The Saved Quality yarn trigger is `SECURITY INVOKER`; no new definer is introduced by the Sprint 21 migration.

Required production regression rows: anonymous entry, valid Base owner, valid Full Suite owner, supervisor on owner route, revoked owner, locked organization, incomplete onboarding, refreshable token, malformed cookie, and cross-tenant identifier read/mutation.
