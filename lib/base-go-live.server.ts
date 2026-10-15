import 'server-only'
import { goLiveOptions, goLivePhase, type BaseGoLivePhase } from './base-go-live'
import { validateCycleRule, type PayrollCycleRule } from './payroll-cycle-engine'
import { createAdminClient } from './supabase/admin'
import { getSuratTodayString } from './time'

export type BaseGoLiveState = { goLive: string | null; phase: BaseGoLivePhase; options: string[] }

async function readGoLive(orgId: string): Promise<{ goLive: string | null; rule: PayrollCycleRule | null }> {
    const admin = createAdminClient()
    const [org, cycle] = await Promise.all([
        admin.from('organizations').select('base_go_live_date').eq('id', orgId).maybeSingle(),
        admin.from('base_payroll_cycle_configs').select('rule').eq('org_id', orgId).is('effective_until', null).maybeSingle(),
    ])
    if (org.error) throw new Error(`Go-live could not be read: ${org.error.message}`)
    const rule = cycle.data ? validateCycleRule(cycle.data.rule).normalizedRule ?? null : null
    return { goLive: (org.data?.base_go_live_date as string | null | undefined) ?? null, rule }
}

/** orgId must come from the verified profile. Options are the cycle starts an owner may choose while not live. */
export async function getBaseGoLiveState(orgId: string): Promise<BaseGoLiveState> {
    const today = getSuratTodayString()
    const { goLive, rule } = await readGoLive(orgId)
    const phase = goLivePhase(today, goLive)
    return { goLive, phase, options: phase === 'live' || !rule ? [] : goLiveOptions(today, rule) }
}

/**
 * Sets or moves go-live to one of the offered cycle starts. The caller has checked the owner and the plan;
 * the RPC (service role only) re-checks the date, that go-live has not passed and that nothing is recorded.
 */
export async function scheduleBaseGoLiveForOrg(orgId: string, actorId: string, goLive: string): Promise<{ goLive: string } | { error: string }> {
    const { rule } = await readGoLive(orgId)
    if (!rule) return { error: 'Set up your pay cycle first.' }
    if (!goLiveOptions(getSuratTodayString(), rule).includes(goLive)) return { error: 'Choose one of the listed start dates.' }
    const { data, error } = await createAdminClient().rpc('schedule_base_go_live', { p_org_id: orgId, p_go_live: goLive, p_actor: actorId })
    if (error) {
        console.error('[base-go-live] schedule_base_go_live failed:', error.message)
        if (error.code === '55000' || error.code === '22023') return { error: error.message }
        return { error: 'The start date could not be saved. Please try again.' }
    }
    return { goLive: String(data) }
}
