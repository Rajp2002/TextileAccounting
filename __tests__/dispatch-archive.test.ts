import { describe, expect, it } from 'vitest'
import { isDispatchGroupActionable, shouldArchiveDispatchGroup } from '../lib/dispatch/archive'

const completedGroup = {
    pendingDispatchMeters: 0,
    totalSaleMeters: 400,
    totalDispatchedMeters: 400,
    hasUnconfirmedReceipt: false,
    hasDisputedDispatch: false,
    hasOpenDiscrepancy: false,
    hasEwayGap: false,
}

describe('dispatch archive eligibility', () => {
    it('archives a fully dispatched and confirmed group', () => {
        expect(shouldArchiveDispatchGroup(completedGroup)).toBe(true)
        expect(isDispatchGroupActionable(completedGroup)).toBe(false)
    })

    it('keeps a partially dispatched sale active', () => {
        expect(shouldArchiveDispatchGroup({
            ...completedGroup,
            pendingDispatchMeters: 200,
            totalDispatchedMeters: 200,
        })).toBe(false)
    })

    it('keeps a partially dispatched order active even without stock-sale pending meters', () => {
        expect(shouldArchiveDispatchGroup({
            ...completedGroup,
            pendingDispatchMeters: 0,
            totalDispatchedMeters: 200,
        })).toBe(false)
    })

    it('keeps over-dispatched groups active for reconciliation instead of hiding the mismatch', () => {
        expect(shouldArchiveDispatchGroup({
            ...completedGroup,
            totalDispatchedMeters: 420,
        })).toBe(false)
    })

    it('keeps unconfirmed receipts active', () => {
        expect(shouldArchiveDispatchGroup({
            ...completedGroup,
            hasUnconfirmedReceipt: true,
        })).toBe(false)
    })

    it('keeps disputed or discrepancy groups active', () => {
        expect(shouldArchiveDispatchGroup({
            ...completedGroup,
            hasDisputedDispatch: true,
        })).toBe(false)

        expect(shouldArchiveDispatchGroup({
            ...completedGroup,
            hasOpenDiscrepancy: true,
        })).toBe(false)
    })

    it('keeps compliance gaps active', () => {
        expect(shouldArchiveDispatchGroup({
            ...completedGroup,
            hasEwayGap: true,
        })).toBe(false)
    })
})
