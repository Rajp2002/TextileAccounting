# Pre-change checkpoint

Recorded: 2026-07-15 IST

## Git baseline

- Starting branch: `codex/performance-campaign-20260715`
- Starting commit: `8da715a8cb58f712f3fd88421d9f717e1e6ede07`
- Review branch created: `codex/repository-grounded-architecture-enhancement`
- Rollback checkpoint: the starting commit above. No history was rewritten and no user branch was deleted.
- Current task scope after user clarification: analysis artifacts only; no production-code, migration, configuration, deployment, database, or runtime-data changes.

## Working-tree state before this review

The starting tree was already dirty. These changes predate this architecture review and are treated as unrelated user/performance-campaign work:

- Modified: `__tests__/batch9-offline-cache-truth.test.ts`
- Modified: `__tests__/production-mode.test.ts`
- Modified: `app/(auth)/actions.ts`
- Modified: `app/(auth)/actions/auth.ts`
- Modified: `app/(auth)/login/login-form.tsx`
- Modified: `app/(dashboard)/owner/estimator/EstimatorClient.tsx`
- Modified: `app/(dashboard)/owner/estimator/page.tsx`
- Modified: `components/auth/logout-button.tsx`
- Modified: `lib/auth.ts`
- Modified: `lib/production-mode.ts`
- Modified: `proxy.ts`
- Untracked: `__tests__/auth-login-performance.test.ts`
- Untracked: `__tests__/logout-route.test.ts`
- Untracked: `app/auth/signout/`
- Untracked: `lib/supabase/auth-cookie.ts`
- Untracked sensitive-looking local recovery material: `weavly-backup-age-identity.txt` (contents not inspected; file preserved and must not be committed)

The review will not edit any of these files. Repository conclusions that depend on them will identify the uncommitted state where material.

## Proposal source

- Attachment source: `/tmp/codex-remote-attachments/019f65b5-b52f-7bf1-89bc-f5ae9bdc1be6/7F9A4174-0C01-4433-8534-450CD5DAE13A/1-Commercial-20-20Technical-20Proposal-20for-20Weavly.pdf.pdf`
- Preserved copy: `docs/reference/narola-weavly-commercial-technical-proposal.pdf`
- SHA-256: `42ed3d628850509e1ec3a431e6588012fb0d8d71d2641988cf84f7c476f53c74`

## Environment references

Only non-secret environment identity was inspected. Secret values were neither printed nor copied.

| Environment evidence | Project/site identity | Safety disposition |
|---|---|---|
| `.env.production.local` | Supabase ref `vzhwahudircrpgtitwzd`; Vercel site `textile-accounting.vercel.app`; `VERCEL_ENV=production` | Production; no mutation or live proof action authorised |
| `.env.qa.local` | Supabase ref `eutycrtzzxmlkcpipgod`; site value points at the same canonical host; `VERCEL_ENV=development` | QA credentials exist, but no runtime mutation is required for this analysis-only run |
| `.env.local.estimator-final-backup` | Supabase ref `eutycrtzzxmlkcpipgod`; `VERCEL_ENV=development` | Historical/local QA backup configuration; not used |
| `supabase/config.toml` and `supabase/.temp/project-ref` | `vzhwahudircrpgtitwzd` | Supabase CLI is linked to production; therefore no database command, migration push, seed, reset, or destructive test will be run |
| `.vercel/project.json` | Vercel project `textile-accounting` | Linked project metadata only; no deployment action will be run |

## Planned analysis candidates

The implementation gate will assess, without implementation:

- a deployment-gated golden-journey ledger built from existing tests and runtime evidence;
- operation/correlation IDs and safe Sentry/log context;
- explicit idempotency standards for the few remaining direct-insert money/master-data writes;
- the minimum support/admin surface needed for pilot;
- representative-volume measurements once authenticated QA is usable;
- backup/restore completion using the already-implemented workflows;
- repository hygiene that prevents local recovery secrets from accidental staging;
- estimator cost-stack and scenario-comparison UX only after formula truth-sheet approval and pilot feedback.

## Known blockers and constraints

- `TECH-011`: the backup/restore implementation exists, but the canonical pilot ledger still lacks one successful scheduled encrypted artifact restored and reconciled in disposable infrastructure.
- `UX-012`: factory terminology needs dated approval from a real supervisor/factory reviewer.
- `GOLDEN-A-03`: one independent, business-approved real-fabric truth sheet is still required.
- Current authenticated performance proof is blocked by the isolated QA login flow according to `docs/performance/campaign-20260715/performance-final-summary.md`.
- Successful hosted Razorpay payment and webhook replay proof remains blocked for a paying-customer release according to `outputs/estimator-production-readiness/estimator-final-summary.md`.
- The user explicitly requested analysis only. Even a qualifying P0/P1 will be documented and deferred, not implemented.

## Change boundary

Allowed in this run: the preserved reference PDF and Markdown analysis deliverables under `docs/reference/` and `outputs/architecture-enhancement/`.

Not allowed in this run: product source, tests, migrations, workflows, environment files, deployment settings, database state, third-party provider state, production/QA data, commits, pushes, or releases.
