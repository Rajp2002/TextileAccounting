import { describe, expect, it } from 'vitest'
import { getEstimatorWorkflowConfig, getOrganizationProductionMode, getWorkflowVisibility, hasExplicitProductionMode, normalizeProductionMode } from '../lib/production-mode'

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

    it('keeps estimator available while hiding order-first workflows for market run factories', () => {
        const visibility = getWorkflowVisibility('market_run')

        expect(visibility.estimator).toBe(true)
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

    it('forces the estimator into market mode for market-run-only factories', () => {
        expect(getEstimatorWorkflowConfig('market_run', 'quote')).toEqual({
            initialMode: 'market',
            allowsPartyOrders: false,
            allowsMarketRuns: true,
        })
    })

    it('forces the estimator into quote mode for order-based-only factories', () => {
        expect(getEstimatorWorkflowConfig('order_based', 'market')).toEqual({
            initialMode: 'quote',
            allowsPartyOrders: true,
            allowsMarketRuns: false,
        })
    })

    it('honours the requested estimator workflow when both are enabled', () => {
        expect(getEstimatorWorkflowConfig('both', 'market')).toEqual({
            initialMode: 'market',
            allowsPartyOrders: true,
            allowsMarketRuns: true,
        })
        expect(getEstimatorWorkflowConfig('both', 'quote').initialMode).toBe('quote')
    })

    it('defaults organization production mode when older databases lack the column', async () => {
        const client = {
            from: () => ({
                select: () => ({
                    eq: () => ({
                        maybeSingle: async () => ({
                            data: null,
                            error: {
                                code: '42703',
                                message: 'column organizations.production_mode does not exist',
                            },
                        }),
                    }),
                }),
            }),
        }

        await expect(getOrganizationProductionMode(client, 'org-1')).resolves.toEqual({
            productionMode: 'market_run',
            error: null,
        })
    })
})
