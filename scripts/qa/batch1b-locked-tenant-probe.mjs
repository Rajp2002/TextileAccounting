#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const workspace = process.cwd()

function parseEnv(contents) {
    const result = {}
    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
        if (!match) continue
        let value = match[2].trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        result[match[1]] = value
    }
    return result
}

async function readEnv() {
    const env = { ...process.env }
    for (const relative of ['.env.local', 'supabase/.env.local']) {
        try {
            Object.assign(env, parseEnv(await fs.readFile(path.join(workspace, relative), 'utf8')))
        } catch (error) {
            if (error.code !== 'ENOENT') throw error
        }
    }
    return env
}

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : null
}

function summarizeError(error) {
    if (!error) return null
    return {
        message: String(error.message || error).slice(0, 220),
        code: error.code || null,
        status: error.status || null,
    }
}

function assertCondition(assertions, name, passed, details = {}) {
    assertions.push({ name, passed, ...details })
}

async function createDisposableOwner(admin, anon, locked) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const email = `batch1b-lock-${locked ? 'locked' : 'open'}-${suffix}@qa.weavly.local`
    const password = `B1b-${suffix}-${crypto.randomBytes(8).toString('hex')}!`

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `Batch 1B ${locked ? 'Locked' : 'Unlocked'} Owner` },
    })
    if (userError || !userData.user) throw new Error(`failed to create disposable user: ${userError?.message}`)

    const { data: org, error: orgError } = await admin
        .from('organizations')
        .insert({
            name: `Batch 1B ${locked ? 'Locked' : 'Unlocked'} ${suffix}`,
            owner_id: userData.user.id,
            join_code: `B1B${suffix.slice(0, 5).toUpperCase()}`,
            join_code_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            onboarding_complete: true,
            production_mode: 'market_run',
            is_locked_down: locked,
            lockdown_reason: locked ? 'Batch 1B-B runtime proof' : null,
            lockdown_severity: locked ? 'medium' : null,
            locked_at: locked ? new Date().toISOString() : null,
            locked_by: locked ? userData.user.id : null,
        })
        .select('id')
        .single()
    if (orgError || !org) throw new Error(`failed to create disposable org: ${orgError?.message}`)

    const { error: profileError } = await admin
        .from('profiles')
        .insert({
            id: userData.user.id,
            org_id: org.id,
            role: 'owner',
            full_name: `Batch 1B ${locked ? 'Locked' : 'Unlocked'} Owner`,
            email,
        })
    if (profileError) throw new Error(`failed to create disposable profile: ${profileError.message}`)

    const client = createClient(anon.url, anon.key, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const signIn = await client.auth.signInWithPassword({ email, password })
    if (signIn.error || !signIn.data.user) throw new Error(`failed to sign in disposable owner: ${signIn.error?.message}`)

    return {
        client,
        email,
        orgId: org.id,
        userId: userData.user.id,
        sessionUserId: signIn.data.user.id,
        supervisor: null,
    }
}

async function createDisposableSupervisor(admin, anon, orgId, locked) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const email = `batch1b-lock-${locked ? 'locked' : 'open'}-supervisor-${suffix}@qa.weavly.local`
    const password = `B1bSup-${suffix}-${crypto.randomBytes(8).toString('hex')}!`

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `Batch 1B ${locked ? 'Locked' : 'Unlocked'} Supervisor` },
    })
    if (userError || !userData.user) throw new Error(`failed to create disposable supervisor: ${userError?.message}`)

    const { error: profileError } = await admin
        .from('profiles')
        .insert({
            id: userData.user.id,
            org_id: orgId,
            role: 'supervisor',
            full_name: `Batch 1B ${locked ? 'Locked' : 'Unlocked'} Supervisor`,
            email,
        })
    if (profileError) throw new Error(`failed to create disposable supervisor profile: ${profileError.message}`)

    const client = createClient(anon.url, anon.key, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const signIn = await client.auth.signInWithPassword({ email, password })
    if (signIn.error || !signIn.data.user) throw new Error(`failed to sign in disposable supervisor: ${signIn.error?.message}`)

    return {
        client,
        email,
        userId: userData.user.id,
        sessionUserId: signIn.data.user.id,
    }
}

async function cleanupDisposable(admin, resources) {
    for (const resource of resources) {
        if (!resource) continue
        for (const table of [
            'worker_advances',
            'fabric_stock_movements',
            'fabric_stock_sales',
            'fabric_stock_lots',
            'workers',
        ]) {
            try {
                await admin.from(table).delete().eq('org_id', resource.orgId)
            } catch {}
        }
        try {
            await admin.from('profiles').delete().eq('id', resource.supervisor?.userId)
        } catch {}
        try {
            await admin.from('profiles').delete().eq('id', resource.userId)
        } catch {}
        try {
            await admin.from('organizations').delete().eq('id', resource.orgId)
        } catch {}
        try {
            if (resource.supervisor?.userId) await admin.auth.admin.deleteUser(resource.supervisor.userId)
        } catch {}
        try {
            await admin.auth.admin.deleteUser(resource.userId)
        } catch {}
    }
}

async function seedWorker(admin, orgId) {
    const { data, error } = await admin
        .from('workers')
        .insert({
            org_id: orgId,
            name: `Seed worker ${crypto.randomBytes(3).toString('hex')}`,
            is_active: true,
        })
        .select('id')
        .single()
    if (error || !data) throw new Error(`failed to seed worker: ${error?.message}`)
    return data.id
}

async function attemptRepresentativeWrites(owner, orgId, seededWorkerId = null) {
    const worker = await owner
        .from('workers')
        .insert({
            org_id: orgId,
            name: `Client worker ${crypto.randomBytes(3).toString('hex')}`,
            is_active: true,
        })
        .select('id')
        .maybeSingle()

    const stockLot = await owner
        .from('fabric_stock_lots')
        .insert({
            org_id: orgId,
            quality_label: 'Batch 1B QA Fabric',
            godown: 'QA Godown',
            source_type: 'manual',
            original_taka_count: 1,
            available_taka_count: 1,
            meters_per_taka: 100,
            unit_label: 'taka',
            original_meters: 100,
            available_meters: 100,
            stock_purpose: 'manual',
            cost_per_meter: 1,
            received_date: new Date().toISOString().slice(0, 10),
            notes: 'Batch 1B-B runtime probe',
        })
        .select('id')
        .maybeSingle()

    const advanceWorkerId = seededWorkerId ?? worker.data?.id
    const advance = advanceWorkerId
        ? await owner
            .from('worker_advances')
            .insert({
                org_id: orgId,
                meter_worker_id: advanceWorkerId,
                amount: 10,
                description: 'Batch 1B-B runtime probe',
                status: 'pending',
            })
            .select('id')
            .maybeSingle()
        : { data: null, error: new Error('no worker available for advance probe') }

    return { worker, stockLot, advance }
}

async function main() {
    const env = await readEnv()
    const url = env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !anonKey || !serviceKey) {
        throw new Error('Missing Supabase URL, anon key, or service-role key in local env files.')
    }

    const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const anon = { url, key: anonKey }
    const assertions = []
    let locked = null
    let unlocked = null

    try {
        locked = await createDisposableOwner(admin, anon, true)
        unlocked = await createDisposableOwner(admin, anon, false)
        locked.supervisor = await createDisposableSupervisor(admin, anon, locked.orgId, true)
        unlocked.supervisor = await createDisposableSupervisor(admin, anon, unlocked.orgId, false)
        const lockedSeedWorkerId = await seedWorker(admin, locked.orgId)

        assertCondition(assertions, 'locked owner login still works', locked.sessionUserId === locked.userId)
        assertCondition(assertions, 'locked supervisor login still works', locked.supervisor.sessionUserId === locked.supervisor.userId)
        assertCondition(assertions, 'unlocked owner login still works', unlocked.sessionUserId === unlocked.userId)
        assertCondition(assertions, 'unlocked supervisor login still works', unlocked.supervisor.sessionUserId === unlocked.supervisor.userId)

        const lockedWrites = await attemptRepresentativeWrites(locked.client, locked.orgId, lockedSeedWorkerId)
        assertCondition(assertions, 'locked org direct workers insert denied', Boolean(lockedWrites.worker.error), {
            error: summarizeError(lockedWrites.worker.error),
        })
        assertCondition(assertions, 'locked org direct fabric_stock_lots insert denied', Boolean(lockedWrites.stockLot.error), {
            error: summarizeError(lockedWrites.stockLot.error),
        })
        assertCondition(assertions, 'locked org direct worker_advances insert denied', Boolean(lockedWrites.advance.error), {
            error: summarizeError(lockedWrites.advance.error),
        })

        const lockedRpc = await locked.client.rpc('replace_shift_production_logs', {
            p_logs: [],
            p_allow_overwrite: false,
            p_access_code_used: false,
        })
        assertCondition(assertions, 'locked org mutating RPC denied', Boolean(lockedRpc.error), {
            error: summarizeError(lockedRpc.error),
        })

        const unlockedWrites = await attemptRepresentativeWrites(unlocked.client, unlocked.orgId)
        assertCondition(assertions, 'unlocked org direct workers insert still works', !unlockedWrites.worker.error && Boolean(unlockedWrites.worker.data?.id), {
            error: summarizeError(unlockedWrites.worker.error),
        })
        assertCondition(assertions, 'unlocked org direct fabric_stock_lots insert still works', !unlockedWrites.stockLot.error && Boolean(unlockedWrites.stockLot.data?.id), {
            error: summarizeError(unlockedWrites.stockLot.error),
        })
        assertCondition(assertions, 'unlocked org direct worker_advances insert still works', !unlockedWrites.advance.error && Boolean(unlockedWrites.advance.data?.id), {
            error: summarizeError(unlockedWrites.advance.error),
        })

        const unlockedRpc = await unlocked.client.rpc('replace_shift_production_logs', {
            p_logs: [],
            p_allow_overwrite: false,
            p_access_code_used: false,
        })
        assertCondition(assertions, 'unlocked org mutating RPC empty batch still works', !unlockedRpc.error, {
            error: summarizeError(unlockedRpc.error),
        })

        const passed = assertions.every((assertion) => assertion.passed)
        console.log(JSON.stringify({
            passed,
            checkedAt: new Date().toISOString(),
            projectRef: new URL(url).hostname.split('.')[0],
            lockedOrgId: safeId(locked.orgId),
            unlockedOrgId: safeId(unlocked.orgId),
            assertions,
        }, null, 2))

        if (!passed) process.exitCode = 1
    } finally {
        await cleanupDisposable(admin, [locked, unlocked])
    }
}

await main()
