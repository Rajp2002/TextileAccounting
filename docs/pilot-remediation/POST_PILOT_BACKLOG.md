# Canonical Post-Pilot Backlog

This backlog is the named destination for requirements explicitly removed from the limited pilot. A matrix row may be `not_applicable` only when its exact requirement is outside pilot scope and it links to one item here. Pilot infrastructure must continue to operate safely while these capabilities are absent.

## Scope contract

- `pilot_core`: unresolved rows independently gate the limited pilot.
- `pilot_optional`: useful pilot surface, but the documented limited-pilot workflow does not depend on it.
- `pilot_operations`: evidence is generated during routine pilot operation, not before the first session.
- `pilot_assurance_deferred`: assurance evidence is intentionally deferred behind a precise external prerequisite.
- `pre_public_release`: required before public reliance, but not before a closed, supervised pilot.
- `post_pilot`: no pilot PASS is claimed; work remains here under a specific acceptance test.
- `pilot_gating=true`: an unresolved row independently blocks the limited pilot verdict.

## PP-WA-001 — Live Meta provider activation

Owner: product owner and an authorized Meta Business administrator.

Activate the WhatsApp Cloud API only after the pilot. Configure the Meta business account, consented recipients, approved templates, provider credentials, sender number, webhook verification, operational ownership, and secret rotation. Core order, production, stock, commercial, payroll, and access-code workflows must continue to work with `WHATSAPP_PROVIDER` absent or set to `disabled`.

Acceptance: the provider is explicitly set to `meta`; approved templates and consent boundaries are verified; secrets remain server-only; no core write depends on notification success; an operational disable/rollback procedure exists.

## PP-WA-002 — Signed status webhook

Source row: `WA-008` — “Webhook valid/invalid signature and status callback.” Expected: “Only valid callback updates intended delivery row.”

Dependency: PP-WA-001 plus an authorized Meta signing secret, a disposable delivery row tied to a consented test recipient, and a controlled callback exercise.

Acceptance: missing, malformed, and forged signatures are rejected before delivery lookup; a valid Meta HMAC callback updates exactly the intended row; replay/regression cannot corrupt a newer terminal state; test records are reconciled and removed. No secret value is printed or committed.

## PP-WA-003 — Live provider failure drill

Source row: `WA-010` — “Live template rejection or expired token.” Expected: “Clear operational log and manual fallback.”

Dependency: PP-WA-001, a consented test recipient, and explicit owner authorization to induce a template rejection or use a controlled expired token.

Acceptance: the live failure produces a non-secret operational record, a clear manual-fallback instruction, no rollback of the core business write, and no repeated or duplicate message. Deterministic simulator evidence may support the drill but cannot replace it.

## PP-MARKET-001 — Closed market-run reactivation

Source row: `MARKET-012` — “Reopen/reactivate closed run, if allowed.” Expected: “No duplicate backing order or stock.”

The current product intentionally exposes no reopen/reactivate control. If reactivation is later introduced, specify the lifecycle and prove that reopening cannot duplicate the backing order, production attribution, or stock.
