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

describe('P1 payroll revert access code validation', () => {
    const actionSource = readProjectFile('app/(dashboard)/owner/payroll/actions.ts')
    const action = functionBody(actionSource, 'toggleWorkerPaid')

    it('requires access code for unsettling payroll in server action', () => {
        expect(action).toContain("validateAndConsumeAccessCode")
        expect(action).toContain("currentPaid")
        expect(action).toContain("accessCode")
    })

    const pageSource = readProjectFile('app/(dashboard)/owner/payroll/page.tsx')

    it('passes access code to mutation in page.tsx', () => {
        expect(pageSource).toContain("mutation.mutate")
        expect(pageSource).toContain("accessCode: accessCode")
    })

    it('removed client-side last_code_plain comparison from page.tsx', () => {
        expect(pageSource).not.toContain("org?.last_code_plain")
    })
})
