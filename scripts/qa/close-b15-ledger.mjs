#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const matrixPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')
const commonEvidence = [
    'output/qa/blocked-row-campaign/B15-qa-security.json',
    'output/qa/blocked-row-campaign/B15-qa-browser.json',
    'output/qa/blocked-row-campaign/B15-qa-http.json',
    'output/qa/blocked-row-campaign/B15-production-security.json',
]
const outcomes = {
    'AUTH-005': 'A fresh recovery token changed the password; the old password and reused token were rejected, and a token aged two hours was rejected in both QA and production.',
    'AUTH-014': 'An authenticated owner request succeeded before the threshold; a last_activity value older than one hour produced a 307 redirect to /login without organization or email content.',
    'AUTH-018': 'Auth rate-limit keys use the normalized first forwarded client IP and retain the route key prefix, so separate proxy clients do not share one global lockout bucket.',
    'SEC-009': 'The responsive Settings export action completed for the current organization and wrote an actor/org/record-scoped EXPORT audit row; tenant isolation was independently verified.',
    'SEC-010': 'The one-time-code and DPDP confirmation path atomically erased worker PII while retaining production meters/rate basis and redacted historical audit payloads, in QA and production.',
    'SEC-012': 'Stored hostile markup remained inert text across orders, dispatches, workers, and Estimator: no image/handler injection and no execution flag occurred.',
    'SEC-013': 'A request using a valid same-user cookie and exact server-action ID from a foreign Origin was rejected without mutation; idle-cookie attributes were HttpOnly and SameSite=Lax.',
    'SEC-015': 'Deletion, write-off, settings change, export, and DPDP erasure audits retained actor, organization, action, record, timestamp, and before/after context while redacting worker PII.',
    'UX-006': 'Keyboard Enter opened a custom order card, worker icon actions exposed accessible names, audit disclosures were semantic buttons, and native authentication controls remained keyboard operable.',
    'UX-009': 'At a 720x450 CSS viewport equivalent to 1440x900 at 200% zoom, Settings, Orders, and Today had no horizontal overflow or clipped visible controls.',
}

const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'))
const byId = new Map(ledger.items.map((item) => [item.id, item]))
const updatedAt = new Date().toISOString()

for (const [id, actual] of Object.entries(outcomes)) {
    const item = byId.get(id)
    if (!item) throw new Error(`Missing ledger row ${id}`)
    if (item.status !== 'blocked') throw new Error(`Expected ${id} to be blocked, found ${item.status}`)
    item.status = 'pass'
    item.actual = actual
    item.evidence = [...commonEvidence]
    item.notes = 'B15 direct QA browser/HTTP/database proof plus exact-deployment production database proof; migrations deployed in QA and production; all disposable tenants, profiles, auth users, worker history, and audit fixtures reconciled to zero.'
    item.updatedAt = updatedAt
}

const pwa = byId.get('OFF-001')
if (!pwa || pwa.status !== 'blocked') throw new Error(`Expected OFF-001 to remain blocked, found ${pwa?.status}`)
pwa.actual = 'Production manifest, exact 192/512 icons, standalone display, /login start route, service-worker update handler, visible update notice, and refresh activation passed. Actual browser installation and standalone reopen remain unverified because the in-app browser has no install/standalone surface and the Chrome extension was unavailable after retry.'
pwa.evidence = [
    'output/qa/blocked-row-campaign/B15-qa-browser.json',
    'output/qa/blocked-row-campaign/B15-qa-http.json',
]
pwa.notes = 'Precise external capability blocker only: repeat install and reopen on a supported Chrome/Android PWA surface. No other OFF-001 acceptance criterion is open.'
pwa.updatedAt = updatedAt

await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)

const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')
const renderRow = (item) => `| ${[
    item.id, item.section, item.scenario, item.expected, item.status, item.actual,
    (item.evidence ?? []).join('; '), item.severity ?? '',
].map(escapeCell).join(' | ')} |`
const counts = Object.fromEntries(
    Object.entries(Object.groupBy(ledger.items, (item) => item.status))
        .map(([status, items]) => [status, items.length])
)
const matrixLines = (await fs.readFile(matrixPath, 'utf8')).split('\n')
const statusLine = matrixLines.findIndex((line) => line.startsWith('- Status:'))
if (statusLine < 0) throw new Error('Matrix status summary line not found.')
matrixLines[statusLine] = `- Status: pass=${counts.pass ?? 0}, fail=${counts.fail ?? 0}, blocked=${counts.blocked ?? 0}, not_applicable=${counts.not_applicable ?? 0}, code_verified=${counts.code_verified ?? 0}, not_run=${counts.not_run ?? 0}`
for (const id of [...Object.keys(outcomes), 'OFF-001']) {
    const rowIndex = matrixLines.findIndex((line) => line.startsWith(`| ${id} |`))
    if (rowIndex < 0) throw new Error(`Matrix row ${id} not found.`)
    matrixLines[rowIndex] = renderRow(byId.get(id))
}
await fs.writeFile(matrixPath, matrixLines.join('\n'))

process.stdout.write(`${JSON.stringify({ updated_to_pass: Object.keys(outcomes), retained_blocked: ['OFF-001'], counts: { ...counts, total: ledger.items.length } }, null, 2)}\n`)
