import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const PROJECT_REF = 'vzhwahudircrpgtitwzd'
const ORG_A = '0e35016b-b0ba-4a35-a6bf-661ba75f4170'
const USER_A = '7c5202fa-fc0c-4add-9f93-77b82054d633'
const SUBSCRIPTION_A = '530e44e4-3e8c-490b-97ec-ffcf2b37a620'
const TEMPLATE_A = 'c53102d1-c762-4064-a878-c0b416a60ca7'
const QUOTE_A = 'e9388c7b-f609-4994-b6dc-f438a8c1379f'
const FACTORY_PROFILE_A = '5ec60abf-e78d-4bb4-936c-841d53bdaf05'
const MACHINE_A = 'a1010000-0000-4000-8000-000000000001'

const ORG_B = 'a25813fd-2d5c-41fd-98bd-81889c35a11d'
const USER_B = '004428dd-0e59-4f13-a2bb-011e1e1bfc14'
const SUBSCRIPTION_B = 'ca008974-e000-43c5-8385-f46c8cbbff53'
const TEMPLATE_B = 'fa31354a-2d03-4fa1-9851-38773eafe28f'
const QUOTE_B = '928f3138-caec-4604-93c4-361808ce9c63'
const MACHINE_B = 'b1010000-0000-4000-8000-000000000001'
const FORBIDDEN_MACHINE = 'a1010000-0000-4000-8000-000000000099'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
dotenv.config({ path: path.join(root, '.env.production.local'), override: false, quiet: true })
dotenv.config({
  path: '/Users/rajpatel/.codex/secrets/estimator-audit-20260710-of1p.env',
  override: false,
  quiet: true,
})

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  throw new Error('Production Supabase URL, anon key, and service role key are required.')
}
if (new URL(url).hostname.split('.')[0] !== PROJECT_REF) {
  throw new Error(`Refusing to run against a project other than ${PROJECT_REF}.`)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function appClient() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function fail(message, details = {}) {
  const error = new Error(message)
  error.details = details
  throw error
}

async function requireAuditIdentity(client, email, password, expectedUser, expectedOrg) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || data.user?.id !== expectedUser) {
    fail('Audit identity sign-in did not resolve to the expected user.', { code: error?.code })
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, org_id, role')
    .eq('id', expectedUser)
    .single()
  if (profileError || profile.org_id !== expectedOrg || profile.role !== 'owner') {
    fail('Audit identity profile does not match the expected owner membership.', {
      code: profileError?.code,
      userId: expectedUser,
    })
  }
}

async function setup() {
  const { data: orgs, error: orgError } = await admin
    .from('organizations')
    .select('id, name')
    .in('id', [ORG_A, ORG_B])
  if (orgError || orgs?.length !== 2 || orgs.some(org => !org.name?.includes('ESTIMATOR_AUDIT'))) {
    fail('Expected audit organizations were not found or were not clearly audit-labelled.', {
      code: orgError?.code,
    })
  }

  const { data: baseSubscription, error: baseSubscriptionError } = await admin
    .from('org_subscriptions')
    .select('id, org_id, plan_tier')
    .eq('id', SUBSCRIPTION_A)
    .eq('org_id', ORG_A)
    .single()
  if (baseSubscriptionError || baseSubscription.plan_tier !== 'base') {
    fail('Audit organization A is not the expected Base control tenant.', {
      code: baseSubscriptionError?.code,
    })
  }

  const { data: upgraded, error: upgradeError } = await admin
    .from('org_subscriptions')
    .update({ plan_tier: 'premium' })
    .eq('id', SUBSCRIPTION_B)
    .eq('org_id', ORG_B)
    .select('id, org_id, plan_tier')
    .single()
  if (upgradeError || upgraded.plan_tier !== 'premium') {
    fail('Could not make audit organization B the Premium control tenant.', {
      code: upgradeError?.code,
    })
  }

  const fixtures = [
    {
      id: MACHINE_A,
      org_id: ORG_A,
      name: '[AUDIT] Base boundary fixture',
      status: 'inactive',
      machine_status: 'idle',
      loom_type: 'water_jet',
    },
    {
      id: MACHINE_B,
      org_id: ORG_B,
      name: '[AUDIT] Premium boundary fixture',
      status: 'inactive',
      machine_status: 'idle',
      loom_type: 'water_jet',
    },
  ]
  const { data: machines, error: machineError } = await admin
    .from('machines')
    .upsert(fixtures, { onConflict: 'id' })
    .select('id, org_id, name')
  if (machineError || machines?.length !== 2) {
    fail('Could not create the exact entitlement fixtures.', { code: machineError?.code })
  }

  return {
    mode: 'setup',
    projectRef: PROJECT_REF,
    premiumControlSubscription: SUBSCRIPTION_B,
    createdMachineIds: [MACHINE_A, MACHINE_B],
  }
}

async function verify() {
  const clientA = appClient()
  const clientB = appClient()
  await requireAuditIdentity(
    clientA,
    process.env.ESTIMATOR_AUDIT_A_EMAIL,
    process.env.ESTIMATOR_AUDIT_A_PASSWORD,
    USER_A,
    ORG_A
  )
  await requireAuditIdentity(
    clientB,
    process.env.ESTIMATOR_AUDIT_B_EMAIL,
    process.env.ESTIMATOR_AUDIT_B_PASSWORD,
    USER_B,
    ORG_B
  )

  const checks = []
  const record = (id, pass, actual) => {
    checks.push({ id, status: pass ? 'Pass' : 'Fail', actual })
    if (!pass) fail(`Boundary check ${id} failed.`, { actual })
  }

  const ownTemplate = await clientA.from('estimator_templates').select('id').eq('id', TEMPLATE_A)
  record('BOUNDARY-BASE-ESTIMATOR-TEMPLATE', !ownTemplate.error && ownTemplate.data?.length === 1, {
    rows: ownTemplate.data?.length ?? 0,
    code: ownTemplate.error?.code ?? null,
  })

  const ownQuote = await clientA.from('estimator_quotes').select('id').eq('id', QUOTE_A)
  record('BOUNDARY-BASE-ESTIMATOR-QUOTE', !ownQuote.error && ownQuote.data?.length === 1, {
    rows: ownQuote.data?.length ?? 0,
    code: ownQuote.error?.code ?? null,
  })

  const ownProfile = await clientA.from('factory_cost_profile').select('id').eq('id', FACTORY_PROFILE_A)
  record('BOUNDARY-BASE-FACTORY-PROFILE', !ownProfile.error && ownProfile.data?.length === 1, {
    rows: ownProfile.data?.length ?? 0,
    code: ownProfile.error?.code ?? null,
  })

  const basePremiumRead = await clientA.from('machines').select('id').eq('id', MACHINE_A)
  record('BOUNDARY-BASE-PREMIUM-READ-DENIED', !basePremiumRead.error && basePremiumRead.data?.length === 0, {
    rows: basePremiumRead.data?.length ?? 0,
    code: basePremiumRead.error?.code ?? null,
  })

  const basePremiumUpdate = await clientA
    .from('machines')
    .update({ default_rate_per_m: 99 })
    .eq('id', MACHINE_A)
    .select('id')
  record('BOUNDARY-BASE-PREMIUM-UPDATE-DENIED', !basePremiumUpdate.error && basePremiumUpdate.data?.length === 0, {
    rows: basePremiumUpdate.data?.length ?? 0,
    code: basePremiumUpdate.error?.code ?? null,
  })

  const basePremiumInsert = await clientA.from('machines').insert({
    id: FORBIDDEN_MACHINE,
    org_id: ORG_A,
    name: '[AUDIT] This insert must be denied',
    status: 'inactive',
    machine_status: 'idle',
    loom_type: 'water_jet',
  })
  record('BOUNDARY-BASE-PREMIUM-INSERT-DENIED', Boolean(basePremiumInsert.error), {
    code: basePremiumInsert.error?.code ?? null,
  })

  const premiumRead = await clientB.from('machines').select('id').eq('id', MACHINE_B)
  record('BOUNDARY-PREMIUM-READ-ALLOWED', !premiumRead.error && premiumRead.data?.length === 1, {
    rows: premiumRead.data?.length ?? 0,
    code: premiumRead.error?.code ?? null,
  })

  const premiumUpdate = await clientB
    .from('machines')
    .update({ default_rate_per_m: 1.75 })
    .eq('id', MACHINE_B)
    .select('id')
  record('BOUNDARY-PREMIUM-UPDATE-ALLOWED', !premiumUpdate.error && premiumUpdate.data?.length === 1, {
    rows: premiumUpdate.data?.length ?? 0,
    code: premiumUpdate.error?.code ?? null,
  })

  const baseAnalytics = await clientA.rpc('get_kpi_today_live', {
    p_org_id: ORG_A,
    p_date: '2026-07-10',
  })
  record('BOUNDARY-BASE-PREMIUM-RPC-READ-DENIED', baseAnalytics.error?.code === '42501', {
    code: baseAnalytics.error?.code ?? null,
  })

  const premiumAnalytics = await clientB.rpc('get_kpi_today_live', {
    p_org_id: ORG_B,
    p_date: '2026-07-10',
  })
  record('BOUNDARY-PREMIUM-RPC-READ-ALLOWED', !premiumAnalytics.error, {
    code: premiumAnalytics.error?.code ?? null,
  })

  const crossTemplate = await clientA.from('estimator_templates').select('id').eq('id', TEMPLATE_B)
  record('TENANT-A-CANNOT-READ-B-TEMPLATE', !crossTemplate.error && crossTemplate.data?.length === 0, {
    rows: crossTemplate.data?.length ?? 0,
    code: crossTemplate.error?.code ?? null,
  })

  const crossQuote = await clientA.from('estimator_quotes').select('id').eq('id', QUOTE_B)
  record('TENANT-A-CANNOT-READ-B-QUOTE', !crossQuote.error && crossQuote.data?.length === 0, {
    rows: crossQuote.data?.length ?? 0,
    code: crossQuote.error?.code ?? null,
  })

  const forgedSourceLink = await admin
    .from('estimator_quotes')
    .update({ source_quote_id: QUOTE_B })
    .eq('id', QUOTE_A)
    .eq('org_id', ORG_A)
    .select('id')
  record('TENANT-CROSS-ORG-SOURCE-QUOTE-FK-DENIED', forgedSourceLink.error?.code === '23503', {
    code: forgedSourceLink.error?.code ?? null,
  })

  // The already-issued A token still claims owner. Change only the live audit
  // profile, prove the stale claim stops authorizing immediately, then restore
  // the exact audit-created membership in a finally block.
  const { data: roleChanged, error: roleChangeError } = await admin
    .from('profiles')
    .update({ role: 'supervisor' })
    .eq('id', USER_A)
    .eq('org_id', ORG_A)
    .select('id')
    .single()
  if (roleChangeError || !roleChanged) {
    fail('Could not stage the stale-role membership probe.', { code: roleChangeError?.code })
  }
  try {
    const staleRoleRead = await clientA.from('estimator_templates').select('id').eq('id', TEMPLATE_A)
    record('AUTHZ-STALE-JWT-ROLE-DENIED', !staleRoleRead.error && staleRoleRead.data?.length === 0, {
      rows: staleRoleRead.data?.length ?? 0,
      code: staleRoleRead.error?.code ?? null,
    })
  } finally {
    const { data: restored, error: restoreError } = await admin
      .from('profiles')
      .update({ role: 'owner' })
      .eq('id', USER_A)
      .eq('org_id', ORG_A)
      .select('id')
      .single()
    if (restoreError || !restored) {
      fail('Audit owner role restoration failed after the stale-role probe.', {
        code: restoreError?.code,
      })
    }
  }

  return { mode: 'verify', projectRef: PROJECT_REF, checks }
}

async function cleanupFixtures() {
  const { data: removed, error } = await admin
    .from('machines')
    .delete()
    .in('id', [MACHINE_A, MACHINE_B, FORBIDDEN_MACHINE])
    .in('org_id', [ORG_A, ORG_B])
    .select('id')
  if (error) fail('Could not remove exact entitlement fixtures.', { code: error.code })

  const removedIds = (removed ?? []).map(row => row.id).sort()
  if (removedIds.length !== 2 || !removedIds.includes(MACHINE_A) || !removedIds.includes(MACHINE_B)) {
    fail('Entitlement fixture cleanup count did not match exactly.', { removedIds })
  }

  return { mode: 'cleanup-fixtures', projectRef: PROJECT_REF, removedMachineIds: removedIds }
}

const mode = process.argv[2]
try {
  const result = mode === 'setup'
    ? await setup()
    : mode === 'verify'
      ? await verify()
      : mode === 'cleanup-fixtures'
        ? await cleanupFixtures()
        : fail('Use setup, verify, or cleanup-fixtures.')
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    mode,
    projectRef: PROJECT_REF,
    error: error instanceof Error ? error.message : 'Unknown failure',
    details: error?.details ?? null,
  }, null, 2))
  process.exitCode = 1
}
