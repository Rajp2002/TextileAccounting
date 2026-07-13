#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const matrixPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')
const commonEvidence = [
    'output/qa/blocked-row-campaign/B12-qa-market-stock.json',
    'output/qa/blocked-row-campaign/B12-production-market-stock.json',
]
const outcomes = {
    'MARKET-009': 'A 100 m market run produced and sold out completely while the sale retained 100 m pending dispatch; the run summary showed 100 m produced, 100 m sold, and 0 m in godown without hiding dispatch work.',
    'MARKET-010': 'Two exact dispatch batches of 60 m and 40 m were received and matched, the sale reached zero pending dispatch, and the closed run archive retained 100 m produced, 100 m sold, 0 m in godown, and one sale.',
    'MARKET-013': 'The current summary returned 26 market runs with stock-sale totals in 25.3 ms in the final production proof, then a second authenticated session immediately observed a 1 m sale mutation and the updated sales count.',
    'STOCK-005': 'Database-boundary probes rejected both another tenant’s market-run source and a quote/order mismatch, and a follow-up count proved that neither rejected stock lot persisted.',
    'STOCK-009': 'A real concurrent 80 m sale and 100 m subtraction against one 100 m lot serialized to exactly one successful mutation; the lot remained non-negative with exactly one movement and no double use.',
    'DISP-017': 'The 60 m above-threshold batch persisted e-way-required=true while honestly leaving missing compliance fields empty; the 40 m below-threshold batch persisted e-way-required=false as an advisory reminder state.',
    'DISP-018': 'An e-way-required dispatch with missing e-way bill, challan, and transporter data remained explicitly incomplete and never claimed compliance completion; both batches still retained their exact physical dispatch and receipt truth.',
    'COMM-015': 'Two buyers with the same normalized name but different phone numbers were created as distinct party IDs, and their stock-sale receivables retained two explicit, separate party identities.',
    'GOLDEN-B-12': 'The second 40 m market dispatch recorded an exact 40 m receipt with zero shortage, after the first exact 60 m receipt, and both dispatches reached delivered/matched state.',
    'GOLDEN-B-17': 'The remaining stock sold out, dispatched in two batches, received exactly, and the run closed with complete stock and archive history: 100 m produced, 100 m sold, 0 m in godown, and one retained sale.',
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
    item.notes = 'B12 direct QA and exact-deployment production runtime proof; all disposable tenants, profiles, stock lots, auth users, and dependent rows were cleaned and reconciled.'
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
