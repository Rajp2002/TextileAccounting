import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('P1 login server action route', () => {
    it('keeps /login dynamic so server-action POSTs are not served by a static route', () => {
        const page = readFileSync(join(root, 'app/(auth)/login/page.tsx'), 'utf8')
        expect(page).toContain("export const dynamic = 'force-dynamic'")
        expect(page).toContain('<LoginForm recoveryDestination={recoveryDestination} />')
    })
})
