#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const matrixPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')
const evidence = [
    'output/qa/blocked-row-campaign/B18-qa-backup-restore.json',
    'output/qa/blocked-row-campaign/B18-recovery-runtime.json',
]

const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'))
const byId = new Map(ledger.items.map((item) => [item.id, item]))
const updatedAt = new Date().toISOString()

const rollback = byId.get('TECH-012')
if (!rollback || rollback.status !== 'blocked') throw new Error(`Expected TECH-012 to be blocked, found ${rollback?.status}`)
rollback.status = 'pass'
rollback.actual = 'A disposable Vercel project deployed an actual B17 production build after 91 files / 650 tests, exposed distinct good/candidate release markers, and natively rolled the alias back to READY deployment dpl_4W61veVnHqTyGDU19qC5dUBm2V14 in two provider-reported seconds; /privacy returned 200 afterward. A rollback-only QA transaction also rehearsed a non-reversible column removal and reviewed forward-fix/backfill, preserved provenance, reconciled one row, and left no persistent probe.'
rollback.evidence = evidence
rollback.notes = 'No production project was changed. The disposable Vercel project and local worktree were removed; the QA forward-fix transaction rolled back cleanly.'
rollback.updatedAt = updatedAt

const restore = byId.get('TECH-011')
if (!restore || restore.status !== 'blocked') throw new Error(`Expected TECH-011 to remain blocked, found ${restore?.status}`)
restore.actual = 'A sanitized isolated-QA logical backup deleted and restored one organization, two users, production, stock, receivable, and payroll in 2478.4 ms with identical SHA-256 summaries, successful restored-owner sign-in, and zero cleanup. Production backup control inspection reports WAL-G enabled, PITR disabled, and zero retained backups; Supabase documents that Free projects must maintain regular off-site CLI dumps. No scheduled off-site production dump is configured, so the schedule half of this row remains unverified.'
restore.evidence = evidence
restore.notes = 'Precise external dependency: upgrade production to Pro for retained daily backups, or approve/provide an off-site destination plus database dump credentials and secret placement for a scheduled logical-backup job. A paid branch was user-approved but Supabase refused it because branches require Pro; a zero-cost project was refused by the two-active-project Free-plan limit. Neither resource was created or charged.'
restore.updatedAt = updatedAt

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
for (const id of ['TECH-011', 'TECH-012']) {
    const rowIndex = matrixLines.findIndex((line) => line.startsWith(`| ${id} |`))
    if (rowIndex < 0) throw new Error(`Matrix row ${id} not found.`)
    matrixLines[rowIndex] = renderRow(byId.get(id))
}
await fs.writeFile(matrixPath, matrixLines.join('\n'))

process.stdout.write(`${JSON.stringify({ updated_to_pass: ['TECH-012'], retained_blocked: ['TECH-011'], counts: { ...counts, total: ledger.items.length } }, null, 2)}\n`)
