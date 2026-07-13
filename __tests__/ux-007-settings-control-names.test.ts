import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const component = fs.readFileSync(
    path.join(process.cwd(), 'components/settings/factory-cost-profile.tsx'),
    'utf8'
)

describe('UX-007 Factory Cost Profile accessible names', () => {
    it('associates each rate label with its number input', () => {
        expect(component).toContain('const inputId = useId()')
        expect(component).toContain('<Label htmlFor={inputId}')
        expect(component).toContain('id={inputId}')
        expect(component).toContain('type="number"')
    })

    it('associates each optional-section label and description with its switch', () => {
        expect(component).toContain('const switchId = useId()')
        expect(component).toContain('<Label htmlFor={switchId}')
        expect(component).toContain('id={switchId}')
        expect(component).toContain('aria-describedby={descriptionId}')
    })
})
