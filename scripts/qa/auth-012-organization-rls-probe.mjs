#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const QA_REF = 'eutycrtzzxmlkcpipgod'
const PROD_REF = 'vzhwahudircrpgtitwzd'
const workspace = process.cwd()
const productionMode = process.argv.includes('--production')
const expectedRef = productionMode ? PROD_REF : QA_REF
const envFile = productionMode ? '.env.production.local' : '.env.qa.local'

function parseEnv(contents) {
    return Object.fromEntries(
        contents
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#') && line.includes('='))
            .map((line) => {
                const separator = line.indexOf('=')
                const key = line.slice(0, separator)
                let value = line.slice(separator + 1).trim()
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1)
                }
                return [key, value]
            })
    )
}

function safeId(value) {
    return `${value.slice(0, 8)}...${value.slice(-4)}`
}

const env = {
    ...process.env,
    ...parseEnv(await fs.readFile(path.join(workspace, envFile), 'utf8')),
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url?.includes(expectedRef) || (!productionMode && url.includes(PROD_REF))) {
    throw new Error(`AUTH-012 probe refused: ${envFile} does not target ${expectedRef}.`)
}
if (!anonKey || !serviceKey) throw new Error('AUTH-012 probe requires anon and service-role keys for the selected target.')

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const owner = createClient(url, anonKey, { auth: { persistSession: false } })
const runId = `AUTH012-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
const password = `${crypto.randomBytes(18).toString('base64url')}A1!`
const email = `auth012.${Date.now()}@example.test`
const cleanup = { userId: null, targetUserId: null, actorOrgId: null, targetOrgId: null, targetMachineId: null }

try {
    const createdUser = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (createdUser.error || !createdUser.data.user) throw new Error('AUTH-012 probe could not create the QA auth fixture.')
    cleanup.userId = createdUser.data.user.id

    const createdTargetUser = await admin.auth.admin.createUser({
        email: `auth012.target.${Date.now()}@example.test`,
        password: `${crypto.randomBytes(18).toString('base64url')}A1!`,
        email_confirm: true,
    })
    if (createdTargetUser.error || !createdTargetUser.data.user) {
        throw new Error('AUTH-012 probe could not create the target QA auth fixture.')
    }
    cleanup.targetUserId = createdTargetUser.data.user.id

    const actorOrg = await admin
        .from('organizations')
        .insert({ name: `QA-${runId}-ACTOR`, owner_id: cleanup.userId })
        .select('id')
        .single()
    if (actorOrg.error || !actorOrg.data) throw new Error('AUTH-012 probe could not create the actor QA organization.')
    cleanup.actorOrgId = actorOrg.data.id

    const targetOrg = await admin
        .from('organizations')
        .insert({ name: `QA-${runId}-TARGET`, owner_id: cleanup.targetUserId })
        .select('id')
        .single()
    if (targetOrg.error || !targetOrg.data) throw new Error('AUTH-012 probe could not create the target QA organization.')
    cleanup.targetOrgId = targetOrg.data.id

    const profile = await admin.from('profiles').insert({
        id: cleanup.userId,
        org_id: cleanup.actorOrgId,
        role: 'owner',
        full_name: `QA Owner ${runId}`,
        email,
    })
    if (profile.error) throw new Error('AUTH-012 probe could not create the QA profile fixture.')

    const targetProfile = await admin.from('profiles').insert({
        id: cleanup.targetUserId,
        org_id: cleanup.targetOrgId,
        role: 'owner',
        full_name: `QA Target Owner ${runId}`,
        email: `auth012.target.${Date.now()}@example.test`,
    })
    if (targetProfile.error) throw new Error('AUTH-012 probe could not create the target QA profile fixture.')

    const targetMachine = await admin
        .from('machines')
        .insert({
            org_id: cleanup.targetOrgId,
            name: `QA-${runId}-TARGET-LOOM`,
            loom_type: 'rapier',
            status: 'inactive',
        })
        .select('id')
        .single()
    if (targetMachine.error || !targetMachine.data) {
        throw new Error('AUTH-012 probe could not create the target QA machine fixture.')
    }
    cleanup.targetMachineId = targetMachine.data.id

    const signIn = await owner.auth.signInWithPassword({ email, password })
    if (signIn.error || !signIn.data.user) throw new Error('AUTH-012 probe QA fixture sign-in failed.')

    const ownRead = await owner
        .from('organizations')
        .select('id')
        .eq('id', cleanup.actorOrgId)
        .maybeSingle()
    const crossRead = await owner
        .from('organizations')
        .select('id')
        .eq('id', cleanup.targetOrgId)
        .maybeSingle()

    const ownName = `QA-${runId}-ACTOR-UPDATED`
    const ownUpdate = await owner
        .from('organizations')
        .update({ name: ownName })
        .eq('id', cleanup.actorOrgId)
        .select('id, name')
        .maybeSingle()
    const crossUpdate = await owner
        .from('organizations')
        .update({ name: `QA-${runId}-TARGET-TAMPERED` })
        .eq('id', cleanup.targetOrgId)
        .select('id')
        .maybeSingle()
    const crossProfileRead = await owner
        .from('profiles')
        .select('id')
        .eq('id', cleanup.targetUserId)
        .maybeSingle()
    const crossMachineRead = await owner
        .from('machines')
        .select('id')
        .eq('id', cleanup.targetMachineId)
        .maybeSingle()
    const crossMachineUpdate = await owner
        .from('machines')
        .update({ name: `QA-${runId}-TARGET-LOOM-TAMPERED` })
        .eq('id', cleanup.targetMachineId)
        .select('id')
        .maybeSingle()

    const targetPersistence = await admin
        .from('organizations')
        .select('name')
        .eq('id', cleanup.targetOrgId)
        .single()
    const targetMachinePersistence = await admin
        .from('machines')
        .select('name')
        .eq('id', cleanup.targetMachineId)
        .single()

    const result = {
        testId: 'AUTH-012',
        campaignFixture: runId,
        projectRef: expectedRef,
        capturedAt: new Date().toISOString(),
        actorOrgId: safeId(cleanup.actorOrgId),
        targetOrgId: safeId(cleanup.targetOrgId),
        assertions: {
            ownOrganizationVisible: !ownRead.error && ownRead.data?.id === cleanup.actorOrgId,
            ownOrganizationUpdateAllowed:
                !ownUpdate.error && ownUpdate.data?.id === cleanup.actorOrgId && ownUpdate.data?.name === ownName,
            crossOrganizationHidden: !crossRead.error && crossRead.data === null,
            crossOrganizationUpdateDenied: !crossUpdate.error && crossUpdate.data === null,
            crossProfileHidden: !crossProfileRead.error && crossProfileRead.data === null,
            crossMachineHidden: !crossMachineRead.error && crossMachineRead.data === null,
            crossMachineUpdateDenied: !crossMachineUpdate.error && crossMachineUpdate.data === null,
            crossOrganizationUnchanged:
                !targetPersistence.error && targetPersistence.data?.name === `QA-${runId}-TARGET`,
            crossMachineUnchanged:
                !targetMachinePersistence.error && targetMachinePersistence.data?.name === `QA-${runId}-TARGET-LOOM`,
        },
    }

    if (!Object.values(result.assertions).every(Boolean)) {
        process.stderr.write(`${JSON.stringify(result, null, 2)}\n`)
        process.exitCode = 1
    } else {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    }
} finally {
    await owner.auth.signOut()
    if (cleanup.targetMachineId) await admin.from('machines').delete().eq('id', cleanup.targetMachineId)
    if (cleanup.userId) await admin.from('profiles').delete().eq('id', cleanup.userId)
    if (cleanup.targetUserId) await admin.from('profiles').delete().eq('id', cleanup.targetUserId)
    if (cleanup.targetOrgId) await admin.from('organizations').delete().eq('id', cleanup.targetOrgId)
    if (cleanup.actorOrgId) await admin.from('organizations').delete().eq('id', cleanup.actorOrgId)
    if (cleanup.userId) await admin.auth.admin.deleteUser(cleanup.userId)
    if (cleanup.targetUserId) await admin.auth.admin.deleteUser(cleanup.targetUserId)
}
