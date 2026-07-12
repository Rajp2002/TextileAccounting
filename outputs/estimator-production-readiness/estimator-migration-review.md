# Estimator Migration Review

Production project `vzhwahudircrpgtitwzd` contains the required installed migrations:

1. `20260710054420_estimator_production_readiness_hardening`
2. `20260710110907_enforce_standalone_estimator_boundary`
3. `20260710112640_estimator_billing_atomic_activation`

They were not reapplied, rewritten, squashed, renamed, or replaced. The first migration added lifecycle/snapshot hardening and populated defaults for 29 historical Estimator quotes. The boundary migration enforces Base/Premium access at the database boundary. The billing migration adds atomic activation, service-only execution, per-organization locking, idempotent reconciliation, and a maximum one-year extension.

No later unrelated local migrations were applied as part of this campaign.

Separate impact: `20260709080948_machine_operator_payroll_v2` inserted 315 machine-operator defaults and updated 88 production-log rows across 9 organizations. That work is unrelated to Estimator readiness and was not reversed or attributed to these fixes.

Rollback posture: application rollback is available through the prior Vercel deployment. Schema changes are additive/hardening-oriented and should be recovered with a reviewed forward migration; do not reverse production RLS or lifecycle constraints casually. Preserve the pre-existing abandoned checkout `1dee81c8-e3a4-417a-8495-4728e2e0d774`.
