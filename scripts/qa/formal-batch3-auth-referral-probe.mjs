#!/usr/bin/env node
import fs from 'node:fs/promises'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'

const QA_REF = 'eutycrtzzxmlkcpipgod'
const baseUrl = 'http://localhost:3000'
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
const fixture = JSON.parse(await fs.readFile(secretPath, 'utf8'))
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url?.includes(QA_REF)) throw new Error('Batch 3 probe refused: isolated QA target not proven.')
if (!anonKey || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Batch 3 probe requires QA Supabase keys.')

const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
})

function createCookieSession() {
    const jar = new Map()
    const client = createServerClient(url, anonKey, {
        cookies: {
            getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
            setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
        },
        auth: { autoRefreshToken: false, persistSession: true },
    })
    return { client, jar }
}

async function signIn(credentials) {
    const session = createCookieSession()
    const result = await session.client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
    })
    if (result.error || !result.data.session) throw new Error(`QA sign-in failed: ${result.error?.message ?? 'missing session'}`)
    return { ...session, accessToken: result.data.session.access_token }
}

async function api(session, path, options = {}) {
    return fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            Cookie: [...session.jar.entries()].map(([name, value]) => `${name}=${value}`).join('; '),
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        redirect: 'manual',
    })
}

async function billProof() {
    const premium = await signIn(fixture.premium.owner)
    const base = await signIn(fixture.base.owner)

    const codeResponse = await api(premium, '/api/referrals/generate')
    if (!codeResponse.ok) throw new Error(`Referral-code generation failed: HTTP ${codeResponse.status}`)
    const codePayload = await codeResponse.json()
    if (typeof codePayload.code !== 'string' || codePayload.code.length < 8) throw new Error('Referral code was not generated.')

    const validResponse = await api(base, '/api/referrals/apply', {
        method: 'POST',
        body: JSON.stringify({ referralCode: codePayload.code }),
    })
    const selfResponse = await api(premium, '/api/referrals/apply', {
        method: 'POST',
        body: JSON.stringify({ referralCode: codePayload.code }),
    })
    const duplicateResponse = await api(base, '/api/referrals/apply', {
        method: 'POST',
        body: JSON.stringify({ referralCode: codePayload.code }),
    })

    const codeRow = await admin.from('referral_codes').select('id').eq('org_id', fixture.premium.orgId).single()
    if (codeRow.error) throw new Error(`Referral-code reconciliation failed: ${codeRow.error.message}`)
    const uses = await admin.from('referral_uses').select('referee_org_id').eq('referral_code_id', codeRow.data.id)
    if (uses.error) throw new Error(`Referral-use reconciliation failed: ${uses.error.message}`)

    const baseUses = uses.data.filter((row) => row.referee_org_id === fixture.base.orgId).length
    const selfUses = uses.data.filter((row) => row.referee_org_id === fixture.premium.orgId).length
    if (!validResponse.ok || selfResponse.ok || duplicateResponse.ok || baseUses !== 1 || selfUses !== 0 || uses.data.length !== 1) {
        throw new Error('Referral relationship invariant failed.')
    }

    process.stdout.write(`${JSON.stringify({
        testId: 'BILL-008',
        validStatus: validResponse.status,
        selfRejected: !selfResponse.ok,
        duplicateRejected: !duplicateResponse.ok,
        exactRelationshipCount: uses.data.length,
        baseRelationshipCount: baseUses,
        selfRelationshipCount: selfUses,
        codeValueEmitted: false,
    })}\n`)
}

async function authProof() {
    const sessionA = await signIn(fixture.base.owner)
    const sessionB = await signIn(fixture.base.owner)
    const beforeA = await api(sessionA, '/api/referrals/generate')
    const beforeB = await api(sessionB, '/api/referrals/generate')
    if (!beforeA.ok || !beforeB.ok) throw new Error('Independent pre-revocation sessions were not authorized.')

    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
        throw new Error('AUTH-015 requires the configured QA Redis revocation store.')
    }
    const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
    const revocationKey = `revoked:${fixture.base.owner.userId}`
    await redis.setex(revocationKey, 3600, '1')

    const jwtStillValidA = !(await sessionA.client.auth.getUser(sessionA.accessToken)).error
    const jwtStillValidB = !(await sessionB.client.auth.getUser(sessionB.accessToken)).error
    const afterA = await api(sessionA, '/api/referrals/generate')
    const afterB = await api(sessionB, '/api/referrals/generate')

    if (!jwtStillValidA || !jwtStillValidB || afterA.ok || afterB.ok) {
        throw new Error('Global application-session revocation invariant failed.')
    }

    process.stdout.write(`${JSON.stringify({
        testId: 'AUTH-015',
        independentSessions: 2,
        beforeStatuses: [beforeA.status, beforeB.status],
        underlyingJwtStillValid: jwtStillValidA && jwtStillValidB,
        bothApplicationSessionsDenied: !afterA.ok && !afterB.ok,
        afterStatuses: [afterA.status, afterB.status],
        revocationTtlSeconds: await redis.ttl(revocationKey),
    })}\n`)
}

async function cleanup() {
    const orgIds = [fixture.premium.orgId, fixture.base.orgId]
    const codeRows = await admin.from('referral_codes').select('id').in('org_id', orgIds)
    if (codeRows.error) throw new Error(`Referral cleanup lookup failed: ${codeRows.error.message}`)
    const codeIds = codeRows.data.map((row) => row.id)
    if (codeIds.length > 0) {
        const useDelete = await admin.from('referral_uses').delete().in('referral_code_id', codeIds)
        if (useDelete.error) throw new Error(`Referral-use cleanup failed: ${useDelete.error.message}`)
        const codeDelete = await admin.from('referral_codes').delete().in('id', codeIds)
        if (codeDelete.error) throw new Error(`Referral-code cleanup failed: ${codeDelete.error.message}`)
    }

    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
        const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
        await redis.del(`revoked:${fixture.base.owner.userId}`)
    }

    const remainingCodes = await admin.from('referral_codes').select('id', { count: 'exact', head: true }).in('org_id', orgIds)
    const remainingUses = codeIds.length > 0
        ? await admin.from('referral_uses').select('id', { count: 'exact', head: true }).in('referral_code_id', codeIds)
        : { count: 0, error: null }
    if (remainingCodes.error || remainingUses.error || remainingCodes.count !== 0 || remainingUses.count !== 0) {
        throw new Error(`Referral cleanup reconciliation failed: codes=${remainingCodes.count}, uses=${remainingUses.count}`)
    }
    process.stdout.write(`${JSON.stringify({ referralCodes: 0, referralUses: 0, revocationMarkerRemoved: true })}\n`)
}

const command = process.argv[2]
if (command === 'bill') await billProof()
else if (command === 'auth') await authProof()
else if (command === 'cleanup') await cleanup()
else throw new Error('Usage: formal-batch3-auth-referral-probe.mjs bill|auth|cleanup')
