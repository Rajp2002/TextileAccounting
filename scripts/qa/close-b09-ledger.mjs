#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const matrixPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')
const commonEvidence = [
    'output/qa/blocked-row-campaign/B09-production-resilience.json',
    'output/qa/blocked-row-campaign/B09-production-deploy-proof.json',
]
const outcomes = {
    'PROD-005': 'An authenticated production supervisor RPC rejected positive metres with no order/run; the production-log count stayed unchanged and the visible draft remained available for correction.',
    'PROD-006': 'An authenticated production supervisor RPC rejected positive metres with no worker; the production-log count stayed unchanged.',
    'PROD-007': 'An authenticated production supervisor RPC rejected the zero-rate positive-metre payload; no fallback ₹1.50 rate or production mutation appeared.',
    'PROD-010': 'On the production-backed supervisor form, selecting Other downtime without a note exposed the note field and kept Save disabled.',
    'PROD-011': 'The supervisor form kept Save disabled for -1 m, and the authenticated server RPC independently rejected negative metres without mutation.',
    'PROD-013': 'Entering 10,000 m opened an explicit confirmation naming the loom and exact value before mutation; the safe draft was restored afterward.',
    'PROD-014': 'On production deployment 812512c, Night initially showed 0/20 with Copy previous. The action produced exactly 1/20 with Worker B and one dated target assignment at the source rate, remaining editable before submit.',
    'PROD-022': 'A Day draft remained isolated when switching to Night and returned only under the original date/shift grain; no cross-shift submission occurred.',
    'PROD-023': 'Refreshing restored the exact 12.34 m draft under a visible Restored unsaved draft banner and identified it as not saved.',
    'PROD-024': 'Stopping the same-origin server before submit produced no success claim and no production/stock mutation; reconnect restored all three local draft values.',
    'PROD-025': 'A controlled 17-second post-request delay showed the unknown-outcome warning, reconciled the committed 22.22 m server state, and retained exactly one log and one stock lot after the repeated delayed save.',
    'PROD-026': 'Two independently authenticated production supervisors raced the same shift payload: exactly one succeeded, one received atomic DUPLICATE_LOG_DETECTED, and one 7.77 m log plus one stock lot persisted.',
    'PROD-027': 'Production deployment 812512c rendered the loom sheet with a labelled H2 title. Service status persisted, and Mechanical plus the exact note inserted a tenant-scoped dated breakdown row when none existed.',
    'PROD-030': 'At 390×844, 20 independently labelled metre inputs rendered without horizontal overflow; distinct first/middle/last values stayed in their own rows and the fixed Save control remained reachable.',
    'OFF-003': 'The online Day draft survived a controlled offline interval and reappeared after reconnect with all three exact values under the clearly unsent draft banner.',
    'OFF-004': 'Submitting while the same-origin server was unavailable made no success claim and created no production or stock row; reconnect restored the draft without a duplicate.',
    'UX-001': 'The 390×844 production-backed phone workflow rendered 20 readable, independently named loom rows, preserved distinct row values, had no horizontal overflow, and kept the fixed submit control reachable.',
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
    if (id === 'PROD-026') item.evidence.push('output/qa/blocked-row-campaign/B09-concurrent-supervisors.json')
    if (['PROD-030', 'UX-001'].includes(id)) item.evidence.push('output/qa/blocked-row-campaign/B09-mobile-20-looms.png')
    item.notes = 'B09 direct runtime closeout; disposable production tenant reconciled to zero after exact deployment proof.'
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

const counts = Object.fromEntries(Object.entries(Object.groupBy(ledger.items, (item) => item.status)).map(([status, items]) => [status, items.length]))
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
