import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@upstash/redis', () => ({
    Redis: class {},
}))

vi.mock('@upstash/ratelimit', () => ({
    Ratelimit: class {
        static slidingWindow() {
            return {}
        }

        async limit() {
            throw new Error('redis unavailable')
        }
    },
}))

const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL
const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN

async function loadRateLimitModule() {
    vi.resetModules()
    return import('../lib/rate-limit')
}

async function exhaustLocalBudget(check: (ip: string, isSignup?: boolean) => Promise<number | null>, ip: string) {
    for (let attempt = 1; attempt <= 200; attempt += 1) {
        expect(await check(ip)).toBeNull()
    }

    return check(ip)
}

afterEach(() => {
    if (originalRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL
    else process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl

    if (originalRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken

    vi.restoreAllMocks()
})

describe('authentication rate-limit fallback', () => {
    it('keeps authentication throttled when Redis is not configured', async () => {
        delete process.env.UPSTASH_REDIS_REST_URL
        delete process.env.UPSTASH_REDIS_REST_TOKEN

        const now = 1_700_000_000_000
        vi.spyOn(Date, 'now').mockReturnValue(now)
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { checkAuthRateLimit } = await loadRateLimitModule()

        const reset = await exhaustLocalBudget(checkAuthRateLimit, '198.51.100.10')

        expect(reset).toBe(now + 15 * 60 * 1000)
        expect(errorSpy).toHaveBeenCalledWith(
            '[RateLimit] Auth rate limiter unavailable — using bounded local auth fallback.'
        )
    })

    it('keeps authentication throttled when Redis requests fail', async () => {
        process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test'
        process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

        const now = 1_700_000_000_000
        vi.spyOn(Date, 'now').mockReturnValue(now)
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { checkAuthRateLimit } = await loadRateLimitModule()

        const reset = await exhaustLocalBudget(checkAuthRateLimit, '198.51.100.11')

        expect(reset).toBe(now + 15 * 60 * 1000)
        expect(errorSpy).toHaveBeenCalledWith(
            '[RateLimit] Auth Redis error — using bounded local auth fallback:',
            expect.any(Error)
        )
    })

    it('keeps login and signup fallback buckets separate for the same IP', async () => {
        delete process.env.UPSTASH_REDIS_REST_URL
        delete process.env.UPSTASH_REDIS_REST_TOKEN

        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const { checkAuthRateLimit } = await loadRateLimitModule()

        expect(await checkAuthRateLimit('198.51.100.12')).toBeNull()
        expect(await checkAuthRateLimit('198.51.100.12', true)).toBeNull()
    })
})
