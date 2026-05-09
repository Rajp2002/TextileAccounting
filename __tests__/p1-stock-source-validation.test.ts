import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function functionBody(source: string, name: string) {
    const start = source.indexOf(`export async function ${name}`)
    expect(start).toBeGreaterThanOrEqual(0)

    const next = source.indexOf('\nexport async function ', start + 1)
    return source.slice(start, next === -1 ? source.length : next)
}

describe('P1 stock source validation guard', () => {
    const action = functionBody(
        readProjectFile('app/(dashboard)/owner/stock/actions.ts'),
        'createTakaStockLot'
    )

    it('checks order ownership by org_id', () => {
        expect(action).toContain(".from('orders')")
        expect(action).toContain(".eq('org_id', profile.org_id)")
    })

    it('checks quote ownership by org_id', () => {
        expect(action).toContain(".from('estimator_quotes')")
        expect(action).toContain(".eq('org_id', profile.org_id)")
    })

    it('checks market_run ownership by org_id', () => {
        expect(action).toContain(".from('market_run_summary')")
        expect(action).toContain(".eq('org_id', profile.org_id)")
    })

    it('rejects mismatched quote/order references', () => {
        expect(action).toContain('quote.order_id !== orderId')
        expect(action).toContain('Mismatched quote and order')
    })

    it('rejects source IDs that do not match the declared stock source type', () => {
        expect(action).toContain("sourceType !== 'market_run' && marketRunId")
        expect(action).toContain("sourceType !== 'order' && (quoteId || orderId)")
    })
})
