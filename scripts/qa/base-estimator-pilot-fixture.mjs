#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const PRODUCTION_REF = 'vzhwahudircrpgtitwzd'
const ENV_PATH = '.env.production.local'
const SECRET_PATH = '/Users/rajpatel/.codex/secrets/weavly-base-estimator-pilot.json'

function parseEnv(contents) {
    return Object.fromEntries(contents.split(/\r?\n/).flatMap((raw) => {
        const line = raw.trim()
        if (!line || line.startsWith('#') || !line.includes('=')) return []
        const separator = line.indexOf('=')
        let value = line.slice(separator + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        return [[line.slice(0, separator), value]]
    }))
}

const env = { ...process.env, ...parseEnv(await fs.readFile(ENV_PATH, 'utf8')) }
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(PRODUCTION_REF)) {
    throw new Error('Base Estimator pilot fixture refused: production target not proven.')
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Production service-role key is required.')

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
})

async function requireData(result, label) {
    if (result.error) throw new Error(`${label}: ${result.error.message}`)
    return result.data
}

async function setup() {
    try {
        await fs.access(SECRET_PATH)
        throw new Error(`Refusing to overwrite active fixture: ${SECRET_PATH}`)
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error
    }

    const runId = `BASEGO-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const email = `${runId.toLowerCase()}@prod-proof.weavly.local`
    const password = `Base-${crypto.randomBytes(18).toString('base64url')}A1!`
    const user = await requireData(await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `${runId} Owner` },
    }), 'Create pilot owner')
    if (!user.user) throw new Error('Create pilot owner: missing user')

    const organization = await requireData(await admin.from('organizations').insert({
        name: `${runId} MILL`,
        owner_id: user.user.id,
        onboarding_complete: true,
        production_mode: 'both',
    }).select('id, name').single(), 'Create pilot organization')

    await requireData(await admin.from('profiles').insert({
        id: user.user.id,
        org_id: organization.id,
        role: 'owner',
        full_name: `${runId} Owner`,
        email,
    }), 'Create pilot profile')

    const plan = await requireData(await admin.from('subscription_plans')
        .select('id').eq('tier', 'base').eq('is_active', true).limit(1).single(), 'Load Base plan')
    const subscription = await requireData(await admin.from('org_subscriptions').insert({
        org_id: organization.id,
        plan_id: plan.id,
        plan_tier: 'base',
        status: 'active',
        current_start: new Date().toISOString(),
        current_end: new Date(Date.now() + 2 * 86400000).toISOString(),
    }).select('id').single(), 'Create Base entitlement')

    const fixture = {
        runId,
        projectRef: PRODUCTION_REF,
        userId: user.user.id,
        orgId: organization.id,
        subscriptionId: subscription.id,
        organizationName: organization.name,
        email,
        password,
    }
    await fs.mkdir('/Users/rajpatel/.codex/secrets', { recursive: true, mode: 0o700 })
    await fs.writeFile(SECRET_PATH, JSON.stringify(fixture), { mode: 0o600 })
    process.stdout.write(`${JSON.stringify({ runId, projectRef: PRODUCTION_REF, tier: 'base', fixtureReady: true })}\n`)
}

async function cleanup() {
    const fixture = JSON.parse(await fs.readFile(SECRET_PATH, 'utf8'))
    if (fixture.projectRef !== PRODUCTION_REF || !String(fixture.runId).startsWith('BASEGO-')) {
        throw new Error('Cleanup refused: fixture identity is not exact.')
    }
    const errors = []
    for (const [table, column] of [
        ['cost_rate_history', 'org_id'], ['cost_rate_book', 'org_id'], ['estimator_quotes', 'org_id'],
        ['estimator_templates', 'org_id'], ['factory_cost_profile', 'factory_id'],
        ['org_subscriptions', 'org_id'], ['audit_log', 'org_id'],
    ]) {
        const result = await admin.from(table).delete().eq(column, fixture.orgId)
        if (result.error) errors.push(`${table}: ${result.error.message}`)
    }
    const profile = await admin.from('profiles').delete().eq('id', fixture.userId)
    if (profile.error) errors.push(`profiles: ${profile.error.message}`)
    const organization = await admin.from('organizations').delete().eq('id', fixture.orgId)
    if (organization.error) errors.push(`organizations: ${organization.error.message}`)
    const auth = await admin.auth.admin.deleteUser(fixture.userId)
    if (auth.error && auth.error.code !== 'user_not_found') errors.push(`auth: ${auth.error.message}`)

    const [orgCount, profileCount, subscriptionCount, authRead] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).eq('id', fixture.orgId),
        admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', fixture.userId),
        admin.from('org_subscriptions').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId),
        admin.auth.admin.getUserById(fixture.userId),
    ])
    const reconciliation = {
        organizations: orgCount.count,
        profiles: profileCount.count,
        subscriptions: subscriptionCount.count,
        authUsers: authRead.data.user ? 1 : 0,
    }
    if (errors.length || Object.values(reconciliation).some((count) => count !== 0)) {
        throw new Error(`Cleanup reconciliation failed: ${JSON.stringify({ errors, reconciliation })}`)
    }
    await fs.rm(SECRET_PATH, { force: true })
    process.stdout.write(`${JSON.stringify({ runId: fixture.runId, cleaned: true, reconciliation })}\n`)
}

async function cleanupSignup(email, organizationName) {
    if (!/^weavly\.qa\+[a-z0-9]+@gmail\.com$/i.test(email ?? '')) {
        throw new Error('Signup cleanup refused: exact QA email pattern is required.')
    }
    if (!/^BASEGO-[A-Z0-9-]+ MILL$/.test(organizationName ?? '')) {
        throw new Error('Signup cleanup refused: exact BASEGO organization name is required.')
    }

    const users = await requireData(await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }), 'List Auth users')
    const user = users.users.find(candidate => candidate.email?.toLowerCase() === email.toLowerCase())
    if (!user) throw new Error('Signup cleanup refused: exact Auth user was not found.')
    const organization = await requireData(await admin.from('organizations')
        .select('id, name, owner_id').eq('owner_id', user.id).eq('name', organizationName).single(), 'Load exact signup organization')

    const errors = []
    for (const [table, column] of [
        ['cost_rate_history', 'org_id'], ['cost_rate_book', 'org_id'], ['estimator_quotes', 'org_id'],
        ['estimator_templates', 'org_id'], ['factory_cost_profile', 'factory_id'],
        ['org_subscriptions', 'org_id'], ['audit_log', 'org_id'],
    ]) {
        const result = await admin.from(table).delete().eq(column, organization.id)
        if (result.error) errors.push(`${table}: ${result.error.message}`)
    }
    const profile = await admin.from('profiles').delete().eq('id', user.id).eq('org_id', organization.id)
    if (profile.error) errors.push(`profiles: ${profile.error.message}`)
    const orgDelete = await admin.from('organizations').delete().eq('id', organization.id).eq('owner_id', user.id)
    if (orgDelete.error) errors.push(`organizations: ${orgDelete.error.message}`)
    const authDelete = await admin.auth.admin.deleteUser(user.id)
    if (authDelete.error && authDelete.error.code !== 'user_not_found') errors.push(`auth: ${authDelete.error.message}`)

    const [orgCount, profileCount, authRead] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).eq('id', organization.id),
        admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', user.id),
        admin.auth.admin.getUserById(user.id),
    ])
    const reconciliation = {
        organizations: orgCount.count,
        profiles: profileCount.count,
        authUsers: authRead.data.user ? 1 : 0,
    }
    if (errors.length || Object.values(reconciliation).some((count) => count !== 0)) {
        throw new Error(`Signup cleanup reconciliation failed: ${JSON.stringify({ errors, reconciliation })}`)
    }
    process.stdout.write(`${JSON.stringify({ organizationName, cleaned: true, reconciliation })}\n`)
}

const command = process.argv[2]
if (command === 'setup') await setup()
else if (command === 'cleanup') await cleanup()
else if (command === 'cleanup-signup') await cleanupSignup(process.argv[3], process.argv[4])
else throw new Error('Usage: base-estimator-pilot-fixture.mjs setup|cleanup|cleanup-signup <email> <organization-name>')
