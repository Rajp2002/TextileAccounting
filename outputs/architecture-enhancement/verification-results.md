# Verification results

Verified: 2026-07-17 IST

## Scope statement

The release contains the proposal/reference analysis, UX-012 evidence, TECH-011
evidence and the bounded backup comparison/restore safety fixes. Validation was
performed from a clean integration branch based on current `origin/main`, so
the green result does not claim or overwrite stale unrelated changes in the
original dirty worktree.

No database command, Supabase migration, provider mutation, production browser
form submission or production data mutation was performed. PR `#20` merged to
`main`, and Vercel deployed that exact merge commit to production.

| Recommendation / artifact | Verification command or procedure | Environment | Expected result | Actual result | Evidence path | Classification | Remaining risk |
|---|---|---|---|---|---|---|---|
| Proposal ingestion | `shasum -a 256 <attachment> docs/reference/narola-weavly-commercial-technical-proposal.pdf`; `cmp -s ...`; `file ...` | Local filesystem | Identical, nonempty readable PDF | Both SHA-256 values `42ed3d628850509e1ec3a431e6588012fb0d8d71d2641988cf84f7c476f53c74`; byte comparison exit 0; PDF 1.4 | `proposal-ingestion.md` | PASS | Source attachment path is temporary; preserved repository copy must be committed later intentionally |
| Proposal readability/identity | `pypdf` open, metadata/page count and first/last-page extraction; visual render/contact-sheet review of all pages during ingestion | Local filesystem | 22 readable pages, correct title, no encryption/corruption | 22 pages; title `Commercial & Technical Proposal for Weavly`; unencrypted; first/last pages extract text; all rendered pages visually inspected | `docs/reference/narola-weavly-proposal-technical-notes.md` | PASS | Summary is a faithful technical abstraction, not a legal/commercial opinion |
| Required analysis structure | File inventory against requested paths | Local repository | PDF, notes and all 11 output Markdown files present | All required paths present after this pass | `docs/reference/`; `outputs/architecture-enhancement/` | PASS | Artifacts are uncommitted by design |
| Markdown/patch whitespace | `git diff --check` | Local repository | No whitespace errors in tracked diff | Exit 0 | Terminal result recorded in this document | PASS | Untracked Markdown is not included by normal `git diff`; final manual file inventory/content review also performed |
| TypeScript baseline | `npx tsc --noEmit` | Local visible working tree | No TypeScript errors | Exit 0, no diagnostics | Terminal result recorded here | PASS | Includes unrelated uncommitted user work; not a clean-commit proof |
| Lint baseline | `npm run lint` | Local visible working tree | No lint errors | Exit 0, no diagnostics | Terminal result recorded here | PASS | Same dirty-tree attribution limitation |
| Automated test baseline | `npm test` | Local visible working tree | Repository test suite succeeds | 96 test files passed; 678 passed, 1 skipped of 679; exit 0 | Vitest terminal result | PASS | Many tests are source contracts, not deployed SQL/browser proof |
| Production build baseline | `npm run build` (includes prebuild test) | Local build using `.env.production.local`; no server/deploy/database call initiated | Optimized Next build completes | Exit 0; 96 files/678 tests passed/1 skipped in prebuild; Next.js compiled, type-checked and generated 42 static pages | Next build terminal result | PASS | Build loaded production-named environment values locally; this confirms compile only, not production behavior or deployment |
| Clean release validation | `npm ci`; focused backup tests; `npm test`; `npm run lint`; `npx tsc --noEmit`; production-configured `npm run build` | Clean integration worktree at release branch | Dependencies install and all available gates pass | Install passed; focused backup suite 2 files/16 tests; full suite 100 files/700 passed/1 environment-dependent skip; lint and TypeScript passed; optimized build compiled and generated 43 static pages | PR `#20` checks and local release transcript | PASS | Vercel lacks system `jq`, so only the shell-integration suite is skipped there; GitHub restore runners and local focused proof include `jq` |
| Main integration | PR `#20` merge and exact-commit status inspection | GitHub `main` | Reviewable history-preserving merge with green status | Merged at `5f8d0c8355c89f3a24e0f127fc0c87ca91e89b57`; exact commit status succeeded | `https://github.com/Rajp2002/TextileAccounting/pull/20` | PASS | None identified |
| Production deployment | Vercel deployment inspection plus public Node fetch smoke | Production, read-only | Exact merge commit reaches READY; canonical public routes respond | Deployment `dpl_8CXejpq4oQpDbjQ3EnbKpZC21MAJ` READY; `/`, `/login`, `/privacy`, `/manifest.webmanifest` and `/sw.js` returned HTTP 200 | `https://textile-accounting.vercel.app` | PASS | Authenticated business flows were not mutated during release smoke |
| Tenant isolation after implementation | Not run - no implementation/schema change | N/A | No changed boundary to test | No product change | `current-state-map.md` and existing security evidence | NOT APPLICABLE | A later RPC/idempotency implementation must run wrong-role and cross-tenant integration/browser proof |
| Duplicate submission/retry after implementation | Not run - no implementation | N/A | No changed command to test | No product change | `idempotency-matrix.md` | NOT APPLICABLE | REC-005..007 remain recommendations, not verified fixes |
| Mobile workflow after implementation | Not run - no UI implementation | N/A | No changed mobile behavior | No product change | `golden-journeys.md` | NOT APPLICABLE | Existing OFF-009/OFF-010 evidence applies to its recorded build only |
| Database migration compatibility | No migration created/applied | Local source only | Database compatibility unchanged | No schema/config mutation | Git status and implementation gate | NOT APPLICABLE | Later additive migrations require linked-target assertion, local/QA validation and production-head compatibility review |
| REC-000 recovery identity containment | Analysis only; filename/status observed, contents not printed | Local repository | Recommendation documented without secret disclosure | File remains untracked and unchanged | `recommendation-register.md` | BLOCKED | Owner/operator must verify safe external copy before moving/removing; do not commit |
| REC-001 scheduled backup restore | Existing runbook/evidence inspection only | Repository evidence; no workflow/database invocation | Successful retained-artifact restore evidence | Existing scheduled run 29368765626 yielded no artifact; current ledger remains blocked | TECH-011 runbook and remaining-gate report | BLOCKED | Requires a later scheduled artifact, disposable target and safe recovery-key access |
| REC-002 independent estimator truth | Existing tests/evidence inspection only | Repository evidence | Independent factory worksheet reconciles | No independent sheet found; current ledger remains blocked | GOLDEN-A-03 references in remaining-gate report | BLOCKED | Requires authorized factory expert input; formulas must not be guessed |
| REC-003 terminology approval | Focused terminology tests plus authenticated disposable-QA owner/supervisor screenshots | Confirmed QA project; no production access | Implemented English terminology and explicit readiness owner decision | Raj approved as Founder and moved factory-operator review into the first pilot run; 5 files / 42 focused tests passed; disposable fixture cleanup passed | `output/qa/pilot-gate-closure/2026-07-17/UX-012/runtime-evidence.md`; screenshot index; active matrix | PASS | Exact Gujarati and populated factory contexts remain a mandatory pilot-run control; disagreement reopens UX-012 |
| REC-004 lean CI/golden gate | Repository workflow/test inventory | Local source | General application PR workflow and compact deployment gate exist | No general app CI workflow found; golden journeys documented only | `.github/workflows/`, `golden-journeys.md` | BLOCKED | Requires later implementation authorization and QA access |
| REC-005 stock-lot atomicity | Source inspection | Local source | One transaction and request-key replay | Current action performs separate inserts | `app/(dashboard)/owner/stock/actions.ts:624+`; `idempotency-matrix.md` | BLOCKED | Requires additive RPC/caller change and QA failure injection |
| REC-006 operator assignment atomicity | Source inspection | Local source | One all-or-nothing transition | Current action performs multiple writes and reports partial success possibility | `app/(dashboard)/owner/actions.ts:531+` | BLOCKED | Requires active/legacy caller inventory, RPC and payroll reconciliation |
| REC-007 financial request keys | Source inspection | Local source | Stable key prevents duplicate advance/kharchi/refill | Durable request keys not found on these paths | Advance/supervisor actions; `idempotency-matrix.md` | BLOCKED | Requires later migration/caller changes and response-loss QA |
| REC-008 operation correlation | Repository search for request/correlation/operation IDs and logger | Local source | User intent traceable end-to-end | Sentry/perf exist; no shared operation-ID/support-code standard found | Instrumentation files, `lib/perf.ts`, `current-state-map.md` | BLOCKED | Requires bounded implementation and safe QA Sentry/log proof |
| REC-009 representative performance | Existing performance evidence inspection | Repository evidence | Authenticated realistic fixture and budgets | Bundle reductions measured; authenticated QA run blocked; no scale fixture/p95 suite found | `docs/performance/campaign-20260715/` | BLOCKED | Requires reconciled auth work, QA target assertion and isolated data |
| REC-010 hosted Razorpay proof | Existing readiness evidence inspection | Repository evidence only | Test Mode captured payment/webhook replay reconciled | Checkout reached provider but successful hosted lifecycle was not completed | `outputs/estimator-production-readiness/estimator-final-summary.md` | BLOCKED | Required only before paying release; needs provider Test Mode inputs/access |

## Regression and environment conclusion

- **Regressions introduced by this release:** none identified by clean
  lint/type/test/build checks and public production smoke.
- **Database compatibility impact:** none.
- **Tenant-isolation impact:** none.
- **Production/QA impact:** production application assets were deployed from
  exact merge `5f8d0c8`; no production database/schema/data mutation occurred.
- **Verification caveat:** authenticated production business mutations were
  intentionally excluded from release smoke. Existing QA screenshots and
  TECH-011 runtime evidence retain their recorded environment scope.
