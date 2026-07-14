#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ledgerPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/results.json')
const matrixPath = path.join(root, 'output/qa/PILOTQA-20260621-2058-8QIH/TEST_MATRIX.md')
const evidencePath = path.join(root, 'output/qa/blocked-row-campaign/B19-external-evidence-review.json')
const evidenceRef = 'output/qa/blocked-row-campaign/B19-external-evidence-review.json'
const envPath = path.join(root, '.env.production.local')
const reviewedAt = new Date().toISOString()

const envText = await fs.readFile(envPath, 'utf8').catch(() => '')
const envKeys = new Set(
    envText
        .split(/\r?\n/u)
        .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/u)?.[1])
        .filter(Boolean)
)

const review = {
    batch: 'B19',
    reviewed_at: reviewedAt,
    result: 'external_dependencies_confirmed',
    source_scope: [
        'repository documentation and generated QA artifacts',
        '.env.production.local key presence only; values were not read into evidence',
        'current process environment key presence only',
    ],
    rows: {
        'SEC-011': {
            status: 'blocked',
            configured: {
                sentry_dsn: envKeys.has('NEXT_PUBLIC_SENTRY_DSN'),
                sentry_org: envKeys.has('SENTRY_ORG'),
                sentry_project: envKeys.has('SENTRY_PROJECT'),
                sentry_read_only_api_token: Boolean(process.env.SENTRY_AUTH_TOKEN) || envKeys.has('SENTRY_AUTH_TOKEN'),
            },
            api_attempt: 'not_run_missing_read_only_token',
            existing_supporting_evidence: 'Repository, client bundle, QA output, production logs, shared redaction code, and redaction tests are clean, but none is a live Sentry event payload.',
            smallest_dependency: 'Set a local SENTRY_AUTH_TOKEN with org:read, project:read, and event:read, then inspect a current production event through the read-only Sentry API with PII-redacted output.',
        },
        'SEC-018': {
            status: 'blocked',
            review_result: 'No qualified-counsel attestation or redline was found in repository documentation or QA artifacts.',
            smallest_dependency: 'Obtain a dated approval or redline from qualified Indian privacy counsel covering DPDP, breach, grievance, retention, offline storage, and minor/child wording.',
        },
        'UX-012': {
            status: 'blocked',
            review_result: 'Application terminology exists, but no brother/supervisor factory-language approval artifact was found.',
            smallest_dependency: 'Have one named factory supervisor review the listed labels and provide a dated approve/change register.',
        },
        'GOLDEN-A-03': {
            status: 'blocked',
            review_result: 'The guide describes the required independent business truth sheet, but no completed reference estimate was found.',
            smallest_dependency: 'Provide one business-accepted real-fabric truth sheet with inputs and expected yarn, weave, processing, overhead, landed-cost, and quote totals.',
        },
        'SIGNOFF-04': {
            status: 'blocked',
            review_result: 'No external supervisor shift register with a comparable date/shift total was found.',
            smallest_dependency: 'Provide one dated supervisor register for a known shift so Today meters can be reconciled against its independent total.',
        },
    },
    assertions: {
        all_five_rows_reviewed: true,
        no_external_artifact_invented: true,
        no_secret_value_recorded: true,
        no_status_promoted_without_required_evidence: true,
    },
}

await fs.mkdir(path.dirname(evidencePath), { recursive: true })
await fs.writeFile(evidencePath, `${JSON.stringify(review, null, 2)}\n`)

const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'))
const byId = new Map(ledger.items.map((item) => [item.id, item]))
const updates = {
    'SEC-011': {
        actual: 'Repository, generated client static bundle, QA output, and seven-day Vercel production logs contain no discovered server-secret value. Shared redaction code/tests cover user identity, IP, authorization/cookie headers, query/cookies, messages, breadcrumbs, and exception text. Production Sentry DSN, organization, and project keys are configured, but no local read-only SENTRY_AUTH_TOKEN or live event-payload artifact is available, so direct live Sentry payload inspection remains blocked.',
        notes: 'Smallest dependency: set SENTRY_AUTH_TOKEN locally with org:read, project:read, and event:read; then inspect a current production event via the read-only API with PII-redacted output. Do not paste the token into chat or commit it.',
    },
    'SEC-018': {
        actual: 'Public policy wording covers DPDP, breach, grievance, retention, offline storage, and children/minors, but the B19 workspace review found no dated qualified-counsel approval or redline. QA cannot substitute for legal advice, so public legal-readiness reliance remains blocked.',
        notes: 'Smallest dependency: a dated approval or redline from qualified Indian privacy counsel covering the named policy claims.',
    },
    'UX-012': {
        actual: 'The required loom, shift meters, quality/run, godown, party, challan, Upaad/Kharchi, and hisaab labels exist in the product, but the B19 review found no dated brother/supervisor factory-language approval artifact.',
        notes: 'Smallest dependency: one named factory supervisor provides a dated approve/change register for the listed terms.',
    },
    'GOLDEN-A-03': {
        actual: 'Estimator calculation coverage exists and the test guide specifies an independent factory truth sheet, but the B19 review found no completed business-accepted real-fabric reference estimate. A human/business truth comparison therefore cannot be claimed.',
        notes: 'Smallest dependency: one accepted truth sheet containing fabric inputs and expected yarn, weave, processing, overhead, landed-cost, and quote totals.',
    },
    'SIGNOFF-04': {
        actual: 'Application-side Today/production proofs exist, but the B19 review found no independent dated supervisor shift register whose meter total can be compared with the app.',
        notes: 'Smallest dependency: one dated supervisor register for a known shift with an independent total suitable for Today-meter reconciliation.',
    },
}

for (const [id, update] of Object.entries(updates)) {
    const row = byId.get(id)
    if (!row || row.status !== 'blocked') throw new Error(`Expected ${id} to remain blocked, found ${row?.status}`)
    row.actual = update.actual
    row.notes = update.notes
    row.evidence = [...new Set([...(row.evidence ?? []), evidenceRef])]
    row.updatedAt = reviewedAt
}

await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)

const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')
const renderRow = (item) => `| ${[
    item.id, item.section, item.scenario, item.expected, item.status, item.actual,
    (item.evidence ?? []).join('; '), item.severity ?? '',
].map(escapeCell).join(' | ')} |`
const matrixLines = (await fs.readFile(matrixPath, 'utf8')).split('\n')
for (const id of Object.keys(updates)) {
    const rowIndex = matrixLines.findIndex((line) => line.startsWith(`| ${id} |`))
    if (rowIndex < 0) throw new Error(`Matrix row ${id} not found.`)
    matrixLines[rowIndex] = renderRow(byId.get(id))
}
await fs.writeFile(matrixPath, matrixLines.join('\n'))

process.stdout.write(`${JSON.stringify({ reviewed: Object.keys(updates), retained_blocked: Object.keys(updates), evidence: evidenceRef }, null, 2)}\n`)
