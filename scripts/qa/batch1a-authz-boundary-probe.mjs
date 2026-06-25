#!/usr/bin/env node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const workspace = process.cwd()
const credentialLoaderUrl = pathToFileURL(path.join(
    os.homedir(),
    '.codex/skills/weavly-browser-login/scripts/load-credentials.mjs'
)).href
const { loadWeavlyCredentials } = await import(credentialLoaderUrl)

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

function decodeJwt(token) {
    try {
        const payload = token.split('.')[1]
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
        return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
    } catch {
        return {}
    }
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

async function getProfile(admin, userId) {
    const { data, error } = await admin
        .from('profiles')
        .select('id, role, org_id')
        .eq('id', userId)
        .single()
    if (error) throw new Error(`profile lookup failed: ${error.message}`)
    return data
}

async function findTargetOrg(admin, originalOrgId) {
    const { data, error } = await admin
        .from('organizations')
        .select('id')
        .neq('id', originalOrgId)
        .or('name.ilike.%QA%,name.ilike.%PILOTQA%,name.ilike.%TEST%,name.ilike.%test%,name.ilike.%Batch%')
        .order('created_at', { ascending: false })
        .limit(1)

    if (error) throw new Error(`target org lookup failed: ${error.message}`)
    if (!data?.[0]?.id) {
        throw new Error('No second QA/disposable organization found for the org_id mutation probe.')
    }
    return data[0].id
}

function assertCondition(assertions, name, passed, details = {}) {
    assertions.push({ name, passed, ...details })
}

const env = await readEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anon || !service) {
    throw new Error('Missing Supabase URL, anon key, or service-role key in local env files.')
}

const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
})

const supervisorCreds = await loadWeavlyCredentials({ role: 'supervisor' })
const ownerCreds = await loadWeavlyCredentials({ role: 'owner' })

const supervisor = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
})
const owner = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
})

const assertions = []
let supervisorUserId = null
let originalProfile = null

try {
    const supervisorSignIn = await supervisor.auth.signInWithPassword({
        email: supervisorCreds.email,
        password: supervisorCreds.password,
    })
    if (supervisorSignIn.error || !supervisorSignIn.data.user) {
        throw new Error(`Supervisor sign-in failed: ${supervisorSignIn.error?.message}`)
    }

    supervisorUserId = supervisorSignIn.data.user.id
    originalProfile = await getProfile(admin, supervisorUserId)
    const targetOrgId = await findTargetOrg(admin, originalProfile.org_id)

    assertCondition(assertions, 'supervisor starts as supervisor', originalProfile.role === 'supervisor', {
        role: originalProfile.role,
    })

    const roleMutation = await supervisor
        .from('profiles')
        .update({ role: 'owner' })
        .eq('id', supervisorUserId)
        .select('id, role, org_id')
        .maybeSingle()
    const afterRoleMutation = await getProfile(admin, supervisorUserId)
    const afterRoleRefresh = await supervisor.auth.refreshSession()
    const roleClaims = afterRoleRefresh.data.session?.access_token
        ? decodeJwt(afterRoleRefresh.data.session.access_token)
        : {}

    assertCondition(assertions, 'direct role mutation denied', Boolean(roleMutation.error), {
        error: summarizeError(roleMutation.error),
    })
    assertCondition(assertions, 'role remains supervisor after denied role mutation', afterRoleMutation.role === originalProfile.role, {
        storedRole: afterRoleMutation.role,
    })
    assertCondition(assertions, 'token refresh does not mint owner role', roleClaims.user_role !== 'owner', {
        refreshedUserRole: roleClaims.user_role || null,
    })

    const orgMutation = await supervisor
        .from('profiles')
        .update({ org_id: targetOrgId })
        .eq('id', supervisorUserId)
        .select('id, role, org_id')
        .maybeSingle()
    const afterOrgMutation = await getProfile(admin, supervisorUserId)
    const afterOrgRefresh = await supervisor.auth.refreshSession()
    const orgClaims = afterOrgRefresh.data.session?.access_token
        ? decodeJwt(afterOrgRefresh.data.session.access_token)
        : {}

    assertCondition(assertions, 'direct org mutation denied', Boolean(orgMutation.error), {
        error: summarizeError(orgMutation.error),
    })
    assertCondition(assertions, 'org remains unchanged after denied org mutation', afterOrgMutation.org_id === originalProfile.org_id, {
        storedOrgId: safeId(afterOrgMutation.org_id),
    })
    assertCondition(assertions, 'token refresh keeps original supervisor org', orgClaims.org_id === originalProfile.org_id, {
        refreshedOrgId: safeId(orgClaims.org_id),
    })

    const ownerOnlyRpc = await supervisor.rpc('record_commercial_payment_v1', {
        p_receivable_id: '00000000-0000-0000-0000-000000000000',
        p_amount: 1,
        p_payment_date: new Date().toISOString().slice(0, 10),
        p_payment_mode: 'cash',
        p_reference_number: null,
        p_cheque_number: null,
        p_cheque_date: null,
        p_bank_name: null,
        p_notes: 'batch1a-authz-boundary-probe',
    })

    assertCondition(
        assertions,
        'supervisor owner-only RPC denied after failed mutation and refresh',
        Boolean(ownerOnlyRpc.error) && /only owners/i.test(ownerOnlyRpc.error.message || ''),
        { error: summarizeError(ownerOnlyRpc.error) }
    )

    const ownerSignIn = await owner.auth.signInWithPassword({
        email: ownerCreds.email,
        password: ownerCreds.password,
    })
    if (ownerSignIn.error || !ownerSignIn.data.user) {
        throw new Error(`Owner sign-in failed: ${ownerSignIn.error?.message}`)
    }
    const ownerProfile = await getProfile(admin, ownerSignIn.data.user.id)
    const ownerRefresh = await owner.auth.refreshSession()
    const ownerClaims = ownerRefresh.data.session?.access_token
        ? decodeJwt(ownerRefresh.data.session.access_token)
        : {}

    assertCondition(assertions, 'owner normal login profile remains owner', ownerProfile.role === 'owner', {
        ownerRole: ownerProfile.role,
    })
    assertCondition(assertions, 'owner token refresh still mints owner role', ownerClaims.user_role === 'owner', {
        ownerUserRole: ownerClaims.user_role || null,
    })

    const passed = assertions.every(assertion => assertion.passed)
    console.log(JSON.stringify({
        passed,
        checkedAt: new Date().toISOString(),
        projectRef: new URL(url).hostname.split('.')[0],
        qaSupervisor: {
            userId: safeId(supervisorUserId),
            originalRole: originalProfile.role,
            originalOrgId: safeId(originalProfile.org_id),
            targetOrgId: safeId(targetOrgId),
        },
        assertions,
    }, null, 2))

    if (!passed) process.exitCode = 1
} finally {
    if (supervisorUserId && originalProfile) {
        await admin
            .from('profiles')
            .update({ role: originalProfile.role, org_id: originalProfile.org_id })
            .eq('id', supervisorUserId)
    }
    await supervisor.auth.signOut().catch(() => {})
    await owner.auth.signOut().catch(() => {})
}
