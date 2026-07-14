#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const matrixPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')
const commonEvidence = [
    'output/qa/blocked-row-campaign/B10-qa-boundaries.json',
    'output/qa/blocked-row-campaign/B10-production-boundaries.json',
    'output/qa/blocked-row-campaign/B10-production-runtime.json',
]
const outcomes = {
    'PROD-017': 'Production showed the expired correction window, blocked overwrite without a code, then accepted a fresh owner code and persisted the correction from 10 m to 12 m.',
    'PROD-018': 'Production rejected invalid, expired, and consumed owner codes without mutation; one fresh valid code succeeded once, and its reuse was rejected.',
    'PROD-019': 'A paid-cycle production correction was rejected with the settled-payroll message; the settled log remained 10 m.',
    'PAY-006': 'Production bounded attendance at today, required an owner code for a supervisor past-date save, persisted absent on 2026-07-12, and showed the same saved record locked after reload. Direct future writes were rejected.',
    'PAY-022': 'A fresh valid owner code reached the payroll boundary in production, which rejected modification for the paid worker/cycle and preserved the original production row.',
    'COMM-013': 'Production Commercials rendered Collected This Month as ₹333 from an exact persisted ₹333.33 total; 2026-07-01 and 2026-07-14 were included while 2026-06-30 and 2026-08-01 were excluded.',
    'TIME-003': 'India month-to-date and payroll-cycle fixtures classified year-end/year-start dates correctly, including a cycle crossing December to January.',
    'TIME-004': 'The 2024-02-29 payment round-tripped in QA and production, and deterministic payroll-cycle proof covered leap-day behavior.',
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
    item.notes = 'B10 direct QA and production runtime closeout; disposable tenants, profiles, auth users, and scoped business rows reconciled to zero.'
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
