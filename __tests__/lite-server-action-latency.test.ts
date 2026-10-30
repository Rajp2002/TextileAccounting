import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

function functionBody(source: string, name: string) {
    const start = source.indexOf(`export async function ${name}`)
    expect(start, `${name} not found`).toBeGreaterThanOrEqual(0)
    const next = source.indexOf('\nexport async function ', start + 1)
    return source.slice(start, next === -1 ? undefined : next)
}

describe('Lite server actions', () => {
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')

    it('verifies the owner once for the estimator secondary data', () => {
        const secondary = functionBody(actions, 'getEstimatorSecondaryData')
        // A server action has no request cache, so the getEstimatorTemplates
        // action would run requireRole a second time.
        expect(secondary.match(/requireRole\(/g)).toHaveLength(1)
        expect(secondary).toContain('readEstimatorTemplates(supabase, profile.org_id)')
        expect(secondary).not.toContain('getEstimatorTemplates(')
    })

    it('reads the plan alongside the saved qualities', () => {
        const reader = actions.slice(actions.indexOf('async function readEstimatorTemplates'))
        expect(reader.indexOf('startEarly(getCachedOrgTier(orgId))')).toBeLessThan(reader.indexOf('await query'))
    })

    // Saves used to refresh the router cache only through Proxy's activity
    // cookie, which Proxy no longer writes on every server action.
    it('revalidates Saved Costings after a costing save, replays included', () => {
        const save = functionBody(actions, 'saveEstimatorQuoteV3')
        expect(save.match(/revalidatePath\('\/owner\/quotes'\)/g)).toHaveLength(2)
    })
})
