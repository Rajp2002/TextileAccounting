#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const runRoot = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH')
const ledgerPath = path.join(runRoot, 'results.json')
const matrixPath = path.join(runRoot, 'TEST_MATRIX.md')
const evidenceRef = 'output/qa/remaining-gate-campaign/OFF-009-OFF-010-runtime.json'
const updatedAt = new Date().toISOString()

const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'))
const byId = new Map(ledger.items.map((item) => [item.id, item]))

ledger.scopeModel = {
    version: 1,
    adopted_at: updatedAt,
    release_scope_field: {
        pilot_core: 'Required before a limited pilot starts.',
        pilot_optional: 'Useful pilot surface that may remain unavailable without breaking the limited browser pilot.',
        pilot_operations: 'Evidence produced during routine pilot operation rather than before the first pilot session.',
        pilot_assurance_deferred: 'Assurance evidence intentionally deferred behind a precise external prerequisite.',
        pre_public_release: 'Required before public reliance, but not before a closed limited pilot.',
        post_pilot: 'Explicitly outside pilot scope and tracked by a named backlog item.',
    },
    pilot_gating_field: 'True means an unresolved row independently blocks the limited pilot verdict.',
    status_rule: 'not_applicable is used only when the exact requirement is outside pilot scope or the capability is absent by product decision; every such row links to a named backlog item.',
    post_pilot_backlog: 'docs/pilot-remediation/POST_PILOT_BACKLOG.md',
}

for (const item of ledger.items) {
    item.release_scope = 'pilot_core'
    item.pilot_gating = true
}

const scopeOverrides = {
    'MARKET-012': ['post_pilot', false, 'PP-MARKET-001'],
    'WA-008': ['post_pilot', false, 'PP-WA-002'],
    'WA-010': ['post_pilot', false, 'PP-WA-003'],
    'OFF-001': ['pilot_optional', false],
    'SEC-011': ['pilot_assurance_deferred', false],
    'SEC-018': ['pre_public_release', false],
    'SIGNOFF-04': ['pilot_operations', false],
}

for (const [id, [releaseScope, pilotGating, backlogId]] of Object.entries(scopeOverrides)) {
    const item = byId.get(id)
    if (!item) throw new Error(`Missing scope row ${id}`)
    item.release_scope = releaseScope
    item.pilot_gating = pilotGating
    if (backlogId) item.post_pilot_backlog_id = backlogId
}

const updates = {
    'WA-008': {
        expectedStatus: 'fail',
        status: 'not_applicable',
        classification: 'F',
        actual: 'The deployed webhook boundary fails closed when META_APP_SECRET is absent and rejects unsigned or forged callbacks before delivery lookup. Proving a valid Meta-signed status callback updates exactly one intended delivery row requires live provider signing configuration and is not an infrastructure-readiness requirement for the disabled-WhatsApp pilot.',
        evidence: [
            'output/qa/runtime-remediation-20260711/RUNTIME_EVIDENCE.md',
            '__tests__/release-runtime-config.test.ts',
            'supabase/functions/whatsapp-webhook/index.ts',
            'docs/pilot-remediation/POST_PILOT_BACKLOG.md#pp-wa-002-signed-status-webhook',
        ],
        notes: 'Requirement-definition correction: fail-closed webhook infrastructure remains documented and tested; provider delivery/status proof is explicitly post-pilot under PP-WA-002. No PASS credit is claimed.',
    },
    'WA-010': {
        expectedStatus: 'blocked',
        status: 'not_applicable',
        classification: 'D',
        actual: 'Deterministic non-production rejection and expired-token modes already produce operational logs with manual-fallback guidance. The exact row explicitly requires a live Meta failure, which is outside the pilot because live WhatsApp delivery is post-pilot.',
        evidence: [
            'output/qa/blocked-row-campaign/B16-qa-whatsapp.json',
            'docs/pilot-remediation/POST_PILOT_BACKLOG.md#pp-wa-003-live-provider-failure-drill',
        ],
        notes: 'Explicitly post-pilot under PP-WA-003. No live Meta credential, recipient, message, rejection, or expired-token event was used, and no PASS credit is claimed.',
    },
    'OFF-009': {
        expectedStatus: 'fail',
        status: 'pass',
        classification: 'A',
        actual: 'A production-targeted supervisor fixture submitted 42 m through a one-shot proxy that delayed the server-action response for 17 seconds, beyond the 15-second client timeout. The save control disabled immediately; the UI treated the response as unknown, performed authoritative reconciliation, and reported that the shift was saved. Database proof found exactly one 42 m row, with no duplicate, and the browser recorded zero errors or warnings.',
        evidence: [evidenceRef, 'output/playwright/prepilot-remaining-gates/OFF-009-delayed-response-reconciled.png', '__tests__/off-009-mutation-outcome.test.ts'],
        notes: 'The earlier production safe-update blocker is no longer present. Exact QA fixture-prefix cleanup reconciled to zero after a target-mismatch guard was added to the fixture harness.',
    },
    'OFF-010': {
        expectedStatus: 'fail',
        status: 'pass',
        classification: 'B',
        actual: 'At a 390x844 mobile viewport with 1200 ms latency, 64 KB/s download, and 24 KB/s upload, the supervisor submitted 21 m once; the save control disabled immediately and the database contained exactly one 21 m row. Shift Meters, Workers, Attendance, and Machines remained usable without an error overlay, console error, or warning. The requirement does not demand offline mutation queuing.',
        evidence: [evidenceRef, 'output/playwright/prepilot-remaining-gates/OFF-010-mobile-3g-core-flow.png'],
        notes: 'Promoted only after throttled runtime and database proof. Intermittent/offline write sync remains outside this exact row and is not implied by the PASS.',
    },
}

for (const [id, update] of Object.entries(updates)) {
    const item = byId.get(id)
    if (!item || item.status !== update.expectedStatus) {
        throw new Error(`Expected ${id}=${update.expectedStatus}, found ${item?.status}`)
    }
    item.status = update.status
    item.actual = update.actual
    item.evidence = update.evidence
    item.notes = update.notes
    item.disposition_classification = update.classification
    item.updatedAt = updatedAt
}

const classifications = {
    'TECH-011': 'C',
    'OFF-001': 'C',
    'SEC-011': 'C',
    'SEC-018': 'C',
    'UX-012': 'C',
    'GOLDEN-A-03': 'C',
    'SIGNOFF-04': 'E',
}
for (const [id, classification] of Object.entries(classifications)) {
    const item = byId.get(id)
    if (!item) throw new Error(`Missing classification row ${id}`)
    item.disposition_classification = classification
}

const sec011 = byId.get('SEC-011')
sec011.notes = 'Precise external prerequisite only: the owner must use the physical laptop where SENTRY_AUTH_TOKEN is already controlled to run a read-only, PII-redacted live-event inspection. Codex must not obtain, expose, fabricate, replace, or request transfer of the token.'
sec011.updatedAt = updatedAt

await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)

const counts = Object.fromEntries(['pass', 'fail', 'blocked', 'not_applicable', 'code_verified', 'not_run'].map((status) => [status, ledger.items.filter((item) => item.status === status).length]))
const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')
const rows = ledger.items.map((item) => `| ${[
    item.id,
    item.section,
    item.scenario,
    item.expected,
    item.status,
    item.release_scope,
    item.pilot_gating ? 'yes' : 'no',
    item.actual,
    (item.evidence ?? []).join('; '),
    item.severity ?? '',
].map(escapeCell).join(' | ')} |`).join('\n')

const matrix = `# ${ledger.runId} Pre-Pilot Test Matrix

- Base URL: ${ledger.baseUrl}
- Guide: ${ledger.guide}
- Initialized: ${ledger.initializedAt}
- Total items: ${ledger.items.length}
- Status: pass=${counts.pass}, fail=${counts.fail}, blocked=${counts.blocked}, not_applicable=${counts.not_applicable}, code_verified=${counts.code_verified}, not_run=${counts.not_run}
- Scope model: \`results.json.scopeModel\`; named post-pilot work: \`docs/pilot-remediation/POST_PILOT_BACKLOG.md\`.

| ID | Section | Scenario | Expected | Status | Release scope | Pilot gating | Actual | Evidence | Severity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}
`
await fs.writeFile(matrixPath, matrix)

if (counts.pass !== 367 || counts.fail !== 0 || counts.blocked !== 7 || counts.not_applicable !== 3) {
    throw new Error(`Unexpected closing counts: ${JSON.stringify(counts)}`)
}

process.stdout.write(`${JSON.stringify({ updated: Object.keys(updates), counts, scope_model: ledger.scopeModel.version }, null, 2)}\n`)
