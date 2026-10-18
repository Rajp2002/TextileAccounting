import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')
function functionBody(source: string, name: string) {
    const start = source.indexOf(`export async function ${name}(`)
    expect(start, `${name} exists`).toBeGreaterThan(-1)
    const next = source.indexOf('\nexport ', start + 1)
    return source.slice(start, next === -1 ? undefined : next)
}

describe('Base go-live scheduling', () => {
    const server = read('lib/base-go-live.server.ts')
    const onboarding = read('app/(auth)/onboarding/base/actions.ts')
    const production = read('app/(dashboard)/owner/production/actions.ts')

    it('schedules through the service-role RPC from a server-only module', () => {
        expect(server.startsWith("import 'server-only'")).toBe(true)
        expect(server).toContain("rpc('schedule_base_go_live'")
        expect(server).toContain('goLiveOptions(')
    })
    it('schedules the next cycle start when the setup wizard completes', () => {
        const body = functionBody(onboarding, 'completeBaseOnboardingAction')
        expect(body).toContain('scheduleBaseGoLiveForOrg(')
        // options[0] is nextGoLiveDate(today, rule) (lib/base-go-live.ts goLiveOptions).
        expect(body).toContain("phase === 'unscheduled' && goLive.options[0]")
    })
    it('reschedules go-live when the pay cycle changes during setup', () => {
        const body = functionBody(production, 'saveBasePayrollCycleConfig')
        expect(body).toContain('getBaseGoLiveState(')
        expect(body).toContain("phase === 'setup'")
        expect(body).toContain('scheduleBaseGoLiveForOrg(')
        expect(body).toContain('nextGoLiveDate(')
        // A cycle saved during setup replaces the current one at go-live, never closing it for a later start.
        expect(body).toContain('const effectiveDate = inSetup ? goLive.goLive! :')
    })
    it('lets only a writable Base owner schedule', () => {
        const body = functionBody(production, 'scheduleBaseGoLiveAction')
        expect(body).toContain('requireBaseProductionOwner()')
        expect(body).toContain('scheduleBaseGoLiveForOrg(')
    })
})
