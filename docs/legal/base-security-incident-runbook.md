# Weavly Base Plan Security Incident Runbook

Status: launch operating procedure

Scope: Weavly Estimator Base Plan initial rollout

Primary incident owner: Raj Patel

Monitored contact: rajpatel86420@gmail.com

This is an internal operating procedure, not legal advice or a substitute for incident-specific counsel. Re-check the law and reporting portals in force when an incident occurs.

## 1. Launch scope

This runbook covers incidents involving:

- account and authentication information;
- costings and business-contact information entered with a costing;
- billing references and subscription records (not complete card, bank, or UPI credentials);
- support, privacy, and grievance communications; and
- technical, diagnostic, and security logs.

Production, worker, attendance, payroll, advance, inventory, stock, order, and dispatch data are Full Suite future scope. If the affected deployment has any Full Suite feature enabled, do not rely on this Base-only scope assessment.

## 2. Intake and the awareness time

Open an operator-only `security_incidents` record as soon as a credible report or alert is received. Record the earliest time Weavly became aware of facts indicating a possible cyber or personal-data incident. Do not delay the awareness time while waiting for confirmation.

Store known facts, source, affected Base Plan surface, and immediate actions. Do not put passwords, OTPs, tokens, private keys, payment credentials, government identifiers, or active exploit instructions in the incident register.

## 3. First-response checklist

1. Preserve relevant logs and evidence without modifying originals.
2. Secure affected accounts, credentials, sessions, keys, integrations, or deployment access as proportionate to the risk.
3. Contain the affected feature or tenant when safe to do so; record exactly what changed and when.
4. Establish whether data was merely at risk, viewed, altered, lost, encrypted, exported, or disclosed.
5. Identify affected systems, providers, organizations, people, data categories, and time range.
6. Contact the affected provider through its security/support process when provider evidence or containment is needed.
7. Keep customer communications factual. Do not speculate about cause, impact, or legal reportability.

## 4. Severity guide

- **Critical:** active compromise, privileged access, secrets exposed, material cross-tenant access, destructive activity, or a large/unknown affected population.
- **High:** confirmed unauthorized access to personal or commercially sensitive Base data, persistent account takeover, or material provider compromise.
- **Medium:** contained unauthorized activity with limited scope, or a credible vulnerability with no confirmed exploitation.
- **Low:** unsuccessful suspicious activity, benign misconfiguration with no exposure, or a report shown to have no security impact.

Keep severity as `unassessed` until there is enough evidence. Severity is an operational prioritization and does not decide legal reportability.

## 5. Legal-clock assessment

### Current CERT-In assessment

Immediately assess whether the event is one of the cyber incidents reportable under the CERT-In directions issued under section 70B. The internal register calculates six hours from `aware_at` so the operator does not miss the current reporting window for an applicable incident. The six-hour direction does not mean every support ticket, vulnerability report, or suspected event must be reported.

If reportable:

1. submit the information then available through a current CERT-In reporting channel within the applicable period;
2. preserve the submission time and CERT-In reference in the incident record; and
3. provide supplementary information as it becomes available.

### DPDP notification readiness

The Base workflow includes fields for Data Protection Board and affected-person notification readiness. At this runbook date, those provisions follow the DPDP framework's notified commencement schedule. Leave the assessment as `not_yet_applicable` unless the relevant provisions are legally in force and apply to the incident.

When those provisions are in force, re-check the current rule text. The final 2025 Rules contemplate notice to affected individuals without delay and an initial Board intimation followed by detailed information within 72 hours, but this runbook must not be used to represent a future clock as a presently operative blanket deadline.

## 6. Customer notification decision

Record the decision and rationale even when notification is not required. If notification is required, prepare a clear message covering:

- what happened, including the nature, extent, and known timing;
- the likely consequences for the recipient;
- measures already taken or underway;
- practical steps the recipient can take; and
- the monitored contact for questions.

Do not include another customer's information, unverified attribution, secrets, or unnecessary exploit detail.

## 7. Recovery and closure

Before closure, document containment, root cause or best-supported cause, affected scope, notifications and references, remediation, restored controls, residual risk, and follow-up owner. A record may be closed only when immediate response work is complete; longer-term hardening items should remain tracked separately.

## 8. Launch check

- `/security-incident` is public and linked from the footer, Privacy Policy, and owner settings.
- The monitored email is accessible and checked at least every business day.
- The operator-only migration has been applied and browser roles have no table privileges.
- The admin can open a test incident, observe the six-hour assessment time, update status, and close the record.
- Current CERT-In contact/reporting information has been bookmarked outside the application.
- Provider security contacts for Supabase, Vercel, Razorpay, and Sentry are available to the operator.
