#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const QA_REF = 'eutycrtzzxmlkcpipgod'
const PROD_REF = 'vzhwahudircrpgtitwzd'
const secretPath = '/Users/rajpatel/.codex/secrets/ux007-qa-fixture.json'

function parseEnv(contents) {
    const env = {}
    for (const raw of contents.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.startsWith('#') || !line.includes('=')) continue
        const separator = line.indexOf('=')
        let value = line.slice(separator + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        env[line.slice(0, separator)] = value
    }
    return env
}

const env = { ...process.env, ...parseEnv(await fs.readFile('.env.qa.local', 'utf8')) }
const url = env.NEXT_PUBLIC_SUPABASE_URL
if (!url?.includes(QA_REF) || url.includes(PROD_REF)) throw new Error('UX-007 fixture refused: QA target not proven.')
if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('UX-007 fixture requires the QA service-role key.')

const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const command = process.argv[2]

if (command === 'setup') {
    const runId = `UX007-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const email = `ux007.${Date.now()}@example.test`
    const password = `${crypto.randomBytes(18).toString('base64url')}A1!`
    const createdUser = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (createdUser.error || !createdUser.data.user) throw new Error('Unable to create UX-007 QA auth user.')
    const userId = createdUser.data.user.id

    try {
        const organization = await admin.from('organizations').insert({
            name: `QA-${runId}`,
            owner_id: userId,
            onboarding_complete: true,
            production_mode: 'both',
        }).select('id').single()
        if (organization.error || !organization.data) throw new Error('Unable to create UX-007 QA organization.')
        const orgId = organization.data.id

        const profile = await admin.from('profiles').insert({
            id: userId,
            org_id: orgId,
            role: 'owner',
            full_name: `QA Owner ${runId}`,
            email,
        })
        if (profile.error) throw new Error('Unable to create UX-007 QA profile.')

        const subscription = await admin.from('org_subscriptions').insert({
            org_id: orgId,
            plan_id: 'trial',
            status: 'active',
            plan_tier: 'premium',
            trial_end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }).select('id').single()
        if (subscription.error || !subscription.data) throw new Error('Unable to create UX-007 QA subscription.')

        await fs.writeFile(secretPath, JSON.stringify({
            runId,
            email,
            password,
            userId,
            orgId,
            subscriptionId: subscription.data.id,
            baseUrl: 'http://localhost:3000',
        }), { mode: 0o600 })
        process.stdout.write(`${JSON.stringify({ runId, projectRef: QA_REF, fixtureReady: true })}\n`)
    } catch (error) {
        await admin.auth.admin.deleteUser(userId)
        throw error
    }
} else if (command === 'cleanup') {
    const fixture = JSON.parse(await fs.readFile(secretPath, 'utf8'))
    const subscriptionDelete = await admin.from('org_subscriptions').delete().eq('id', fixture.subscriptionId)
    if (subscriptionDelete.error) throw new Error(`Unable to delete QA subscription: ${subscriptionDelete.error.message}`)

    const profileDelete = await admin.from('profiles').delete().eq('id', fixture.userId)
    if (profileDelete.error) throw new Error(`Unable to delete QA profile: ${profileDelete.error.message}`)

    const organizationDelete = await admin.from('organizations').delete().eq('id', fixture.orgId)
    if (organizationDelete.error) throw new Error(`Unable to delete QA organization: ${organizationDelete.error.message}`)

    const userDelete = await admin.auth.admin.deleteUser(fixture.userId)
    if (userDelete.error && userDelete.error.code !== 'user_not_found') {
        throw new Error(`Unable to delete QA auth user: ${userDelete.error.message}`)
    }

    const [organizationAfter, profileAfter, subscriptionAfter, authAfter] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).eq('id', fixture.orgId),
        admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', fixture.userId),
        admin.from('org_subscriptions').select('id', { count: 'exact', head: true }).eq('id', fixture.subscriptionId),
        admin.auth.admin.getUserById(fixture.userId),
    ])
    if (organizationAfter.error || profileAfter.error || subscriptionAfter.error) {
        throw new Error('Unable to reconcile QA fixture cleanup.')
    }
    if (
        organizationAfter.count !== 0
        || profileAfter.count !== 0
        || subscriptionAfter.count !== 0
        || authAfter.data.user
    ) {
        throw new Error('QA fixture cleanup left one or more account records behind.')
    }

    await fs.rm(secretPath, { force: true })
    process.stdout.write(`${JSON.stringify({ runId: fixture.runId, projectRef: QA_REF, cleaned: true })}\n`)
} else {
    throw new Error('Usage: ux-007-browser-fixture.mjs setup|cleanup')
}
