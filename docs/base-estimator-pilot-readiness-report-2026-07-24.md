# Base Estimator Pilot Readiness — 2026-07-24

## Current decision

**No-Go pending release proof.** All newly identified repository-controlled Base pilot blockers are implemented and locally verified. The exact candidate has not been deployed, migration `20260724161732_harden_export_audit_boundary.sql` has not been applied, and the required downloaded-file inspection has not been completed. Those are release gates, not paperwork.

## Blocker status

| Blocker | Status | Evidence / remaining proof |
| --- | --- | --- |
| Runtime high advisories | Pass locally | Patched DOMPurify, fast-uri, PostCSS, and Sharp; runtime audit reports zero vulnerabilities. |
| Export-audit cross-tenant integrity | Fixed pending runtime proof | Service-role-only function, empty search path, explicit actor/org validation, focused regression. Apply and negative-call proof remain. |
| PDF/JSON download observability | Fixed pending runtime proof | Shared browser helper, deferred URL cleanup, deterministic filename feedback, regression test. Deployed physical file inspection remains. |
| Independent TypeScript gate | Pass locally | `npx tsc --noEmit` exits zero. |
| Base/referral/landing language | Pass locally | `Start From`, saved costing history, and annual-plan referral wording aligned. |

## Verification completed

- ESLint: pass.
- TypeScript: pass.
- Vitest: 114 files, 770 passed, one intentional skip.
- Next.js 16.2.11 optimized build: pass, 45 static pages.
- Runtime npm audit at high threshold: zero vulnerabilities.
- Migration list/dry-run: remote aligned through `20260723113000`; only the new `20260724161732` migration would apply.
- Full npm audit: three moderate and nine high dev-tool-only findings remain; none appears in `npm audit --omit=dev`.

## Conditions to issue Go

1. Review and apply migration `20260724161732`; prove authenticated direct RPC execution is denied and server-side export auditing succeeds.
2. Deploy the exact candidate and record commit/deployment identity.
3. Run a fresh prefixed Base owner journey with clean console and zero-residue cleanup.
4. Open and inspect internal PDF, customer PDF, and organization JSON; prove nonblank/readable output and the customer/privacy boundaries.
5. Reconcile the pilot estimate against an independent factory costing sheet with the named owner.

The prior 2026-07-22 Go is superseded for this candidate by the 2026-07-24 evidence. Status returns to Go only after the conditions above pass.
