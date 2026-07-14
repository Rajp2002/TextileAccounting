#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const matrixPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')
const commonEvidence = [
    'output/qa/blocked-row-campaign/B13-boundary-probe.json',
    'output/qa/blocked-row-campaign/B13-qa-browser.json',
    'output/qa/blocked-row-campaign/B13-production-payroll.json',
]
const outcomes = {
    'MASTER-006': 'Decimal operator rate 3.125 persisted at the assignment boundary, appeared in the payroll UI, and produced an exact historical 80 m × 3.125 = 250 snapshot while adjacent 2.75 and 3.00 snapshots remained distinct.',
    'PAY-002': 'After rate changes, historical production retained immutable 2.75, 3.125, and 3.00 snapshots; the refreshed payroll showed exact earnings of 275, 250, and 150.',
    'PAY-010': 'An authenticated owner direct-delete attempt against a deducted advance was rejected by the database trigger and deleted zero rows in QA and production.',
    'PAY-011': 'A gross 1000 settlement recovered exactly the 50% cap of 500, paid 500 net, and carried the remaining 300 debt explicitly with one pending split advance.',
    'PAY-012': 'Final-exit settlement recovered 400 from gross 400, paid zero without going negative, retained explicit remaining debt 200, and deactivated the worker atomically.',
    'PAY-014': 'Inam 100 and kapaat 25 were stored with itemized reasons/notes; the persisted result was gross 675, advance recovery 375, net 375, and carry-forward debt 125 without a negative payout.',
    'PAY-017': 'The June payroll UI rendered the full 1 Jun–30 Jun cycle and correctly showed the live state as overdue since 10 Jul while still allowing the valid settlement/history views; focused calendar tests cover scheduled, reminder, due, and overdue states.',
    'PAY-019': 'Two simultaneous authenticated settlement calls serialized to one success and one explicit already-settled rejection; one settlement recovered the advance exactly once in QA and production.',
    'PAY-021': 'Authorized reversal restored the exact prior 800 pending advance debt, removed the settlement effect, and consumed the one-time reversal access code.',
    'PAY-025': 'The June cycle rendered as 1 Jun–30 Jun with pay date 10 Jul; the payroll-cycle and India-calendar regression suites passed month-end, February, and leap-year boundary cases.',
    'PAY-026': 'The hardened final-exit RPC persisted final payroll, explicit remaining debt, immutable history, and worker deactivation in one transaction; the QA UI displayed the Final badge and Cash settlement.',
    'PAY-027': 'Supervisor Kharchi atomically changed float from 500 to 380 and created exactly one 120 worker advance in both QA and production runtime proof.',
    'DASH-003': 'Factory Today loaded successfully after shift with 50 m, 4/4 active looms, day logged/night pending, two work-at-risk items, ₹1.2k pending advances, and overdue payroll; browser warning/error logs were empty.',
    'GOLDEN-A-21': 'The shared production-backed fixture added an 800 advance plus itemized inam 100 and kapaat 25 adjustments, then preserved exact recovery, debt, and historical production invariants.',
    'GOLDEN-A-22': 'Payroll preview/settlement used immutable production snapshots for gross 675, recovered 375, paid 375, carried 125, and exposed the PDF Slip action in refreshed QA UI; the same settlement equations passed production.',
    'GOLDEN-B-18': 'Golden B settled from the same immutable order and market production snapshots, with the server ignoring client-supplied gross and deriving the exact 675 total from persisted logs.',
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
    item.notes = 'B13 direct QA runtime/browser and exact-deployment production proof; payroll lifecycle migration deployed in both environments; all disposable tenants, profiles, settlements, advances, and auth users reconciled to zero.'
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
