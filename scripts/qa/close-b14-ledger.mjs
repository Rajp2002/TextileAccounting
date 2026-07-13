#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const matrixPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')
const commonEvidence = [
    'output/qa/blocked-row-campaign/B14-qa-dashboard.json',
    'output/qa/blocked-row-campaign/B14-qa-browser.json',
    'output/qa/blocked-row-campaign/B14-production-dashboard.json',
]
const outcomes = {
    'DASH-005': 'An authenticated second-session insert changed the live dashboard from 20 m / ₹80 to 45 m / ₹180 without reload; authoritative slice replacement prevented the event from being counted twice.',
    'DASH-006': 'After a controlled subscription teardown, a 15 m mutation made while disconnected was recovered on return as the authoritative 60 m / ₹240 total; the reconnected channel was unique and warning/error logs stayed empty.',
    'DASH-008': 'The 1,800 m order showed 3,200 m remaining, five days remaining, a trailing average of 20 m/day, required pace of 640 m/day, and pace index 0.03; the zero-production order remained an explicit waiting/at-risk state.',
    'DASH-010': 'A 90-day, 1,800-log dashboard fixture returned the complete range and two active orders in 822.3 ms in QA and 585 ms in production, below the two-second acceptance threshold without truncation or UI freeze.',
    'UX-010': 'The dashboard exposed distinct actionable loading/reconnecting, error with retry, offline with retry, historical empty, and live connected states; injected RPC failure reached the error boundary and recovered after repair.',
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
    item.notes = 'B14 direct QA runtime/browser proof and exact-deployment production proof; worker-breakdown RPC migration deployed in both environments; all disposable tenants, profiles, production logs, and auth users reconciled to zero.'
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

process.stdout.write(`${JSON.stringify({ updated: Object.keys(outcomes), counts: { ...counts, total: ledger.items.length } }, null, 2)}\n`)
