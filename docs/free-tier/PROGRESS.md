# Weavly Free execution tracker

Source: execution brief v1.0, superseded by the user’s 9 September shared-UI/saved-costing/export clarification. Baseline `89a19d5413650c37ecd810b495a2b89adea70e92`. Unrelated untracked weaving research preserved. Full implementation continued on 9 September.

| Sprint | Implementation and local evidence | Remaining acceptance dependency |
|---|---|---|
| S0 | Engine, auth, persistence, billing and baseline mapped; baseline unit/type and lint recorded | Touched estimator lint errors corrected; baseline evidence retained |
| S1 | Explicit Free grants/private enrollment, shared guards, Data API/RLS/Storage restrictions; real Auth/DB checks pass | Approved deployed signup/verification journey |
| S2 | Atomic two-per-week meter, trusted India reset, HMAC identities, concurrency/replay/rollback tests and real API checks pass | Operational metadata retention review |
| S3 | Actual Lite estimator component, atomic saved snapshots, export without quota, stale-result handling; revised DB/API/browser checks pass | Native dirty-navigation/PWA resume and deployed telemetry audit |
| S4 | en/gu/hi fixed sample, skip/restart, keyboard focus, mobile screenshots | Native terminology/domain review; actual screen reader/zoom/reduced-motion checks |
| S5 | Existing checkout, verified in-place Lite activation preserves changed inputs; explicit Save creates one paid quality/costing while preserving Free history; local transaction replay passes | Real sandbox gateway success/cancel/failure/delayed-callback browser journey |
| S6 | Content-free events, eligible/mature cohort denominators, service-only support and retention; cleanup tested, cron inactive | Reviewed cohort eligibility/retention; deployed collection check |
| S7 | Integrated local SQL/API/browser checks, successful final production build, changed-file lint/type checks; broad regression failures corrected and focused reruns pass | Five owner sessions, remaining device/performance/provider checks, production approval |

**Release status: BLOCKED.** Implementation is present and locally exercised. Production migrations, deployment, beta/public enrollment and real charges have not occurred. Three rollout flags default false; the retention job defaults inactive. Disabling rollout retains all authorization guards and paid access.

Policy implemented behind flags: two successful explicit costings per Monday 00:00 Asia/Kolkata week, no carryover, changed effective inputs consume another unit, retry of the same request consumes once, 30-day receipt lifetime. Completed costing content is saved until account deletion, as explicitly requested. Unsubmitted drafts and reusable qualities are not persisted; Rate Book propagation is disabled. Two weekly costings and exports are confirmed by the user; operational metadata retention and production launch remain review gates.

Detailed commands, actual outcomes, changed-file map, screenshots, persistence/telemetry audit and unresolved gates: [EVIDENCE.md](EVIDENCE.md). Configuration/support/rollback: [OPERATIONS.md](OPERATIONS.md).
