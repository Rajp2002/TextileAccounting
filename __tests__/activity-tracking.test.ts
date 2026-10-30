import { describe, expect, it } from 'vitest'
import { ActivityCounter, activityAreaForPath, activityDevice } from '@/lib/activity-tracking'

describe('activityAreaForPath', () => {
    it.each([
        ['/free', 'estimator'], ['/owner/estimator', 'estimator'], ['/owner/estimator/abc', 'estimator'],
        ['/free/costings', 'saved_costings'], ['/owner/quotes', 'saved_costings'],
        ['/owner/rates', 'rate_book'],
        ['/owner/billing', 'plan_billing'], ['/free/billing', 'plan_billing'], ['/plans', 'plan_billing'],
        ['/owner/settings', 'settings'], ['/owner/data-export', 'settings'], ['/free/settings', 'settings'], ['/free/account', 'settings'],
        ['/support', 'support'], ['/support/3f2a', 'support'],
        ['/owner/production', 'other'], ['/owner/payroll', 'other'], ['/freely', 'other'],
    ])('maps %s to %s', (path, area) => expect(activityAreaForPath(path)).toBe(area))
})

describe('activityDevice', () => {
    it('classifies phones, tablets and desktops', () => {
        expect(activityDevice(390, true)).toBe('phone')
        expect(activityDevice(820, true)).toBe('tablet')
        expect(activityDevice(1280, true)).toBe('desktop')
        expect(activityDevice(900, false)).toBe('desktop')
    })
})

describe('ActivityCounter', () => {
    const ctx = { visible: true, area: 'estimator' as const, device: 'phone' as const, installed: true }

    it('counts a visible minute only when there was input in the last 60 seconds', () => {
        const counter = new ActivityCounter()
        counter.recordInput(0)
        counter.tick(60_000, ctx)
        counter.tick(120_001, ctx)
        expect(counter.takeFlush()).toEqual({ minutes: 1, areas: { estimator: 1 }, device: 'phone', installed: true })
    })

    it('does not count hidden minutes', () => {
        const counter = new ActivityCounter()
        counter.recordInput(0)
        counter.tick(30_000, { ...ctx, visible: false })
        expect(counter.takeFlush()).toBeNull()
    })

    it('attributes each minute to the area at tick time and resets after a flush', () => {
        const counter = new ActivityCounter()
        counter.recordInput(0)
        counter.tick(30_000, ctx)
        counter.recordInput(40_000)
        counter.tick(90_000, { ...ctx, area: 'rate_book', device: 'desktop', installed: false })
        expect(counter.takeFlush()).toEqual({ minutes: 2, areas: { estimator: 1, rate_book: 1 }, device: 'desktop', installed: false })
        expect(counter.takeFlush()).toBeNull()
    })

    it('never builds a flush above 10 minutes', () => {
        const counter = new ActivityCounter()
        for (let i = 0; i < 15; i++) {
            counter.recordInput(i * 60_000)
            counter.tick(i * 60_000 + 1, ctx)
        }
        expect(counter.takeFlush()!.minutes).toBe(10)
    })
})
