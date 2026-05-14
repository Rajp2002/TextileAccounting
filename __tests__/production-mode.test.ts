import { describe, expect, it } from 'vitest'
import { getWorkflowVisibility, hasExplicitProductionMode, normalizeProductionMode } from '../lib/production-mode'

describe('production mode workflow visibility', () => {
    it('defaults missing or invalid production modes to market_run', () => {
        expect(normalizeProductionMode(null)).toBe('market_run')
        expect(normalizeProductionMode('unknown')).toBe('market_run')
    })

    it('keeps explicit-mode detection separate from app fallback normalization', () => {
        expect(hasExplicitProductionMode(null)).toBe(false)
        expect(hasExplicitProductionMode('unknown')).toBe(false)
        expect(hasExplicitProductionMode('market_run')).toBe(true)
        expect(normalizeProductionMode(null)).toBe('market_run')
    })

    it('hides order-first workflows for market run factories', () => {
        const visibility = getWorkflowVisibility('market_run')

        expect(visibility.estimator).toBe(false)
        expect(visibility.quotes).toBe(false)
        expect(visibility.orders).toBe(false)
        expect(visibility.marketRuns).toBe(true)
        expect(visibility.stock).toBe(true)
        expect(visibility.dispatches).toBe(true)
    })

    it('shows order workflows without market runs for order-based factories', () => {
        const visibility = getWorkflowVisibility('order_based')

        expect(visibility.estimator).toBe(true)
        expect(visibility.quotes).toBe(true)
        expect(visibility.orders).toBe(true)
        expect(visibility.marketRuns).toBe(false)
    })

    it('shows all primary workflows for mixed-mode factories', () => {
        const visibility = getWorkflowVisibility('both')

        expect(visibility.estimator).toBe(true)
        expect(visibility.quotes).toBe(true)
        expect(visibility.orders).toBe(true)
        expect(visibility.marketRuns).toBe(true)
        expect(visibility.stock).toBe(true)
    })
})
