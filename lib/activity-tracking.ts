/**
 * Active-time counting for owners (spec 2026-10-30 section A). Pure, so the
 * browser tracker only wires events to it. A minute counts when the page is
 * visible and the owner touched, scrolled or typed in the last 60 seconds.
 * Nothing about page content, typed values or the URL beyond its area leaves here.
 */
export const ACTIVITY_AREAS = ['estimator', 'saved_costings', 'rate_book', 'plan_billing', 'settings', 'support', 'other'] as const
export type ActivityArea = typeof ACTIVITY_AREAS[number]
export type ActivityDevice = 'phone' | 'tablet' | 'desktop'
export type ActivityFlush = { minutes: number; areas: Partial<Record<ActivityArea, number>>; device: ActivityDevice; installed: boolean }

export const ACTIVITY_TICK_MS = 60_000
export const ACTIVITY_FLUSH_MS = 300_000
/** The endpoint accepts at most this many minutes per flush. */
const MAX_FLUSH_MINUTES = 10
const INPUT_WINDOW_MS = 60_000

const AREA_ROUTES: readonly [ActivityArea, readonly string[]][] = [
    ['estimator', ['/free', '/owner/estimator']],
    ['saved_costings', ['/free/costings', '/owner/quotes']],
    ['rate_book', ['/owner/rates']],
    ['plan_billing', ['/owner/billing', '/free/billing', '/plans']],
    ['settings', ['/owner/settings', '/owner/data-export', '/free/settings', '/free/account']],
    ['support', ['/support']],
]

const within = (pathname: string, route: string) => pathname === route || pathname.startsWith(`${route}/`)

export function activityAreaForPath(pathname: string): ActivityArea {
    // Longest route wins, so /free/costings is saved costings rather than the /free estimator.
    let best: { area: ActivityArea; length: number } | null = null
    for (const [area, routes] of AREA_ROUTES) {
        for (const route of routes) {
            if (within(pathname, route) && (!best || route.length > best.length)) best = { area, length: route.length }
        }
    }
    return best?.area ?? 'other'
}

export function activityDevice(width: number, coarsePointer: boolean): ActivityDevice {
    if (width < 640) return 'phone'
    if (coarsePointer && width < 1200) return 'tablet'
    return 'desktop'
}

export class ActivityCounter {
    private lastInputAt: number | null = null
    private minutes = 0
    private areas: Partial<Record<ActivityArea, number>> = {}
    private device: ActivityDevice = 'desktop'
    private installed = false

    recordInput(at: number): void {
        this.lastInputAt = at
    }

    tick(at: number, context: { visible: boolean; area: ActivityArea; device: ActivityDevice; installed: boolean }): void {
        if (!context.visible || this.lastInputAt === null || at - this.lastInputAt > INPUT_WINDOW_MS) return
        if (this.minutes >= MAX_FLUSH_MINUTES) return
        this.minutes += 1
        this.areas[context.area] = (this.areas[context.area] ?? 0) + 1
        this.device = context.device
        this.installed = context.installed
    }

    takeFlush(): ActivityFlush | null {
        if (this.minutes === 0) return null
        const flush: ActivityFlush = { minutes: this.minutes, areas: this.areas, device: this.device, installed: this.installed }
        this.minutes = 0
        this.areas = {}
        return flush
    }
}
