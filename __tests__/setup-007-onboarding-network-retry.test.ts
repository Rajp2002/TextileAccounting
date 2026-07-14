import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/(auth)/onboarding/checklist.tsx'), 'utf8')

describe('SETUP-007 onboarding network retryability', () => {
    it('restores the machine form after a rejected save request', () => {
        const machineForm = source.slice(
            source.indexOf('function MachineForm'),
            source.indexOf('// ─── Worker Form')
        )

        expect(machineForm).toContain('try {')
        expect(machineForm).toContain('await addMachinesBulk(machinesToAdd)')
        expect(machineForm).toContain("toast.error('Unable to save machines. Check your connection and try again.')")
        expect(machineForm).toContain('finally {')
        expect(machineForm).toContain('setSaving(false)')
        expect(machineForm.indexOf('finally {')).toBeLessThan(machineForm.lastIndexOf('setSaving(false)'))
    })
})
