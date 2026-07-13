#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const QA_REF = 'eutycrtzzxmlkcpipgod'
const secretPath = '/Users/rajpatel/.codex/secrets/weavly-formal-batch2.json'

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

const env = { ...process.env, ...parseEnv(await fs.readFile('.env.qa.local', 'utf8')) }
const url = env.NEXT_PUBLIC_SUPABASE_URL
if (!url?.includes(QA_REF)) throw new Error('Batch 2 fixture refused: isolated QA target not proven.')
if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Batch 2 fixture requires the QA service-role key.')

const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
})

async function requireSuccess(result, message) {
    if (result.error) throw new Error(`${message}: ${result.error.message}`)
    return result.data
}

async function createAuthUser(runId, label, role) {
    const email = `${runId.toLowerCase()}.${label}@example.test`
    const password = `${crypto.randomBytes(18).toString('base64url')}A1!`
    const data = await requireSuccess(
        await admin.auth.admin.createUser({ email, password, email_confirm: true }),
        `Unable to create ${label} auth user`
    )
    if (!data.user) throw new Error(`Unable to create ${label} auth user: missing user`)
    return { label, role, email, password, userId: data.user.id }
}

async function createOrganization(runId, label, tier, planId) {
    const owner = await createAuthUser(runId, `${label}-owner`, 'owner')
    const joinCode = crypto.randomBytes(4).toString('hex').toUpperCase()
    const org = await requireSuccess(
        await admin.from('organizations').insert({
            name: `${runId}-${label.toUpperCase()}`,
            owner_id: owner.userId,
            onboarding_complete: true,
            production_mode: 'both',
            join_code: joinCode,
            join_code_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }).select('id, name, join_code').single(),
        `Unable to create ${label} organization`
    )

    await requireSuccess(
        await admin.from('profiles').insert({
            id: owner.userId,
            org_id: org.id,
            role: 'owner',
            full_name: `${runId} ${label} Owner`,
            email: owner.email,
        }),
        `Unable to create ${label} owner profile`
    )

    const subscription = await requireSuccess(
        await admin.from('org_subscriptions').insert({
            org_id: org.id,
            plan_id: planId,
            status: 'active',
            plan_tier: tier,
            current_start: new Date().toISOString(),
            current_end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }).select('id').single(),
        `Unable to create ${label} subscription`
    )

    return {
        label,
        tier,
        orgId: org.id,
        orgName: org.name,
        joinCode: org.join_code,
        subscriptionId: subscription.id,
        owner: { ...owner, orgId: org.id },
    }
}

async function setup() {
    try {
        await fs.access(secretPath)
        throw new Error(`Refusing to overwrite existing fixture secret: ${secretPath}`)
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error
    }

    const plans = await requireSuccess(
        await admin.from('subscription_plans').select('id, tier, is_active').in('tier', ['base', 'premium']).eq('is_active', true),
        'Unable to load active QA subscription plans'
    )
    const planIdByTier = new Map(plans.map((plan) => [plan.tier, plan.id]))
    if (!planIdByTier.get('base') || !planIdByTier.get('premium')) {
        throw new Error('Active Base and Premium QA plan IDs are required.')
    }

    const runId = `FORMAL-B2-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const premium = await createOrganization(runId, 'premium', 'premium', planIdByTier.get('premium'))
    const base = await createOrganization(runId, 'base', 'base', planIdByTier.get('base'))
    const supervisor = await createAuthUser(runId, 'premium-supervisor', 'supervisor')
    supervisor.orgId = premium.orgId

    await requireSuccess(
        await admin.from('profiles').insert({
            id: supervisor.userId,
            org_id: premium.orgId,
            role: 'supervisor',
            full_name: `${runId} Supervisor`,
            email: supervisor.email,
        }),
        'Unable to create supervisor profile'
    )

    const fixture = { runId, premium, base, supervisor, projectRef: QA_REF }
    await fs.writeFile(secretPath, JSON.stringify(fixture), { mode: 0o600 })
    process.stdout.write(`${JSON.stringify({
        runId,
        projectRef: QA_REF,
        organizations: [
            { name: premium.orgName, tier: premium.tier },
            { name: base.orgName, tier: base.tier },
        ],
        roles: ['owner', 'owner', 'supervisor'],
        fixtureReady: true,
    })}\n`)
}

async function cleanup() {
    const fixture = JSON.parse(await fs.readFile(secretPath, 'utf8'))
    const errors = []

    for (const organization of [fixture.premium, fixture.base]) {
        const subscriptionDelete = await admin.from('org_subscriptions').delete().eq('id', organization.subscriptionId)
        if (subscriptionDelete.error) errors.push(`subscription ${organization.label}: ${subscriptionDelete.error.message}`)
    }
    for (const user of [fixture.supervisor, fixture.premium.owner, fixture.base.owner]) {
        const profileDelete = await admin.from('profiles').delete().eq('id', user.userId)
        if (profileDelete.error) errors.push(`profile ${user.label}: ${profileDelete.error.message}`)
    }
    for (const organization of [fixture.premium, fixture.base]) {
        const orgDelete = await admin.from('organizations').delete().eq('id', organization.orgId)
        if (orgDelete.error) errors.push(`organization ${organization.label}: ${orgDelete.error.message}`)
    }
    for (const user of [fixture.supervisor, fixture.premium.owner, fixture.base.owner]) {
        const userDelete = await admin.auth.admin.deleteUser(user.userId)
        if (userDelete.error && userDelete.error.code !== 'user_not_found') {
            errors.push(`auth ${user.label}: ${userDelete.error.message}`)
        }
    }

    const [orgCount, profileCount, subscriptionCount] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).in('id', [fixture.premium.orgId, fixture.base.orgId]),
        admin.from('profiles').select('id', { count: 'exact', head: true }).in('id', [fixture.premium.owner.userId, fixture.base.owner.userId, fixture.supervisor.userId]),
        admin.from('org_subscriptions').select('id', { count: 'exact', head: true }).in('id', [fixture.premium.subscriptionId, fixture.base.subscriptionId]),
    ])
    if (orgCount.error || profileCount.error || subscriptionCount.error) errors.push('Fixture count reconciliation failed.')
    if (orgCount.count !== 0 || profileCount.count !== 0 || subscriptionCount.count !== 0) {
        errors.push(`Fixture rows remain: org=${orgCount.count}, profile=${profileCount.count}, subscription=${subscriptionCount.count}`)
    }

    for (const user of [fixture.supervisor, fixture.premium.owner, fixture.base.owner]) {
        const userRead = await admin.auth.admin.getUserById(user.userId)
        if (!userRead.error && userRead.data?.user) {
            errors.push(`Auth user remains: ${user.label}`)
        } else if (userRead.error && userRead.error.code !== 'user_not_found' && userRead.error.status !== 404) {
            errors.push(`Auth reconciliation ${user.label}: ${userRead.error.message}`)
        }
    }

    if (errors.length > 0) throw new Error(errors.join('; '))
    await fs.rm(secretPath, { force: true })
    process.stdout.write(`${JSON.stringify({ runId: fixture.runId, projectRef: QA_REF, cleaned: true })}\n`)
}

const command = process.argv[2]
if (command === 'setup') await setup()
else if (command === 'cleanup') await cleanup()
else throw new Error('Usage: formal-batch2-fixture.mjs setup|cleanup')
