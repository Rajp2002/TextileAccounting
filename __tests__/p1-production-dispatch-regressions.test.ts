import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 production and dispatch regressions', () => {
    it('surfaces structured production validation messages to supervisors', () => {
        const page = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
        expect(page).toContain('res?.message || res?.error')
        expect(page).toContain('toast.error(error.message')
        expect(page).not.toContain("toast.error('Could not save production log. Your entry is still saved as a draft. Check your connection and try again.')")
    })

    it('returns public dispatch links under /track/[token]', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        expect(action).toContain('`/track/${dispatchMeta.tracking_token}`')
        expect(action).not.toContain('/tracking/${dispatchMeta.tracking_token}')
    })

    it('keeps dispatches page usable when stock discrepancy migration is pending', () => {
        const action = readProjectFile('app/(dashboard)/owner/orders/actions.ts')
        expect(action).toContain('isMissingStockDiscrepanciesTable')
        expect(action).toContain("error?.code === '42P01'")
        expect(action).toContain("error?.code === 'PGRST205'")
        expect(action).toContain('const discrepancies = discrepanciesRes.error ? []')
    })
})
