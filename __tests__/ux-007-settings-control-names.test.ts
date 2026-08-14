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
        expect(component).toContain('<Label htmlFor={resolvedInputId}')
        expect(component).toContain('id={resolvedInputId}')
        expect(component).toContain('type="number"')
    })

    it('gives each optional-section switch an accessible name and a stable disclosure behavior', () => {
        expect(component).toContain('function OptionalAssumptionDisclosure')
        expect(component).toContain('const switchId = useId()')
        expect(component).toContain('id={switchId}')
        expect(component).toContain('aria-label={`${tx(title)} ${tx(\'enabled\')}`}')
        expect(component).toContain('onCheckedChange={onEnabledChange}')
    })
})
