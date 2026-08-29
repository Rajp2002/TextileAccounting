import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'components/onboarding/contextual-machine-dialog.tsx'), 'utf8')

describe('SETUP-007 onboarding network retryability', () => {
    it('restores the contextual loom form after a rejected save request', () => {
        expect(source).toContain('try {')
        expect(source).toContain('await addMachine(')
        expect(source).toContain('toast.error(error instanceof Error ? error.message')
        expect(source).toContain('finally {')
        expect(source).toContain('setSaving(false)')
        expect(source.indexOf('finally {')).toBeLessThan(source.lastIndexOf('setSaving(false)'))
    })
})
