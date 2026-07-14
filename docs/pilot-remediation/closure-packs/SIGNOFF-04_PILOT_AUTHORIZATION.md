# SIGNOFF-04 — Limited-Pilot Authorization and First-Shift Reconciliation

Prepared: 2026-07-14 IST

Current status: `BLOCKED` (`pilot_operations`, not an independent pre-session gate)

Final authority: **Weavly owner and named pilot-factory owner**

This document has two decisions:

1. **Part A authorizes a tightly limited first supervised pilot session only after `TECH-011`, `UX-012`, and `GOLDEN-A-03` are formally `PASS`.**
2. **Part B closes `SIGNOFF-04` only after the first pilot shift's Today meters reconcile with the independently maintained supervisor register.**

A signed Part A does not make `SIGNOFF-04` `PASS`. The row stays `BLOCKED` until Part B is complete.

## Canonical requirement

> Today meters reconcile with supervisor register.

Expected: satisfied with current-run evidence.

Application-side Today/production evidence exists. `output/qa/blocked-row-campaign/B19-external-evidence-review.json` found no independent dated supervisor register for a comparable shift.

## Part A — Preconditions to pilot authorization

The authorizer must verify the canonical ledger and attach each row's actual closure artifact. A checked box without a `PASS` matrix row and evidence path is invalid.

| Required gate | Matrix status | Final evidence path/ID | Approved by/date | Verified by authorizer |
| --- | --- | --- | --- | --- |
| `TECH-011` automated retained/off-site production backup plus disposable restore/reconciliation |  |  |  | [ ] |
| `UX-012` named factory-supervisor terminology approval/change completion |  |  |  | [ ] |
| `GOLDEN-A-03` independent real-fabric truth-sheet reconciliation and downstream snapshots |  |  |  | [ ] |

Authorization rule: if any row above is not formally `PASS`, stop. Do not sign the pilot authorization.

## Pilot identity, limits, and scope

| Field | Authorized value |
| --- | --- |
| Pilot factory/legal owner |  |
| Weavly incident owner |  |
| Named supervisor(s) |  |
| Named owner account(s) |  |
| Start date/time/time zone |  |
| End/review date |  |
| Maximum shifts |  |
| Maximum looms |  |
| Maximum users |  |
| Maximum real orders/market runs |  |
| Approved device/browser/network |  |
| Approved production mode (party orders / market runs / both) |  |
| Support contact and hours |  |
| Paper-register fallback owner/location |  |

Authorized functional scope (check only what will actually be used):

- [ ] Owner and supervisor sign-in for named users only.
- [ ] Loom setup/assignment and quality/run linking.
- [ ] Online shift-meter logging for the named shifts.
- [ ] Factory Today monitoring and end-of-shift meter reconciliation.
- [ ] Estimator/quote/order flow accepted under `GOLDEN-A-03`.
- [ ] Godown stock and dispatch/receipt flow.
- [ ] Party ledger/receivables and approved payment recording.
- [ ] Worker Upaad, online Kharchi, attendance, payroll/hisaab for named pilot workers.
- [ ] Other specifically approved flow: ____________________.

Anything not checked is outside this authorization.

## Explicitly excluded or deferred functionality

- Live WhatsApp/Meta delivery, approved templates, signed callback proof, and controlled live provider-failure drills remain post-pilot (`PP-WA-001`–`PP-WA-003`). `WHATSAPP_PROVIDER` remains disabled; manual owner access-code handoff is the pilot control.
- PWA installation/standalone reopen (`OFF-001`) is optional and must not be relied upon. Use the supported browser URL.
- Public marketing or public legal reliance on unreviewed privacy wording is excluded while `SEC-018` is blocked.
- Live Sentry event-payload assurance (`SEC-011`) is deferred to the owner's physical laptop and cannot be represented as complete.
- Closed market-run reactivation is excluded (`PP-MARKET-001`).
- Offline mutation sync is not an authorized capability. Production, Kharchi, payroll, sale, dispatch, and payment saves require a connection.
- Any unlisted post-pilot item or uncontrolled production-wide rollout is excluded.

## Non-gating blockers acknowledged

| Row | Current boundary | Pilot control | Owner acknowledgment |
| --- | --- | --- | --- |
| `OFF-001` | Install/standalone reopen not proven | Browser URL only; no PWA dependency | [ ] |
| `SEC-011` | Live Sentry payload not inspected | Read-only physical-laptop check deferred; incident logs remain redacted | [ ] |
| `SEC-018` | Qualified legal review absent | Closed supervised pilot only; no public reliance | [ ] |
| `SIGNOFF-04` | First-shift external meter register not yet available | Mandatory Part B at shift end; unexplained variance pauses pilot | [ ] |

## Mandatory operating controls

- [ ] Supervisor maintains an independent paper/external meter register throughout each shift, not copied from Weavly at shift end.
- [ ] Owner reconciles per-loom and total meters at every shift end before the next shift continues.
- [ ] Writes are made online. On timeout/unknown outcome, do not resubmit blindly; refresh/reconcile authoritative state first.
- [ ] Use only named accounts; no shared credentials. Owner access codes are single-use and shared manually while WhatsApp is disabled.
- [ ] Large or corrected meter entries receive the product confirmation/authorization and a paper-register note.
- [ ] Upaad and Kharchi remain separate; cash changes are not recorded while offline.
- [ ] Backup freshness and last-success alert are checked daily by the backup owner.
- [ ] Party/worker privacy is protected in screenshots/support evidence; secrets and raw database dumps are never transferred in chat or committed.
- [ ] Every incident, variance, correction, rollback, or fallback is entered in the incident register below.
- [ ] Stop conditions are understood by the owner and supervisor.

## Stop conditions

Immediately pause affected entry and move to the paper-register fallback if any of these occurs:

- production backup freshness exceeds the approved RPO or scheduled backup fails;
- terminology is misunderstood in a way that could change money, meters, stock, or worker attribution;
- estimator/quote inputs or totals differ from the approved truth sheet beyond tolerance;
- Today meters and the supervisor register differ without a line-level explanation;
- duplicate/missing production, stock, receivable, payroll, or payment movement is suspected;
- tenant/account access appears wrong, or sensitive data/secrets may be exposed;
- the app claims success but authoritative state cannot be confirmed.

## Incident ownership and escalation

| Role | Name/contact | Authority |
| --- | --- | --- |
| Pilot incident commander |  | Pause/resume pilot; authorize fallback |
| Factory operating owner |  | Stop floor entry; preserve paper register |
| Technical owner |  | Diagnose app/deployment/database; no destructive action without approval |
| Backup/restore owner |  | Validate artifact and execute approved disposable/production recovery plan |
| Communications owner |  | Notify named users and record decisions |
| Privacy/security owner |  | Contain suspected exposure and preserve redacted evidence |

Incident register:

| ID/time | Reporter | Symptom/scope | Last confirmed good state | Immediate containment | Owner | Resolution/rollback | Resume approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PILOT-INC-001 |  |  |  |  |  |  |  |

## Rollback and fallback procedure

1. **Pause:** incident commander tells named users to stop app writes; supervisor continues the independent paper register.
2. **Preserve:** record time, route, user role, affected IDs, screenshots, and last confirmed totals. Do not print secrets or export unrelated production data.
3. **Reconcile:** determine whether the last action is absent, present once, or duplicated before retrying.
4. **Application rollback:** if the fault is deployment-only, technical owner may use the already proved Vercel last-known-good rollback procedure and verify the exact source commit, alias, `/login`, and a read-only core smoke. Record deployment IDs/times. Do not assume this rolls back database state.
5. **Database incident:** do not restore over production as a first response. Keep writes paused, preserve a fresh recovery point/dump if safe, assess data created after the candidate restore point, and obtain owner + backup-owner approval. Prefer a reviewed forward fix where it preserves valid later data. Use production restore only under the approved disaster-recovery decision with an explicit loss/downtime statement.
6. **Operational fallback:** continue on paper only within the authorization limit; do not dual-enter until a controlled reconciliation plan exists.
7. **Resume:** incident commander, factory owner, and technical owner sign the reconciliation and resume decision. Update affected registers before normal entry restarts.

## Part A — Final owner authorization

I confirm that all three prerequisite gates are formally `PASS`, evidence paths were inspected, exclusions and non-gating blockers are understood, operating/rollback controls have owners, and the limits above define the entire authorized pilot.

Decision:

- [ ] **AUTHORIZE LIMITED FIRST SUPERVISED SESSION**
- [ ] **DO NOT AUTHORIZE** — reason: ____________________

Weavly owner name/signature/date/time zone: ____________________

Pilot-factory owner name/signature/date/time zone: ____________________

Incident commander acknowledgment: ____________________

Supervisor acknowledgment: ____________________

## Part B — SIGNOFF-04 first-shift reconciliation

Supervisor register rules: record values during the shift independently of Weavly; identify date, day/night shift, loom, worker/quality/run where used, meters, corrections, and supervisor initials. The app and register must compare at the same date/shift/loom grain.

Pilot date: ______  Shift: [ ] Day [ ] Night  Time zone: ______

Deployed build/commit: ______

Supervisor register artifact ID/page range: ______

Weavly Today screenshot/export ID: ______

| Loom | Quality/run | Supervisor-register meters | Weavly meters | Variance | Correction/explanation ID | Reconciled? |
| --- | --- | ---: | ---: | ---: | --- | --- |
|  |  |  |  |  |  | [ ] |
|  |  |  |  |  |  | [ ] |
| **Total** |  |  |  |  |  | [ ] |

Meter acceptance is exact at the product/register precision after authorized corrections. Do not use a percentage tolerance or let opposite loom variances cancel. Any non-zero variance requires a line-level correction/explanation, evidence of the authoritative value, and owner approval; unresolved variance pauses the next shift.

First-shift decision:

- [ ] **RECONCILED / PASS RECOMMENDED** — every loom and total match exactly after documented authorized corrections.
- [ ] **PAUSE PILOT** — unexplained variance or missing independent register; incident ID: ______.

Supervisor name/initials/date/time zone: ____________________

Factory owner reconciliation approval: ____________________

Independent verifier: ____________________

Next-shift resume decision: ____________________

## Required closure artifacts and acceptance criteria

- [ ] Part A shows actual `PASS` evidence for `TECH-011`, `UX-012`, and `GOLDEN-A-03` and is signed by both owners.
- [ ] Pilot scope, limits, exclusions, controls, incident roles, and rollback/fallback are complete.
- [ ] An independent supervisor register was maintained during the first pilot shift.
- [ ] Same-grain Weavly Today evidence and per-loom comparison are attached.
- [ ] Every loom and total reconciles exactly after documented authorized corrections; no unexplained variance remains.
- [ ] Supervisor, factory owner, and verifier dated the result.

Only completion of the final four bullets can move `SIGNOFF-04` to `PASS`. Part A alone authorizes the controlled first session but leaves the row `BLOCKED`.

## Exact matrix-update procedure after first-shift closure

1. Store the signed authorization, prerequisite references, incident/limit sheet, independent register, Today evidence, per-loom reconciliation, and final approval under `output/qa/pilot-gate-closure/YYYY-MM-DD/SIGNOFF-04/`.
2. Edit only `SIGNOFF-04` in `results.json`: set `status` to `pass`; replace `actual` with pilot date/shift, supervisor/register ID, deployed build, per-loom and total reconciliation, correction/incident disposition, and named approvals; replace/add `evidence`; replace `notes`; set real `updatedAt`; preserve `release_scope: "pilot_operations"` and `pilot_gating: false`.
3. Update only the matching `TEST_MATRIX.md` row, recalculate counts, and verify every referenced artifact exists.
4. Reconcile the standard closeout docs to the first-shift artifact and counts. Do not change the statuses of prerequisite or non-gating rows as a side effect.
5. Run `git diff --check` and obtain a second-person evidence/matrix check before commit.

## Exact human and laptop actions still required

1. **Documentation owner:** confirm `TECH-011`, `UX-012`, and `GOLDEN-A-03` are genuinely `PASS` with complete artifacts; otherwise stop.
2. **Both owners:** fill limits/scope, assign incident roles, acknowledge exclusions/blockers, and sign Part A.
3. **Supervisor:** maintain the independent register during the authorized first shift.
4. **Owner laptop at shift end:** open `/owner/today` on the approved build, select the same date, and capture per-loom/total meters without editing records.
5. **Supervisor + owner:** compare each loom and total, investigate/correct with authorization, or pause the pilot on unexplained variance.
6. **Independent verifier:** inspect register, app evidence, corrections, and signatures; sign Part B.
7. **Documentation operator:** follow the exact matrix procedure. Keep `SIGNOFF-04` `BLOCKED` until step 6 succeeds.
