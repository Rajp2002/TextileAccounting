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

describe('P1 payroll settlement correction guard', () => {
    const action = functionBody(
        readProjectFile('app/(dashboard)/supervisor/actions.ts'),
        'bulkLogProduction'
    )

    it('blocks production corrections affecting settled payroll', () => {
        expect(action).toContain("from('payroll_settlements')")
        expect(action).toContain("eq('status', 'paid')")
        expect(action).toContain('PAYROLL_ALREADY_SETTLED')
    })
})
