#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const matrixPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')
const evidence = [
    'output/qa/blocked-row-campaign/B17-qa-razorpay.json',
    'output/qa/blocked-row-campaign/B17-production-runtime.json',
]
const outcomes = {
    'BILL-003': 'Hosted Razorpay TEST checkout through Netbanking and Bank of Baroda produced exactly one initial capture; a failed renewal preserved paid access and a later successful renewal appended exactly 365 days with one additional capture.',
    'BILL-004': 'A signed same-event replay returned duplicate success, while order.paid and payment.captured converged on one payment state without an extra capture, entitlement extension, or refund.',
    'BILL-005': 'An invalid Razorpay HMAC returned 400 before event claim and produced no webhook-ledger, billing, entitlement, referral, or refund mutation.',
    'BILL-006': 'A failed renewal remained recorded without revoking the paid period, cancellation retained access through period end, no endpoint falsely enabled auto-renewal, and a later success extended the anchored period correctly.',
    'BILL-007': 'Canonical provider state prevented a late failed event from regressing captured payment; explicit failed-to-captured reconciliation succeeded, and older lifecycle events could not regress cancellation or expiry.',
    'BILL-009': 'The pending referral converted once and reserved exactly one provider-idempotent 10% Razorpay TEST refund; replay could not reserve or issue a second refund, and the production claim boundary matched.',
    'BILL-010': 'After paid-period expiry the same authenticated session was redirected away from gated application content while its account, profile, payment, and subscription history remained preserved.',
    'SEC-007': 'Webhook HMAC validation ran before event claim; the same ID and body replayed as a duplicate, the same ID with a different body returned 409, and production alias proof showed no extra mutation or refund.',
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
    item.notes = 'B17 used Razorpay TEST mode only: hosted Bank of Baroda netbanking QA plus signed lifecycle/replay probes and exact-deployment production boundary proof. Implementation commit 57caa6e6f15f25b6e26654a1d3cfc4b431452e9b is deployed as dpl_AjR5NjfcewVpx9kS2cNXBU89v8fw; no real money moved and every disposable QA/production organization, profile, auth user, billing row, webhook event, and refund reconciled to zero.'
    item.updatedAt = updatedAt
}

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
for (const id of Object.keys(outcomes)) {
    const rowIndex = matrixLines.findIndex((line) => line.startsWith(`| ${id} |`))
    if (rowIndex < 0) throw new Error(`Matrix row ${id} not found.`)
    matrixLines[rowIndex] = renderRow(byId.get(id))
}
await fs.writeFile(matrixPath, matrixLines.join('\n'))

process.stdout.write(`${JSON.stringify({ updated_to_pass: Object.keys(outcomes), counts: { ...counts, total: ledger.items.length } }, null, 2)}\n`)
