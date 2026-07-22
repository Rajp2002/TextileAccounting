#!/usr/bin/env node

import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const PRODUCTION_REF = 'vzhwahudircrpgtitwzd'
const ENV_PATH = '.env.production.local'
const FIXTURE_PATH = '/Users/rajpatel/.codex/secrets/weavly-base-estimator-pilot.json'

function parseEnv(contents) {
    return Object.fromEntries(contents.split(/\r?\n/).flatMap(raw => {
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

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

async function requireData(result, label) {
    if (result.error) throw new Error(`${label}: ${result.error.message}`)
    return result.data
}

const env = { ...process.env, ...parseEnv(await fs.readFile(ENV_PATH, 'utf8')) }
const fixture = JSON.parse(await fs.readFile(FIXTURE_PATH, 'utf8'))
assert(env.NEXT_PUBLIC_SUPABASE_URL?.includes(PRODUCTION_REF), 'Atomic proof refused: production target not proven.')
assert(fixture.projectRef === PRODUCTION_REF && String(fixture.runId).startsWith('BASEGO-'), 'Atomic proof refused: fixture identity is not exact.')
assert(env.SUPABASE_SERVICE_ROLE_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Atomic proof requires production Supabase credentials.')

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
})
const owner = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
})
await requireData(await owner.auth.signInWithPassword({ email: fixture.email, password: fixture.password }), 'Sign in fixture owner')

const existingProfile = await admin.from('factory_cost_profile').select('*').eq('factory_id', fixture.orgId).maybeSingle()
if (existingProfile.error) throw new Error(`Load configured profile: ${existingProfile.error.message}`)
if (!existingProfile.data) {
    await requireData(await admin.from('factory_cost_profile').insert({
        factory_id: fixture.orgId,
        default_processing_rate_per_m: 3.5,
        default_finishing_rate_per_m: 1.25,
        default_commission_pct: 2.5,
        default_transport_per_m: 0.75,
        enabled_sections: { winding: false, processing: true, finishing: true, commission: true, transport: true },
        is_configured: true,
    }), 'Create configured profile for atomic proof')
}
const profile = await requireData(await admin.from('factory_cost_profile').select('*').eq('factory_id', fixture.orgId).single(), 'Reload configured profile')
const yarnName = `${fixture.runId} Atomic Warp`
const rateValue = 321.25
const historyBefore = await admin.from('cost_rate_history').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId)
if (historyBefore.error) throw new Error(`Count history before rollback: ${historyBefore.error.message}`)

await requireData(await admin.from('factory_cost_profile').delete().eq('factory_id', fixture.orgId), 'Temporarily remove profile')
const failedAttempt = await owner.rpc('save_cost_rate_atomic', {
    p_rate_id: null,
    p_name: yarnName,
    p_category: 'yarn_warp',
    p_unit: 'per_kg',
    p_current_value: rateValue,
    p_effective_date: new Date().toISOString().slice(0, 10),
    p_last_reviewed_at: new Date().toISOString().slice(0, 10),
    p_review_interval_days: 90,
    p_source: 'Atomic production proof',
    p_notes: 'Expected rollback while profile is absent',
    p_apply_as_default: true,
})
assert(failedAttempt.error, 'The induced default-update failure unexpectedly succeeded.')

const [rolledBackRates, historyAfterFailure] = await Promise.all([
    admin.from('cost_rate_book').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId).eq('name', yarnName),
    admin.from('cost_rate_history').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId),
])
if (rolledBackRates.error || historyAfterFailure.error) throw new Error('Unable to reconcile the induced rollback.')
assert(rolledBackRates.count === 0, 'The failed transaction left a rate-book row behind.')
assert(historyAfterFailure.count === historyBefore.count, 'The failed transaction left a history row behind.')

await requireData(await admin.from('factory_cost_profile').insert(profile), 'Restore configured profile')
const template = await requireData(await admin.from('estimator_templates').insert({
    org_id: fixture.orgId,
    name: `${fixture.runId} Atomic Quality`,
    default_yarn_rate: 100,
    warp_rows: [{ id: 'atomic-warp', label: yarnName, yarnRate: 100 }],
    weft_rows: [],
    is_active: true,
}).select('id').single(), 'Create matching saved quality')

const successfulAttempt = await owner.rpc('save_cost_rate_atomic', {
    p_rate_id: null,
    p_name: yarnName,
    p_category: 'yarn_warp',
    p_unit: 'per_kg',
    p_current_value: rateValue,
    p_effective_date: new Date().toISOString().slice(0, 10),
    p_last_reviewed_at: new Date().toISOString().slice(0, 10),
    p_review_interval_days: 90,
    p_source: 'Atomic production proof',
    p_notes: 'Rate, history, default, and quality must commit together',
    p_apply_as_default: true,
})
if (successfulAttempt.error) throw new Error(`Atomic success path: ${successfulAttempt.error.message}`)

const [rate, history, restoredProfile, savedQuality] = await Promise.all([
    admin.from('cost_rate_book').select('id, current_value').eq('org_id', fixture.orgId).eq('name', yarnName).single(),
    admin.from('cost_rate_history').select('id, value').eq('org_id', fixture.orgId).eq('rate_id', successfulAttempt.data.rate.id),
    admin.from('factory_cost_profile').select('default_warp_yarn_name, default_warp_yarn_rate_per_kg').eq('factory_id', fixture.orgId).single(),
    admin.from('estimator_templates').select('warp_rows').eq('id', template.id).single(),
])
if (rate.error || history.error || restoredProfile.error || savedQuality.error) throw new Error('Unable to reconcile the atomic success path.')
assert(Number(rate.data.current_value) === rateValue, 'Rate-book value does not match.')
assert(history.data.length === 1 && Number(history.data[0].value) === rateValue, 'History value does not match.')
assert(restoredProfile.data.default_warp_yarn_name === yarnName && Number(restoredProfile.data.default_warp_yarn_rate_per_kg) === rateValue, 'Factory default does not match.')
assert(Number(savedQuality.data.warp_rows[0].yarnRate) === rateValue, 'Saved-quality yarn rate does not match.')
assert(Number(successfulAttempt.data.synced_quality_count) === 1, 'Atomic RPC did not report the matching saved quality.')

process.stdout.write(`${JSON.stringify({
    runId: fixture.runId,
    projectRef: PRODUCTION_REF,
    rollback: { rateRows: rolledBackRates.count, historyDelta: historyAfterFailure.count - historyBefore.count },
    commit: { rate: rateValue, historyRows: history.data.length, profileDefault: rateValue, savedQualities: successfulAttempt.data.synced_quality_count },
})}\n`)
