# Compliance and Admin

Last analyzed from the active codebase on May 6, 2026.

## Phase 1 Status

Deferred from Phase 1 polish except for security/access-control pieces that protect the core operating loop.

## What It Does

The compliance/admin area covers governance features such as notices, grievances, language requests, DPA templates, DPA signatures, audit logs, export logs, breach reports, tenant lockdown, platform security records, and compliance settings.

## User Workflow

Admin/deferred workflow:

1. Admin opens `/admin`.
2. Admin reviews compliance state, notices, grievances, exports, DPA, breaches, and lockdowns.
3. Admin updates notices or DPA templates.
4. Admin locks or unlocks tenants where required.
5. Admin reviews breach reports and generates templates.

Owner/deferred workflow:

1. Owner opens `/owner/settings/audit` for audit trail.
2. Owner opens DPA/security settings where enabled.
3. Owner exports or deletes organization data where controls exist.

## Existing Workflow Translation

Old workflow:

- Compliance proofs live in files, paper notices, PDFs, or WhatsApp.
- Auditability depends on trust and memory.
- Breach/lockdown response is manual.

Weavly workflow:

- Compliance artifacts become structured records.
- Sensitive actions are logged.
- Lockdown and breach workflows have explicit records.

## Phase 1-Relevant Security Pieces

Even though admin polish is deferred, several security pieces are Phase 1-relevant:

- Role guards for owner/supervisor/admin.
- RLS and org-scoped data access.
- One-time access codes for protected actions.
- Access-code rate limiting and lockout.
- Audit logging for corrections and destructive actions.
- Session revocation and inactivity timeout.
- Archived route redirects.

## Data and Code

- `app/(dashboard)/admin/page.tsx`
- `app/(dashboard)/owner/settings/audit`
- `app/owner/settings/dpa/page.tsx`
- `lib/actions/compliance.ts`
- `audit_log`
- `notice_registry`
- `worker_consent_artifacts`
- `grievances`
- `language_requests`
- `dpas`
- `organization_dpas`
- `platform_security`
- `breach_reports`
- `compliance_settings`

## Readiness Notes

- Do not make admin/compliance completeness a Phase 1 launch blocker unless legal/security review requires it.
- Keep route archive behavior and access controls accurate.
- Security-sensitive pieces should remain tested even when UI polish is deferred.
