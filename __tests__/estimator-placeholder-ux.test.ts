import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatEstimatorPlaceholder } from '../lib/estimator-placeholder'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Estimator placeholder clarity', () => {
    it('marks example values without changing an already-prefixed example', () => {
        expect(formatEstimatorPlaceholder(75)).toBe('e.g. 75')
        expect(formatEstimatorPlaceholder('Warp 1')).toBe('e.g. Warp 1')
        expect(formatEstimatorPlaceholder('e.g. 3200')).toBe('e.g. 3200')
    })

    it('keeps applied defaults as plain saffron values', () => {
        expect(formatEstimatorPlaceholder(10, 'applied-default')).toBe('10')
        expect(formatEstimatorPlaceholder('0', 'applied-default')).toBe('0')
    })

    it('uses ghost names in both costing entry modes and emphasizes applied waste', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

        expect(estimator).toContain('ghostValue={`Warp ${index + 1}`}')
        expect(estimator).toContain('ghostValue={`Weft ${index + 1}`}')
        expect(estimator).toContain('const displayPlaceholder = formatEstimatorPlaceholder(ghostText)')
        expect(estimator).toContain('placeholderKind="applied-default"')
        expect(estimator).toContain('placeholder="e.g. 5000"')
    })

    it('shows real component count and selects it on focus instead of ghosting 1', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

        expect(estimator).toContain('const DEFAULT_YARN_COMPONENT_COUNT = 1')
        expect(estimator).not.toContain('const isGhostValue = value === DEFAULT_YARN_COMPONENT_COUNT')
        expect(estimator).toContain('value={draftValue}')
        expect(estimator).toContain('placeholder={String(DEFAULT_YARN_COMPONENT_COUNT)}')
        expect(estimator).toContain('onPointerDown={event => {')
        expect(estimator).toContain('event.preventDefault()')
    })

    it('applies saffron emphasis to user inputted component count values', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

        expect(estimator).toContain('data-testid={`${accent}-component-count`}')
        expect(estimator).toContain('text-[var(--color-yarn-orange)] shadow-[0_1px_2px_rgba(30,37,40,0.035)] transition-all placeholder:text-[var(--color-placeholder)] placeholder:font-normal')
    })

    it('preserves zero in Warp Crimp instead of ghosting 0 into e.g. 0', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

        // Quick Costing NumField for warpCrimpPct:
        // Must preserve zero and never ghost DEFAULT_WARP_CRIMP_PCT (0)
        expect(estimator).toContain('fieldKey="warpCrimpPct"')
        expect(estimator).not.toMatch(/fieldKey="warpCrimpPct"[\s\S]*?ghostValue=\{DEFAULT_WARP_CRIMP_PCT\}/)
        expect(estimator).toMatch(/fieldKey="warpCrimpPct"[\s\S]*?preserveZero/)

        // Detailed Costing StepperField for Warp Crimp:
        // Must not ghost DEFAULT_WARP_CRIMP_PCT (0) into e.g. 0
        expect(estimator).toContain('label="Warp Crimp (Take-up)"')
        expect(estimator).not.toMatch(/label="Warp Crimp \(Take-up\)"[\s\S]*?ghostValue=\{DEFAULT_WARP_CRIMP_PCT\}/)
        expect(estimator).not.toMatch(/label="Warp Crimp \(Take-up\)"[\s\S]*?ghostPlaceholder=\{String\(DEFAULT_WARP_CRIMP_PCT\)\}/)

        // NumField and StepperField inputs select on focus/pointerDown so typing replaces 0 instead of appending
        expect(estimator).toContain('setDraftText(raw)')
        expect(estimator).toContain('className={`h-full w-16 rounded-none border-0 bg-white p-0 text-center font-mono text-sm font-semibold ${valueClass}')
    })

    it('ensures input values are styled in saffron and placeholders/ghost values are styled in grey', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

        // NumField: input value is saffron, placeholder is grey
        expect(estimator).toContain('function NumField(')
        expect(estimator).toContain("const placeholderClass = 'placeholder:text-[var(--color-placeholder)] placeholder:font-normal'")
        expect(estimator).not.toContain("? 'placeholder:text-[var(--color-yarn-orange)]'")

        // StepperField: input value is saffron, placeholder is grey
        expect(estimator).toContain('function StepperField(')
        expect(estimator).toContain("const valueClass = 'text-[var(--color-yarn-orange)]'")

        // ComponentCountField: input is saffron, placeholder is grey
        expect(estimator).toContain('function ComponentCountField(')
        expect(estimator).toContain('text-[var(--color-yarn-orange)]')
        expect(estimator).toContain('placeholder:text-[var(--color-placeholder)]')
        expect(estimator).not.toContain('placeholder:text-[var(--color-muted)]')
    })

    it('ensures component count and stepper field labels adhere to standard text-[var(--color-muted)]', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

        // Labels must adhere to product standard color and not use accent-colored text
        expect(estimator).toContain('<Label htmlFor={inputId} className="flex h-8 items-end text-[11px] font-semibold uppercase leading-tight tracking-[0.05em] text-[var(--color-muted)]">')
        expect(estimator).toContain('<Label className="block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">')
        expect(estimator).not.toContain('${accentStyles.text}')
    })
})

