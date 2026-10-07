import { describe, expect, it } from 'vitest'
import {
    formatJoinCode,
    isValidJoinCode,
    normalizeJoinCode,
    SUPERVISOR_HOME_PATH,
    SUPERVISOR_JOIN_PATH,
    SUPERVISOR_SHEET_PATH,
    supervisorDateWindow,
} from '@/lib/supervisor-access'
import { supervisorCopy, supervisorText } from '@/lib/i18n/supervisor-access'

describe('supervisor routes', () => {
    it('names the supervisor home, sheet and join paths', () => {
        expect(SUPERVISOR_HOME_PATH).toBe('/supervisor')
        expect(SUPERVISOR_SHEET_PATH).toBe('/supervisor/daily-sheet')
        expect(SUPERVISOR_JOIN_PATH).toBe('/join')
    })
})

describe('factory codes', () => {
    it('normalizes what people type: case, spaces and the hyphen', () => {
        expect(normalizeJoinCode(' abcd-2345 ')).toBe('ABCD2345')
        expect(normalizeJoinCode('abcd 2345')).toBe('ABCD2345')
    })

    it('accepts only eight characters from the unambiguous alphabet', () => {
        expect(isValidJoinCode('ABCD2345')).toBe(true)
        expect(isValidJoinCode('ABCD2O45')).toBe(false)
        expect(isValidJoinCode('ABCD2I45')).toBe(false)
        expect(isValidJoinCode('ABCD1345')).toBe(false)
        expect(isValidJoinCode('ABCD234')).toBe(false)
    })

    it('displays the code in two groups of four', () => {
        expect(formatJoinCode('ABCD2345')).toBe('ABCD-2345')
    })
})

describe('supervisor date window', () => {
    it('is today and yesterday', () => {
        expect(supervisorDateWindow('2026-10-01')).toEqual({ min: '2026-09-30', max: '2026-10-01' })
        expect(supervisorDateWindow('2026-03-01')).toEqual({ min: '2026-02-28', max: '2026-03-01' })
    })
})

describe('supervisor copy', () => {
    it('has the same keys in English, Hindi and Gujarati, with no empty strings', () => {
        const english = Object.keys(supervisorCopy.en).sort()
        for (const language of ['hi', 'gu'] as const) {
            expect(Object.keys(supervisorCopy[language]).sort()).toEqual(english)
        }
        for (const language of ['en', 'hi', 'gu'] as const) {
            for (const [key, value] of Object.entries(supervisorCopy[language])) {
                expect({ language, key, empty: value.trim().length === 0 }).toEqual({ language, key, empty: false })
            }
        }
    })

    it('keeps the same placeholders in every language', () => {
        const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()
        for (const key of Object.keys(supervisorCopy.en) as Array<keyof typeof supervisorCopy.en>) {
            for (const language of ['hi', 'gu'] as const) {
                expect({ key, language, placeholders: placeholders(supervisorCopy[language][key]) })
                    .toEqual({ key, language, placeholders: placeholders(supervisorCopy.en[key]) })
            }
        }
    })

    it('fills placeholders', () => {
        expect(supervisorText('en', 'pendingBody', { factory: 'Shree Mills' })).toContain('Shree Mills')
        expect(supervisorText('en', 'pendingBody', { factory: 'Shree Mills' })).not.toContain('{factory}')
    })
})

describe('join code rate limit', () => {
    it('without Redis, allows 20 code checks per IP in the window, then blocks', async () => {
        delete process.env.UPSTASH_REDIS_REST_URL
        delete process.env.UPSTASH_REDIS_REST_TOKEN
        const { checkSupervisorJoinRateLimit } = await import('@/lib/rate-limit')
        const ip = `203.0.113.${Math.floor(Math.random() * 200)}`
        for (let attempt = 0; attempt < 20; attempt++) expect(await checkSupervisorJoinRateLimit(ip)).toBeNull()
        expect(await checkSupervisorJoinRateLimit(ip)).toBeGreaterThan(Date.now())
        expect(await checkSupervisorJoinRateLimit('198.51.100.7')).toBeNull()
    })
})
