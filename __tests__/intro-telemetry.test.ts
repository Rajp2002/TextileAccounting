import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { INTRO_TELEMETRY_PATH, parseIntroReport } from '../lib/intro/intro-telemetry'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('installed-app intro telemetry', () => {
    it('reads why the intro ended and how far its start-up got, in whole milliseconds', () => {
        const report = parseIntroReport(JSON.stringify({
            s: 'app-login', reason: 'watchdog', forced: false,
            d: 12.4, dcl: 300.2, effect: 1900, runtime: 1950.6, init: 1960, images: 2400, end: 1801,
        }))
        expect(report).toEqual({
            surface: 'app-login', reason: 'watchdog', detail: null, forced: false,
            decided_ms: 12, dcl_ms: 300, effect_ms: 1900, runtime_ms: 1951, init_ms: 1960, images_ms: 2400,
            gl_ms: null, started_ms: null, first_frame_ms: null, end_ms: 1801,
        })
    })

    it('keeps an error message short and on one line', () => {
        const report = parseIntroReport(JSON.stringify({ s: 'app-login', reason: 'error', detail: `shader compile failed:\n${'x'.repeat(400)}` }))
        expect(report?.detail).toMatch(/^shader compile failed: x+$/)
        expect(report?.detail).toHaveLength(160)
    })

    it('drops anything it does not know and bounds the timings', () => {
        const report = parseIntroReport(JSON.stringify({ s: 'app-login', reason: 'complete', email: 'a@b.c', dcl: -5, end: 9e9, forced: 'yes' }))
        expect(report).not.toHaveProperty('email')
        expect(report?.dcl_ms).toBeNull()
        expect(report?.end_ms).toBe(120_000)
        expect(report?.forced).toBe(false)
    })

    it('rejects anything that is not an installed-app intro report', () => {
        for (const text of [
            'not json',
            '[]',
            'null',
            JSON.stringify({ s: 'landing', reason: 'complete' }),
            JSON.stringify({ s: 'app-login', reason: 'exploded' }),
            JSON.stringify({ s: 'app-login' }),
            JSON.stringify({ s: 'app-login', reason: 'error', detail: 'x'.repeat(5_000) }),
        ]) {
            expect(parseIntroReport(text), text.slice(0, 40)).toBeNull()
        }
    })

    it('is a public, rate-limited endpoint that logs only the parsed report', () => {
        const route = read('app/api/telemetry/intro/route.ts')
        expect(INTRO_TELEMETRY_PATH).toBe('/api/telemetry/intro')
        expect(route).toContain("checkPublicPostRateLimit(getClientIpFromHeaders(requestHeaders), 'intro-telemetry')")
        expect(route).toContain('parseIntroReport(await request.text())')
        expect(route).toContain("event: 'intro_client_timing'")
        expect(route).not.toContain("'user-agent':")
        // Signed out by definition, so the proxy must let it through without a session.
        expect(read('proxy.ts')).toContain("pathname === '/api/telemetry/intro'")
    })
})
