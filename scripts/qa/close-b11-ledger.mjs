#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const matrixPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')
const commonEvidence = [
    'output/qa/blocked-row-campaign/B11-qa-order-lifecycle.json',
    'output/qa/blocked-row-campaign/B11-production-runtime.json',
]
const outcomes = {
    'QUOTE-007': 'Production Start Party Order created one accepted quote, one active 100 m order, and one yarn requirement atomically; quote and order were backlinked in both directions and the UI routed to the created order.',
    'ORDER-005': 'QA rejected an over-target production write explicitly and preserved the existing 230.75 m production and stock totals without downstream mutation.',
    'ORDER-007': 'Corrected production reached the 235.75 m target, completed the order, unlinked both looms, retained the order-linked stock lot, and kept payroll/source history intact.',
    'ORDER-009': 'Cancelling after 40 m retained the production log and order-reserved stock, unlinked only the affected loom, and rejected every later production attempt.',
    'ORDER-010': 'The protected cancelled order rejected physical deletion and remained archived with its production log and source-linked stock; no orphaned record was created.',
    'ORDER-011': 'Production-generated lots remained classified as order_reserved and source-linked to their orders across active, completed, and cancelled states.',
    'ORDER-012': 'The completed-order stock sale retained the order link through the sale, two dispatches, receivable, receipts, discrepancy, and claim.',
    'ORDER-013': 'A 120 m order-linked sale dispatched 70 m first with 50 m still actionable, then dispatched the remaining 50 m and reached zero pending meters.',
    'ORDER-014': 'A matched 70 m receipt created no discrepancy; a 45 m receipt against 50 m sent recorded the exact 5 m shortage, one discrepancy, and one claim without changing the 235.75 m production lot.',
    'ORDER-015': 'Commercial collection progressed from unpaid to partial to paid at exactly ₹7,200 while production-backed payroll independently settled the authoritative ₹589.375 gross.',
    'STOCK-011': 'Order-reserved stock stayed source-linked and mathematically consistent while active, after completion and partial sale, and after cancellation with retained production history.',
    'GOLDEN-A-23': 'After the production-backed payroll was paid and the order completed, correction was rejected and production, stock, settlement, dispatch, receipt, and commercial history remained unchanged.',
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
    if (id === 'GOLDEN-A-23') item.evidence.push('output/qa/blocked-row-campaign/B10-production-runtime.json')
    item.notes = 'B11 direct QA lifecycle and production Start Party Order proof; disposable QA and production tenants and credentials were cleaned and reconciled.'
    item.updatedAt = updatedAt
}

await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)

const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')
const renderRow = (item) => `| ${[
    item.id,
    item.section,
    item.scenario,
    item.expected,
    item.status,
    item.actual,
    (item.evidence ?? []).join('; '),
    item.severity ?? '',
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
