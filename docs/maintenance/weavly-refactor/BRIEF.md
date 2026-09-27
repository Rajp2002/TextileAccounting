# Weavly refactor program — brief

Read this, then [STATUS.md](./STATUS.md). Pull only the [EVIDENCE.md](./EVIDENCE.md) sections the approved package needs.

## Objective

Make the existing Weavly application simpler, more consistent, maintainable, secure, accessible and measurably responsive **without changing intended product behavior**. No rewrite, redesign or new features. "Premium" means dependable product quality.

## Non-negotiable rules

1. **Phased and gated.** Execute only the approved phase/package. Stop at its boundary, update STATUS, wait for approval. Stop early on a needed product decision, unexplained regression, missing verification capability, destructive action or scope expansion.
2. **Evidence.** Label findings VERIFIED / INFERRED / UNKNOWN with paths, symbols, lines or command output. Report checks as PASS / FAIL / BLOCKED / NOT RUN. Never call a red baseline green.
3. **Protect behavior.** Costing math (units, Decimal precision, rounding stages, Quick/Detailed parity, invalid-input handling), saved records/snapshots/exports and the customer/internal boundary, Free/Lite/Base entitlements, auth, tenancy, quotas, billing, production/assignment/payroll/stock/dispatch/challan workflows, en/hi/gu, responsive shell (centre container + left/right rails), routes/deep links, onboarding, tours, drafts. A suspected bug is documented and proposed separately, never silently fixed. A security flaw is escalated, not enshrined.
4. **Environment safety** (details in root `CLAUDE.md`). `npm run dev` hits the shared QA project; local `npm run build`/`npm start` load **production** env; the Supabase CLI is linked to **production**. Run builds/tests only through `node scripts/performance/isolated-command.mjs …`, and builds only in a credential-free export copy (no `.env*` files). No push, merge, deploy, `supabase db push`/`pull`/`repair`, production or QA data writes, Razorpay/WhatsApp/email calls, or paid services without explicit approval. Never print secrets.
5. **Schema, indexes, RLS, public contracts, payment semantics and major dependency changes** each need a separately approved scope plus a compatibility/rollback plan. Never edit applied migrations.
6. **Tests.** Never weaken assertions, delete relevant tests, relax lint/TS rules, or add blanket suppressions. Characterization tests are labeled as such. Mocked integrations are not live proof. More than half the suite is source-contract (text) tests; when moving code, update those contracts deliberately and say so.
7. **Deletion protocol** (Phase 3): purpose → all consumers incl. framework/dynamic/string/asset/CI/external → roles/plans/languages/history → evidence + recovery ref → batch approval. Zero grep hits is not proof.
8. **Reversibility.** Commit or push only when the user asks (repo policy). Each package lands as its own commit on branch `maintenance/weavly-refactor` (roll back with `git revert <sha>`). Uncommitted work keeps a reverse-checked patch until it is committed. Never push to `main`: Vercel deploys `main` to production. Preserve all stashes, worktrees and user files.
9. **Subagents** are optional, read-only by default, at most three at a time, given explicit scope and safety rules, and their findings are re-checked before use.

## Phase map

| Phase | Purpose | Status |
| --- | --- | --- |
| 0 | Discovery, risk map, baseline, Phase 1 proposal | complete, gate reached 2026-09-26 |
| 1 | Regression protection and quality gates (packages 1A–1F in STATUS) | complete 2026-09-26 (1F, 1A, 1B-1, 1B-2); fix packages F1–F3 applied |
| 2 | Targeted consistency/maintainability, one subsystem per package | 2A–2D and OS-13 done 2026-09-27 (E23–E27); 2E/2F deferred |
| 3 | Proven-unused code, dependencies, assets, legacy docs (deletion protocol) | code, dependencies and hidden UI complete 2026-09-27 (batches 3A–3H, E28–E36; no unreachable source files remain). Unused assets are a close-out check; legacy docs move to Phase 5 |
| 4 | Measured performance and interaction quality | not started |
| 5 | Canonical documentation and agent instructions | not started |
| 6 | Independent review and integrated verification (release assessment only) | not started |

## Authoritative references (trust order)

1. Current route/server-action code and tests (`app/`, `lib/`, `__tests__/`).
2. Latest migrations (`supabase/migrations/`, 300 files; retirement of Full Suite in `20260924085030_retire_full_suite_tier.sql`).
3. Current docs: `docs/general/README.md` (index), root `CLAUDE.md`, `design.md`, `.agents/rules/weavly-global-premium-design-principles.md`.
4. Prior maintenance evidence to build on, not redo: `docs/maintenance/cleanup-2026-09-14/` (deletion candidates C01–C37), `docs/performance/application-20260911/audit.md`, `docs/performance/routing-20260911.md`, `docs/pilot-remediation/DOMAIN_INVARIANTS.md` (Aug 2026, mixes current and retired scope).
5. Older planning docs are historical evidence only.

## Safe command set (verified 2026-09-26)

```bash
node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/performance/isolated-command.mjs npx vitest run [file]
node scripts/performance/isolated-command.mjs npx eslint --max-warnings=0 [paths]
# Build only in an export copy without .env files:
git archive HEAD | tar -x -C <copy> && ln -s "$PWD/node_modules" <copy>/node_modules
(cd <copy> && node scripts/performance/isolated-command.mjs npm run build --ignore-scripts)
node scripts/performance/application-bundle-report.mjs <copy>/.next
node scripts/ci/lint-changed.mjs <base-commit>   # CI lint ratchet: fails only on new diagnostics
npm run test:db   # disposable loopback PostgreSQL; needs initdb/pg_ctl on PATH (EVIDENCE E17)
```

Disposable database probe (no repo file yet): EVIDENCE E9 lists the exact `initdb` flags, stubs and replay procedure.
