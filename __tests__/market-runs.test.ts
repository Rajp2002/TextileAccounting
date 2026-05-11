import { describe, it, expect } from 'vitest'
import { getMarketRunDisplayStatus } from '../lib/market-runs'

describe('getMarketRunDisplayStatus', () => {
    it('should return "closed" if storedStatus is closed regardless of quantities', () => {
        expect(getMarketRunDisplayStatus({
            storedStatus: 'closed',
            producedQuantity: 100,
            availableQuantity: 0,
            soldQuantity: 100
        })).toBe('closed')

        expect(getMarketRunDisplayStatus({
            storedStatus: 'closed',
            producedQuantity: 100,
            availableQuantity: 50,
            soldQuantity: 50
        })).toBe('closed')
    })

    it('should return "production" if no stock has been produced or sold', () => {
        expect(getMarketRunDisplayStatus({
            storedStatus: 'production',
            producedQuantity: 0,
            availableQuantity: 0,
            soldQuantity: 0
        })).toBe('production')
    })

    it('should return "production" if produced > 0 but available is 0 and sold is 0 (not in godown yet)', () => {
        expect(getMarketRunDisplayStatus({
            storedStatus: 'production',
            producedQuantity: 100,
            availableQuantity: 0,
            soldQuantity: 0
        })).toBe('production')
    })

    it('should return "in_godown" if available > 0 and sold <= 0', () => {
        expect(getMarketRunDisplayStatus({
            storedStatus: 'production',
            producedQuantity: 100,
            availableQuantity: 100,
            soldQuantity: 0
        })).toBe('in_godown')
    })

    it('should return "partially_sold" if available > 0 and sold > 0', () => {
        expect(getMarketRunDisplayStatus({
            storedStatus: 'production',
            producedQuantity: 100,
            availableQuantity: 50,
            soldQuantity: 50
        })).toBe('partially_sold')
    })

    it('should return "sold_out" if produced > 0, available <= 0, and sold > 0', () => {
        expect(getMarketRunDisplayStatus({
            storedStatus: 'production',
            producedQuantity: 100,
            availableQuantity: 0,
            soldQuantity: 100
        })).toBe('sold_out')

        expect(getMarketRunDisplayStatus({
            storedStatus: 'production',
            producedQuantity: 100,
            availableQuantity: -1, // edge case
            soldQuantity: 101
        })).toBe('sold_out')
    })

    it('should handle numeric string inputs correctly', () => {
        expect(getMarketRunDisplayStatus({
            storedStatus: 'production',
            producedQuantity: '100',
            availableQuantity: '0',
            soldQuantity: '100'
        })).toBe('sold_out')

        expect(getMarketRunDisplayStatus({
            storedStatus: 'production',
            producedQuantity: '100',
            availableQuantity: '50',
            soldQuantity: '50'
        })).toBe('partially_sold')
    })
})
