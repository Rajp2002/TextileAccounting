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
})
