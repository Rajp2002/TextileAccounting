#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const matrixPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')
const evidence = ['output/qa/blocked-row-campaign/B16-qa-whatsapp.json']
const outcomes = {
    'WA-001': 'An opted-in worker advance remained committed and produced one simulated sent delivery bound to the worker phone and a unique provider message ID.',
    'WA-002': 'An opted-out worker advance remained committed while delivery was skipped and persisted as skipped_opted_out.',
    'WA-003': 'Missing consent and missing phone produced distinct persisted skip reasons without rolling back either advance.',
    'WA-004': 'A deterministic provider timeout produced a failed operational log with manual-fallback context while the core advance remained committed.',
    'WA-005': 'The payslip summary and itemized follow-up stayed bound to the settled worker and consent phone; a mismatched consent phone was skipped and received no PII.',
    'WA-006': 'The access code reached only the opted-in tenant owner in simulation, remained tied to the intended profile, and plaintext code was absent from the delivery snapshot.',
    'WA-007': 'Deadline, daily, and monthly idempotency grains independently suppressed duplicates; daily and monthly briefs each produced exactly one delivery.',
    'WA-009': 'A targeted retry recovered one eligible failure and incremented retry history once; retry_count 3 and older-than-24-hour failures remained untouched.',
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
    item.evidence = evidence
    item.notes = 'B16 deterministic QA provider proof against disposable tenant data; exact implementation deployed to production without contacting the live Meta provider; cleanup reconciled organizations, profiles, auth users, and delivery logs to zero.'
    item.updatedAt = updatedAt
}

const liveFailure = byId.get('WA-010')
if (!liveFailure || liveFailure.status !== 'blocked') throw new Error(`Expected WA-010 to remain blocked, found ${liveFailure?.status}`)
liveFailure.actual = 'Deterministic template-rejected and expired-token modes produced failed operational logs with explicit manual-fallback guidance. The required live Meta rejection or expired-token event was not triggered against a consented recipient, so live-provider behavior remains unverified.'
liveFailure.evidence = evidence
liveFailure.notes = 'Precise external dependency: controlled live Meta credentials plus a consented recipient and authorization to induce rejection/expired-token behavior. Simulator proof is recorded but is not substituted for the row’s live requirement.'
liveFailure.updatedAt = updatedAt

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
for (const id of [...Object.keys(outcomes), 'WA-010']) {
    const rowIndex = matrixLines.findIndex((line) => line.startsWith(`| ${id} |`))
    if (rowIndex < 0) throw new Error(`Matrix row ${id} not found.`)
    matrixLines[rowIndex] = renderRow(byId.get(id))
}
await fs.writeFile(matrixPath, matrixLines.join('\n'))

process.stdout.write(`${JSON.stringify({ updated_to_pass: Object.keys(outcomes), retained_blocked: ['WA-010'], counts: { ...counts, total: ledger.items.length } }, null, 2)}\n`)
