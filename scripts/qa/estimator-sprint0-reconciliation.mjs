#!/usr/bin/env node

// Read-only Sprint 0 data-integrity audit.
//
// Required:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   S0_RECONCILIATION_ORG_IDS=org-uuid-a,org-uuid-b
//
// Optional tenant-isolation proof (required unless --skip-tenant-check):
//   S0_OWNER_A_EMAIL, S0_OWNER_A_PASSWORD
//   S0_OWNER_B_EMAIL, S0_OWNER_B_PASSWORD
//
// The script never inserts, updates, deletes, or invokes a mutating RPC.

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
dotenv.config({ path: path.join(root, '.env.production.local'), override: false, quiet: true })

const args = new Set(process.argv.slice(2))
const skipTenantCheck = args.has('--skip-tenant-check')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const orgIds = (process.env.S0_RECONCILIATION_ORG_IDS ?? '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)

const TOLERANCE = 0.01
const SNAPSHOT_KEYS = [
  'calculationVersion', 'roundingPolicy', 'quantityM', 'productionCostPerM',
  'overheadPerM', 'transportPerM', 'commissionPct', 'commissionPerM',
  'landedCostPerM', 'breakEvenPricePerM', 'suggestedSellingPricePerM',
  'targetMarginPct', 'actualMarginPct', 'profitPerM', 'totalOrderValue',
  'totalLandedCost', 'expectedProfitTotal', 'breakdown',
]
const BREAKDOWN_KEYS = [
  'warpCostPerM', 'weftCostPerM', 'weaveCostPerM', 'warpingAndSizingPerM',
  'windingPerM', 'processingPerM', 'finishingPerM', 'directCostPerM',
  'overheadPerM', 'productionCostPerM',
]

function finiteOrNull(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (SNAPSHOT_KEYS.some(key => !(key in value))) return null
  if (!value.breakdown || typeof value.breakdown !== 'object' || Array.isArray(value.breakdown)) return null
  if (BREAKDOWN_KEYS.some(key => finiteOrNull(value.breakdown[key]) == null)) return null
  for (const key of SNAPSHOT_KEYS.filter(key => !['quantityM', 'totalOrderValue', 'totalLandedCost', 'expectedProfitTotal', 'breakdown'].includes(key))) {
    if (typeof value[key] === 'string' && !value[key].trim()) return null
    if (typeof value[key] !== 'string' && finiteOrNull(value[key]) == null) return null
  }
  return value
}

function auditHistoricalCosting(row) {
  const snapshot = parseSnapshot(row.costing_result_snapshot)
  const reasons = []
  const variances = {}
  const compare = (label, stored, expected) => {
    const storedValue = finiteOrNull(stored)
    const expectedValue = finiteOrNull(expected)
    if (storedValue == null || expectedValue == null) return false
    const variance = storedValue - expectedValue
    if (Math.abs(variance) > TOLERANCE) {
      variances[label] = variance
      return true
    }
    return false
  }

  if (snapshot) {
    const storedPairs = [
      ['production_cost_per_meter', row.production_cost_per_meter, snapshot.productionCostPerM],
      ['overhead_per_meter', row.overhead_per_meter, snapshot.overheadPerM],
      ['commission_cost_per_meter', row.commission_cost_per_meter, snapshot.commissionPerM],
      ['break_even_price_per_meter', row.break_even_price_per_meter, snapshot.breakEvenPricePerM],
      ['expected_profit_per_meter', row.expected_profit_per_meter, snapshot.profitPerM],
      ['expected_profit_total', row.expected_profit_total, snapshot.expectedProfitTotal],
      ['actual_margin_percent', row.actual_margin_percent, snapshot.actualMarginPct],
      ['landed_cost_per_meter', row.landed_cost_per_meter, snapshot.landedCostPerM],
      ['quote_price_per_meter', row.quote_price_per_meter, snapshot.suggestedSellingPricePerM],
      ['intended_margin_percent', row.intended_margin_percent, snapshot.targetMarginPct],
    ]
    const missingStoredFields = storedPairs
      .filter(([, stored, expected]) => expected != null && finiteOrNull(stored) == null)
      .map(([label]) => label)
    if (missingStoredFields.length > 0) {
      reasons.push(`Canonical snapshot exists but stored scalar fields are missing: ${missingStoredFields.join(', ')}.`)
      return { status: 'needs_review', reasons, variances }
    }

    const mismatched = [
      compare('production_cost_per_meter', row.production_cost_per_meter, snapshot.productionCostPerM),
      compare('overhead_per_meter', row.overhead_per_meter, snapshot.overheadPerM),
      compare('commission_cost_per_meter', row.commission_cost_per_meter, snapshot.commissionPerM),
      compare('break_even_price_per_meter', row.break_even_price_per_meter, snapshot.breakEvenPricePerM),
      compare('expected_profit_per_meter', row.expected_profit_per_meter, snapshot.profitPerM),
      compare('expected_profit_total', row.expected_profit_total, snapshot.expectedProfitTotal),
      compare('actual_margin_percent', row.actual_margin_percent, snapshot.actualMarginPct),
      compare('landed_cost_per_meter', row.landed_cost_per_meter, snapshot.landedCostPerM),
      compare('quote_price_per_meter', row.quote_price_per_meter, snapshot.suggestedSellingPricePerM),
      compare('intended_margin_percent', row.intended_margin_percent, snapshot.targetMarginPct),
    ].some(Boolean)
    if (mismatched) {
      reasons.push('Stored scalar fields disagree with the canonical result snapshot by more than ₹0.01.')
      return { status: 'needs_review', reasons, variances }
    }
    if (!row.calculation_version || !row.rounding_policy) {
      reasons.push('The result is complete but its formula or rounding identifiers are missing.')
      return { status: 'legacy', reasons, variances }
    }
    return { status: 'verified', reasons, variances }
  }

  if (!Array.isArray(row.warp_rows) || row.warp_rows.length === 0 || !Array.isArray(row.weft_rows) || row.weft_rows.length === 0) {
    reasons.push('Warp or weft recipe rows are missing, so the historical production cost cannot be reconstructed safely.')
    return { status: 'unreconstructable', reasons, variances }
  }
  if (finiteOrNull(row.landed_cost_per_meter) == null || finiteOrNull(row.quote_price_per_meter) == null) {
    reasons.push('Saved landed cost or quoted price is missing.')
    return { status: 'unreconstructable', reasons, variances }
  }
  if (row.overhead_items == null || row.commission_pct == null || row.transport_per_m == null) {
    reasons.push('Historical overhead, commission, or transport assumptions are incomplete.')
    return { status: 'unreconstructable', reasons, variances }
  }
  reasons.push('Saved economics predate the canonical result snapshot and require legacy review before customer export.')
  return { status: 'legacy', reasons, variances }
}

if (!url || !serviceRoleKey || orgIds.length === 0) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and S0_RECONCILIATION_ORG_IDS before running the Sprint 0 audit.')
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function fail(message, details = {}) {
  const error = new Error(message)
  error.details = details
  throw error
}

async function readAll(table, columns = '*') {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .in('org_id', orgIds)
      .range(from, from + pageSize - 1)
    if (error) fail(`Unable to read ${table}.`, { code: error.code, message: error.message })
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

async function readOrganizations() {
  const { data, error } = await admin
    .from('organizations')
    .select('id')
    .in('id', orgIds)
  if (error) fail('Unable to read organizations.', { code: error.code, message: error.message })
  return data ?? []
}

function normalizedName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN')
}

function orgIdSet(rows) {
  return new Set(rows.map(row => `${row.org_id}:${row.id}`))
}

function recordCheck(checks, id, pass, details) {
  checks.push({ id, status: pass ? 'Pass' : 'Fail', details })
}

async function runTenantIsolationCheck(checks, quoteRows) {
  if (skipTenantCheck) {
    recordCheck(checks, 'S0-TENANT-ISOLATION', true, { skipped: true, reason: '--skip-tenant-check' })
    return
  }

  const [orgA, orgB] = orgIds
  const required = [
    process.env.S0_OWNER_A_EMAIL,
    process.env.S0_OWNER_A_PASSWORD,
    process.env.S0_OWNER_B_EMAIL,
    process.env.S0_OWNER_B_PASSWORD,
  ]
  if (orgIds.length < 2 || required.some(value => !value)) {
    fail('Tenant isolation proof needs two org IDs and S0_OWNER_A/B_EMAIL/PASSWORD. Use --skip-tenant-check only for a scoped data audit.')
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) fail('NEXT_PUBLIC_SUPABASE_ANON_KEY is required for tenant-isolation proof.')

  const ownerA = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const ownerB = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const signedA = await ownerA.auth.signInWithPassword({ email: process.env.S0_OWNER_A_EMAIL, password: process.env.S0_OWNER_A_PASSWORD })
  const signedB = await ownerB.auth.signInWithPassword({ email: process.env.S0_OWNER_B_EMAIL, password: process.env.S0_OWNER_B_PASSWORD })
  if (signedA.error || signedB.error) {
    fail('Tenant-isolation owner sign-in failed.', { ownerA: signedA.error?.code, ownerB: signedB.error?.code })
  }

  const sampleA = quoteRows.find(row => row.org_id === orgA)
  const sampleB = quoteRows.find(row => row.org_id === orgB)
  if (!sampleA || !sampleB) fail('Tenant-isolation proof needs at least one estimator quote in each of the first two orgs.')

  const [ownA, crossA, ownB, crossB] = await Promise.all([
    ownerA.from('estimator_quotes').select('id, org_id').eq('id', sampleA.id).maybeSingle(),
    ownerA.from('estimator_quotes').select('id, org_id').eq('id', sampleB.id).maybeSingle(),
    ownerB.from('estimator_quotes').select('id, org_id').eq('id', sampleB.id).maybeSingle(),
    ownerB.from('estimator_quotes').select('id, org_id').eq('id', sampleA.id).maybeSingle(),
  ])

  recordCheck(checks, 'S0-TENANT-A-OWN-QUOTE', !ownA.error && ownA.data?.org_id === orgA, { rows: ownA.data ? 1 : 0, code: ownA.error?.code ?? null })
  recordCheck(checks, 'S0-TENANT-A-CANNOT-READ-B-QUOTE', !crossA.error && crossA.data === null, { rows: crossA.data ? 1 : 0, code: crossA.error?.code ?? null })
  recordCheck(checks, 'S0-TENANT-B-OWN-QUOTE', !ownB.error && ownB.data?.org_id === orgB, { rows: ownB.data ? 1 : 0, code: ownB.error?.code ?? null })
  recordCheck(checks, 'S0-TENANT-B-CANNOT-READ-A-QUOTE', !crossB.error && crossB.data === null, { rows: crossB.data ? 1 : 0, code: crossB.error?.code ?? null })
}

async function main() {
  const [organizations, templates, quotes, rateBook, rateHistory, orders, subscriptions, payments] = await Promise.all([
    readOrganizations(),
    readAll('estimator_templates'),
    readAll('estimator_quotes'),
    readAll('cost_rate_book'),
    readAll('cost_rate_history'),
    readAll('orders', 'id, org_id'),
    readAll('org_subscriptions'),
    readAll('subscription_payments'),
  ])

  const checks = []
  const orgSet = new Set(orgIds)
  const templateKeys = orgIdSet(templates)
  const quoteKeys = orgIdSet(quotes)
  const orderKeys = orgIdSet(orders)
  const rateKeys = orgIdSet(rateBook)
  const subscriptionKeys = orgIdSet(subscriptions)

  recordCheck(checks, 'S0-ORGANIZATIONS-TARGETS-FOUND', organizations.length === orgIds.length, {
    expected: orgIds.length,
    found: organizations.map(row => row.id),
  })

  for (const [table, rows] of [
    ['estimator_templates', templates],
    ['estimator_quotes', quotes],
    ['cost_rate_book', rateBook],
    ['cost_rate_history', rateHistory],
    ['orders', orders],
    ['org_subscriptions', subscriptions],
    ['subscription_payments', payments],
  ]) {
    const foreignRows = rows.filter(row => !orgSet.has(row.org_id))
    recordCheck(checks, `S0-${table.toUpperCase()}-ORG-SCOPE`, foreignRows.length === 0, { rows: rows.length, foreignRows: foreignRows.length })
  }

  const duplicateQualityNames = []
  const qualityNames = new Map()
  for (const template of templates) {
    const key = `${template.org_id}:${normalizedName(template.name)}`
    if (qualityNames.has(key) && template.is_active !== false && qualityNames.get(key).is_active !== false) {
      duplicateQualityNames.push({ first: qualityNames.get(key).id, duplicate: template.id, name: template.name })
    }
    qualityNames.set(key, template)
  }
  recordCheck(checks, 'S0-SAVED-QUALITY-NAMES-UNIQUE', duplicateQualityNames.length === 0, { duplicates: duplicateQualityNames })

  const brokenQuoteLinks = quotes.filter(quote => (
    (quote.template_id && !templateKeys.has(`${quote.org_id}:${quote.template_id}`))
    || (quote.order_id && !orderKeys.has(`${quote.org_id}:${quote.order_id}`))
    || (quote.source_quote_id && !quoteKeys.has(`${quote.org_id}:${quote.source_quote_id}`))
  ))
  recordCheck(checks, 'S0-QUOTE-LINKS-TENANT-SAFE', brokenQuoteLinks.length === 0, { brokenRows: brokenQuoteLinks.map(row => row.id) })

  const brokenRateLinks = rateHistory.filter(row => !rateKeys.has(`${row.org_id}:${row.rate_id}`))
  recordCheck(checks, 'S0-RATE-HISTORY-LINKS-TENANT-SAFE', brokenRateLinks.length === 0, { brokenRows: brokenRateLinks.map(row => row.id) })

  const brokenBillingLinks = payments.filter(row => row.subscription_id && !subscriptionKeys.has(`${row.org_id}:${row.subscription_id}`))
  recordCheck(checks, 'S0-BILLING-LINKS-TENANT-SAFE', brokenBillingLinks.length === 0, { brokenRows: brokenBillingLinks.map(row => row.id) })

  const costingAudit = quotes.map(row => ({
    id: row.id,
    orgId: row.org_id,
    databaseStatus: row.reconciliation_status ?? null,
    audit: auditHistoricalCosting(row),
  }))
  const auditCounts = costingAudit.reduce((counts, row) => {
    counts[row.audit.status] = (counts[row.audit.status] ?? 0) + 1
    return counts
  }, {})
  const verifiedRowsWithWrongStatus = costingAudit.filter(row => row.audit.status === 'verified' && row.databaseStatus !== 'verified')
  recordCheck(checks, 'S0-CANONICAL-SNAPSHOT-STATUS', verifiedRowsWithWrongStatus.length === 0, {
    auditCounts,
    wrongStatusRows: verifiedRowsWithWrongStatus.map(row => ({ id: row.id, databaseStatus: row.databaseStatus })),
  })

  const quotationProblems = quotes.filter(quote => quote.record_kind === 'quotation' && (
    !String(quote.party_name ?? '').trim()
    || !String(quote.quotation_reference ?? '').trim()
  ))
  recordCheck(checks, 'S0-CUSTOMER-QUOTATIONS-HAVE-IDENTITY', quotationProblems.length === 0, { rows: quotationProblems.map(row => row.id) })

  await runTenantIsolationCheck(checks, quotes)

  const report = {
    sprint: 'Sprint 0 — costing truth',
    readOnly: true,
    organizationIds: orgIds,
    counts: {
      organizations: organizations.length,
      savedQualities: templates.length,
      snapshotsAndQuotes: quotes.length,
      rates: rateBook.length,
      rateHistory: rateHistory.length,
      orders: orders.length,
      subscriptions: subscriptions.length,
      billingPayments: payments.length,
    },
    historicalCostingAudit: costingAudit,
    checks,
    passed: checks.every(check => check.status === 'Pass'),
  }
  console.log(JSON.stringify(report, null, 2))
  if (!report.passed) process.exitCode = 1
}

main().catch(error => {
  console.error(JSON.stringify({ passed: false, error: error.message, details: error.details ?? null }, null, 2))
  process.exitCode = 1
})
