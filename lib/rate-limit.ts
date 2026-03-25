/**
 * lib/rate-limit.ts — Rate Limiter Factory
 *
 * Uses @upstash/ratelimit (Redis-backed sliding window) when UPSTASH_REDIS_REST_URL
 * is set. Falls back gracefully with a console warning when Redis is not configured,
 * so the app remains functional in environments without Redis (e.g. local dev).
 *
 * Two usage patterns:
 *   1. Middleware tier: IP-based, for auth routes (/login, /signup)
 *   2. Server action tier: User-based, for destructive operations
 *
 * Usage in middleware:
 *   const result = await checkRateLimit(authLimiter, ip)
 *   if (!result.success) return rateLimitResponse(result.reset)
 *
 * Usage in server actions:
 *   const rl = await checkRateLimit(accessCodeLimiter, userId)
 *   if (!rl.success) return { error: 'Too many attempts. Try again later.' }
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
    success: boolean
    /** Unix timestamp (ms) when the limit resets — use for Retry-After header */
    reset: number
    remaining: number
}

// ─── Redis Connection (lazy) ──────────────────────────────────────────────────

let redis: Redis | null = null
let redisWarned = false

function getRedis(): Redis | null {
    if (redis) return redis

    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
        if (!redisWarned) {
            console.warn(
                '[RateLimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set. ' +
                'Rate limiting is DISABLED. Set up Upstash Redis to enable it: https://upstash.com'
            )
            redisWarned = true
        }
        return null
    }

    redis = new Redis({ url, token })
    return redis
}

// ─── Limiter Factories ────────────────────────────────────────────────────────

function createLimiter(requests: number, windowSeconds: number): Ratelimit | null {
    const r = getRedis()
    if (!r) return null
    return new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
        analytics: false, // Don't send usage data to Upstash
    })
}

/**
 * Auth limiter — 10 requests per 15 minutes, IP-based.
 * Applied in middleware for /login, /signup, /auth/* routes.
 */
let _authLimiter: Ratelimit | null | undefined = undefined
export function getAuthLimiter() {
    if (_authLimiter === undefined) _authLimiter = createLimiter(10, 15 * 60)
    return _authLimiter
}

/**
 * Access code limiter — 5 attempts per 10 minutes, user-based.
 * Applied inside verifyAccessCode, deleteMachineWithCode, deleteWorkerWithCode.
 * Prevents brute-force of 6-character codes (16.7M space → attack takes 55+ hours at 5/10min).
 */
let _accessCodeLimiter: Ratelimit | null | undefined = undefined
export function getAccessCodeLimiter() {
    if (_accessCodeLimiter === undefined) _accessCodeLimiter = createLimiter(5, 10 * 60)
    return _accessCodeLimiter
}

/**
 * Destructive action limiter — 20 requests per 1 minute, user-based.
 * Applied inside deleteOrder, deleteAdvance, and other write-once actions.
 */
let _destructiveLimiter: Ratelimit | null | undefined = undefined
export function getDestructiveLimiter() {
    if (_destructiveLimiter === undefined) _destructiveLimiter = createLimiter(20, 60)
    return _destructiveLimiter
}

// ─── Core Check Function ──────────────────────────────────────────────────────

/**
 * Check a rate limit for the given identifier.
 * Returns { success: true } if not rate-limited, or { success: false, reset } if limited.
 * Returns { success: true } when Redis is not configured (graceful no-op).
 */
export async function checkRateLimit(
    getLimiter: () => Ratelimit | null,
    identifier: string
): Promise<RateLimitResult> {
    const limiter = getLimiter()

    if (!limiter) {
        // Redis not configured — allow all requests, but log it
        return { success: true, reset: 0, remaining: Infinity }
    }

    try {
        const result = await limiter.limit(identifier)
        return {
            success: result.success,
            reset: result.reset,
            remaining: result.remaining,
        }
    } catch (err) {
        // If Redis is temporarily unavailable, fail open (don't block the user)
        console.error('[RateLimit] Redis error — rate limiting skipped:', err)
        return { success: true, reset: 0, remaining: Infinity }
    }
}

/**
 * Pre-built helper: check the auth limiter by IP.
 * Returns null if allowed, or the reset timestamp (ms) if rate-limited.
 */
export async function checkAuthRateLimit(ip: string): Promise<number | null> {
    const result = await checkRateLimit(getAuthLimiter, `auth:${ip}`)
    return result.success ? null : result.reset
}

/**
 * Pre-built helper: check the access code limiter by user ID.
 * Returns null if allowed, or the reset timestamp (ms) if rate-limited.
 */
export async function checkAccessCodeRateLimit(userId: string): Promise<number | null> {
    const result = await checkRateLimit(getAccessCodeLimiter, `code:${userId}`)
    return result.success ? null : result.reset
}
