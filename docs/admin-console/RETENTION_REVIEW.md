# Retention review plumbing

The founder can read policy metadata and active retained-record holds through `getRetentionReview()`. The additive migration `20261004190000_admin_retention_review.sql` creates no policy rows, holds, purge job or disposal operation. Every class begins **unconfigured**, and the review status begins **incomplete**. Automatic purge remains disabled even if reviewed numeric periods are later recorded.

The owner approved case-by-case retained-record review and retention review screens on 4 October 2026. That approval does not supply numeric periods, authorize real erasure or install production policy rows. Raj remains the operational owner through the separately implemented formal workflow.

| Record class | Review scope | Supported hold source |
| --- | --- | --- |
| Ordinary support | Ticket and public conversation/state records | Support ticket UUID |
| Internal notes | Private support note records | Internal note UUID, linked to its ticket |
| Privacy cases | Current Weavly `DATA_PRIVACY` grievance register and case history | Grievance UUID with matching current register classification |
| Security incidents and audit | Existing security incident register, case history and founder audit | Incident or audit-event UUID |
| Billing evidence | Payment evidence and the reporting projection; original financial authority remains unchanged | Billing fact or reconciliation-coverage UUID |
| Reporting data | Reporting classification and associated reviewed reporting metadata | Organization classification UUID |

Hold support is intentionally limited to the listed sources. This inventory is not a legal conclusion, an exhaustive inventory of every customer record, or a complete deletion executor. Other retained billing, privacy, notice, DPA and legacy references remain subject to the independent retained-record review gate.

## Metadata contract

`private.admin_retention_policies` stores append-only versions per class. A version records a non-secret approval reference, approving Auth UUID, approval/effective instants, summary, optional review-due instant, period mode and anchor. A fixed period requires exact positive integer days. Manual review requires no numeric period and keeps the review incomplete. Anchor/class combinations are checked. Versions cannot overwrite prior approval evidence or backdate an effective version over a later scheduled version. Future versions are disclosed but do not replace the currently effective version.

The 1–36,500-day input bound is a technical validation bound, not a recommended or legal retention period. Numeric policy choice requires separate reviewed approval. The application has no policy configuration mutation endpoint and no direct private-table grants, including to its service role. Approved setup therefore requires a separately reviewed operator/database change with verified approval evidence.

`private.admin_retention_holds` requires reason, non-secret reference, actor and finite timestamp. A fixed allowlisted lookup validates the source and derives its organization. The guarded read rechecks current linkage; a missing or changed source remains a visible review issue. Existing evidence is retained after an explicit release with release reason, actor and time. No automatic source cascade or operational hard-delete is installed.

`review_ready` describes current metadata only: all six classes have effective approved exact periods, none is overdue for review, and no active source linkage issue remains. It does not authorize a release, certify compliance or enable disposal. Missing policies, manual review, overdue approval review and broken source links produce `incomplete`.

## Authorization and integration

The server loader checks `requireFounder()` before querying. The only new exposed function, `public.admin_retention_review`, is restricted to `service_role` and independently checks the live grant, verified AAL2 provider session, server idle/absolute limits and revocation. Its list limit is 1–100 with stable timestamp/UUID pagination and a bounded snapshot cursor. Private source lookup functions have no application EXECUTE privilege. DTO validation permits only reviewed metadata, with no ticket bodies, private notes, provider payloads or credentials. Required read auditing records a safe count, never policy or hold text.

The retained-record deletion review in migration `20261004170000` checks policy approvers, hold actors, stored organization and current fixed source linkage. A null organization on an audit hold does not hide a current tenant actor reference. Root owns the retention page/API cache boundaries, formal workflow and release gate.

## Validation and rollback

The named tests are `__tests__/admin-retention.test.ts`, `__tests__/admin-retention-dal.test.ts` and `__tests__/db/admin-retention.dbtest.ts`. Database fixtures use the repository's disposable loopback PostgreSQL harness and synthetic identities only. They prove default unknown policy state, direct privilege denial, grant/AAL/session checks, exact-period/approval validation, immutable versions, fixed source linkage, hold release history and pagination. The deletion-review integration is covered by `__tests__/db/admin-retained-records.dbtest.ts`.

Rollback disables the guarded retention read route/UI. Preserve additive policy and hold evidence; do not drop populated tables, relax founder checks or run disposal. Correct policy decisions through a reviewed new version. Production migrations, approved numeric periods and any future disposal executor remain separate gates.

Migration provenance: created with `supabase migration new admin_retention_review` as `20261004123814`, then reordered to `20261004190000` after the reviewed dependencies. No hosted database or provider read was used.
