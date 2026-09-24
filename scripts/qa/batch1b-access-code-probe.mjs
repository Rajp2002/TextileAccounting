#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { Redis } from '@upstash/redis'
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
    Object.assign(process.env, env)
    return env
}

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : null
}

function hashCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex')
}

function assertCondition(assertions, name, passed, details = {}) {
    assertions.push({ name, passed, ...details })
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

async function readAccessCodeState(admin, orgId) {
    const { data, error } = await admin
        .from('organizations')
        .select('id, access_code_hash, access_code_expires_at, last_code_plain')
        .eq('id', orgId)
        .single()
    if (error) throw new Error(`organization lookup failed: ${error.message}`)
    return data
}

async function restoreAccessCodeState(admin, orgId, originalState) {
    await admin
        .from('organizations')
        .update({
            access_code_hash: originalState.access_code_hash,
            access_code_expires_at: originalState.access_code_expires_at,
            last_code_plain: null,
        })
        .eq('id', orgId)
}

async function createDisposableOrg(admin, ownerId) {
    const suffix = crypto.randomBytes(4).toString('hex').toUpperCase()
    const { data, error } = await admin
        .from('organizations')
        .insert({
            name: `Batch1B Access Probe ${suffix}`,
            owner_id: ownerId,
            onboarding_complete: true,
            production_mode: 'market_run',
            last_code_plain: null,
        })
        .select('id')
        .single()

    if (error) throw new Error(`failed to create disposable QA organization: ${error.message}`)
    return data.id
}

async function setCode(admin, orgId, code, expiresAt) {
    const { error } = await admin
        .from('organizations')
        .update({
            access_code_hash: hashCode(code),
            access_code_expires_at: expiresAt,
            last_code_plain: null,
        })
        .eq('id', orgId)
    if (error) throw new Error(`failed to seed QA access code: ${error.message}`)
}

async function consumeLikeCentralHelper(admin, orgId, code) {
    const org = await readAccessCodeState(admin, orgId)
    if (!org.access_code_hash) return { ok: false, reason: 'missing_hash' }
    if (new Date(org.access_code_expires_at) < new Date()) return { ok: false, reason: 'expired' }
    if (!/^[a-f0-9]{64}$/i.test(org.access_code_hash)) return { ok: false, reason: 'bad_hash_shape' }
    if (hashCode(code) !== org.access_code_hash) return { ok: false, reason: 'wrong_code' }

    const { data, error } = await admin
        .from('organizations')
        .update({
            access_code_hash: null,
            access_code_expires_at: null,
            last_code_plain: null,
        })
        .eq('id', orgId)
        .eq('access_code_hash', org.access_code_hash)
        .select('id')
        .maybeSingle()

    if (error) return { ok: false, reason: error.message }
    return { ok: Boolean(data), reason: data ? 'consumed' : 'race_or_reuse' }
}

function runMissingRedisCheck(rateLimitPath) {
    const code = `
        const mod = await import(${JSON.stringify(pathToFileURL(rateLimitPath).href + '?missing=' + Date.now())});
        try {
            await mod.checkAccessCodeRateLimit('batch1b-missing-redis');
            console.log(JSON.stringify({ passed: false, message: 'allowed without redis' }));
        } catch (error) {
            console.log(JSON.stringify({ passed: /temporarily unavailable/i.test(String(error.message)), message: String(error.message) }));
        }
    `
    const env = { ...process.env }
    delete env.UPSTASH_REDIS_REST_URL
    delete env.UPSTASH_REDIS_REST_TOKEN
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
        cwd: workspace,
        env,
        encoding: 'utf8',
    })
    if (result.status !== 0) {
        return { passed: false, message: result.stderr.trim() || result.stdout.trim() }
    }
    return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1))
}

const env = await readEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = env.SUPABASE_SERVICE_ROLE_KEY
const redisUrl = env.UPSTASH_REDIS_REST_URL
const redisToken = env.UPSTASH_REDIS_REST_TOKEN

if (!url || !anon || !service) {
    throw new Error('Missing Supabase URL, anon key, or service-role key in local env files.')
}
if (!redisUrl || !redisToken) {
    throw new Error('Missing Upstash Redis env; SEC-006 runtime limiter proof cannot run.')
}

const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
})
const owner = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
})
const supervisor = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
})
const redis = new Redis({ url: redisUrl, token: redisToken })
const rateLimitPath = path.join(workspace, 'lib/rate-limit.ts')
const rateLimitModule = await import(pathToFileURL(rateLimitPath).href + '?runtime=' + Date.now())
const {
    checkAccessCodeRateLimit,
    recordAccessCodeFailure,
    checkAccessCodeLockout,
    resetAccessCodeFailures,
} = rateLimitModule

const assertions = []
let loginOrgId = null
let orgId = null
let originalState = null
let disposableOrgId = null

try {
    const ownerCreds = await loadWeavlyCredentials({ role: 'owner' })
    const supervisorCreds = await loadWeavlyCredentials({ role: 'supervisor' })

    const ownerSignIn = await owner.auth.signInWithPassword({
        email: ownerCreds.email,
        password: ownerCreds.password,
    })
    if (ownerSignIn.error || !ownerSignIn.data.user) throw new Error(`owner sign-in failed: ${ownerSignIn.error?.message}`)

    const supervisorSignIn = await supervisor.auth.signInWithPassword({
        email: supervisorCreds.email,
        password: supervisorCreds.password,
    })
    if (supervisorSignIn.error || !supervisorSignIn.data.user) {
        throw new Error(`supervisor sign-in failed: ${supervisorSignIn.error?.message}`)
    }

    const ownerProfile = await getProfile(admin, ownerSignIn.data.user.id)
    const supervisorProfile = await getProfile(admin, supervisorSignIn.data.user.id)
    loginOrgId = ownerProfile.org_id

    assertCondition(assertions, 'owner login/profile works', ownerProfile.role === 'owner', {
        ownerRole: ownerProfile.role,
        ownerOrgId: safeId(ownerProfile.org_id),
    })
    assertCondition(assertions, 'supervisor login/profile works in same QA org', supervisorProfile.role === 'supervisor' && supervisorProfile.org_id === loginOrgId, {
        supervisorRole: supervisorProfile.role,
        supervisorOrgId: safeId(supervisorProfile.org_id),
    })

    disposableOrgId = await createDisposableOrg(admin, ownerSignIn.data.user.id)
    orgId = disposableOrgId
    originalState = await readAccessCodeState(admin, orgId)

    const missingRedis = runMissingRedisCheck(rateLimitPath)
    assertCondition(assertions, 'missing limiter dependency does not fail open', missingRedis.passed, {
        message: missingRedis.message,
    })

    const limiterId = `batch1b-limiter-${Date.now()}`
    const limiterResults = []
    for (let attempt = 0; attempt < 6; attempt += 1) {
        limiterResults.push(await checkAccessCodeRateLimit(limiterId))
    }
    assertCondition(assertions, 'real 5 attempts per 10 minutes limiter blocks sixth attempt', limiterResults.slice(0, 5).every(value => value === null) && typeof limiterResults[5] === 'number', {
        sixthAttemptReset: limiterResults[5],
    })

    const failId = `batch1b-fails-${Date.now()}`
    await resetAccessCodeFailures(failId)
    for (let attempt = 0; attempt < 5; attempt += 1) {
        await recordAccessCodeFailure(failId)
    }
    const lockedOut = await checkAccessCodeLockout(failId)
    assertCondition(assertions, 'repeated invalid attempts create lockout', lockedOut === true)
    await redis.del(`code_fails:${failId}`)
    await redis.del(`lockout:${failId}`)

    const validCode = crypto.randomBytes(3).toString('hex').toUpperCase()
    await setCode(admin, orgId, validCode, new Date(Date.now() + 15 * 60 * 1000).toISOString())
    const firstConsume = await consumeLikeCentralHelper(admin, orgId, validCode)
    const afterFirstConsume = await readAccessCodeState(admin, orgId)
    const reused = await consumeLikeCentralHelper(admin, orgId, validCode)
    assertCondition(assertions, 'valid code works once and clears stored hash/expiry/plaintext', firstConsume.ok && afterFirstConsume.access_code_hash === null && afterFirstConsume.access_code_expires_at === null && afterFirstConsume.last_code_plain === null, {
        firstConsume,
    })
    assertCondition(assertions, 'reused code fails after consume', reused.ok === false && reused.reason === 'missing_hash', {
        reused,
    })

    const expiredCode = crypto.randomBytes(3).toString('hex').toUpperCase()
    await setCode(admin, orgId, expiredCode, new Date(Date.now() - 60 * 1000).toISOString())
    const expired = await consumeLikeCentralHelper(admin, orgId, expiredCode)
    assertCondition(assertions, 'expired code fails', expired.ok === false && expired.reason === 'expired', {
        expired,
    })

    const wrongCode = crypto.randomBytes(3).toString('hex').toUpperCase()
    await setCode(admin, orgId, validCode, new Date(Date.now() + 15 * 60 * 1000).toISOString())
    const wrong = await consumeLikeCentralHelper(admin, orgId, wrongCode)
    assertCondition(assertions, 'wrong code fails', wrong.ok === false && wrong.reason === 'wrong_code', {
        wrong,
    })

    const plaintextWrite = await admin
        .from('organizations')
        .update({ last_code_plain: 'ABC123' })
        .eq('id', orgId)
        .select('id')
        .maybeSingle()
    assertCondition(assertions, 'plaintext access-code storage is blocked by migration guard', Boolean(plaintextWrite.error) && /plaintext storage is disabled/i.test(plaintextWrite.error.message || ''), {
        error: plaintextWrite.error ? {
            message: plaintextWrite.error.message,
            code: plaintextWrite.error.code || null,
        } : null,
    })

    const passed = assertions.every(assertion => assertion.passed)
    console.log(JSON.stringify({
        passed,
        checkedAt: new Date().toISOString(),
        projectRef: new URL(url).hostname.split('.')[0],
        qaLoginOrgId: safeId(loginOrgId),
        disposableOrgId: safeId(disposableOrgId),
        assertions,
    }, null, 2))

    if (!passed) process.exitCode = 1
} finally {
    if (orgId && originalState) {
        await restoreAccessCodeState(admin, orgId, originalState)
    }
    if (disposableOrgId) {
        await admin.from('organizations').delete().eq('id', disposableOrgId)
    }
    await owner.auth.signOut().catch(() => {})
    await supervisor.auth.signOut().catch(() => {})
}
