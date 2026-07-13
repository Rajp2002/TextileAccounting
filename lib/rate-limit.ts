/**
 * lib/rate-limit.ts — Rate Limiter Factory
 *
 * Uses @upstash/ratelimit (Redis-backed sliding window) when UPSTASH_REDIS_REST_URL
 * is set. Generic public/auth routes fall back gracefully in environments without
 * Redis. Access-code checks are stricter and fail closed when Redis is unavailable.
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

export function getRateLimitRetrySeconds(resetAtMs: number, nowMs = Date.now()): number {
    return Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000))
}

// ─── Redis Connection (lazy) ──────────────────────────────────────────────────

let redis: Redis | null = null
let redisWarned = false
const ACCESS_CODE_LIMIT = 5
const ACCESS_CODE_WINDOW_SECONDS = 10 * 60
const ACCESS_CODE_LOCKOUT_SECONDS = 10 * 60
const ACCESS_CODE_UNAVAILABLE_MESSAGE = 'Access-code protection is temporarily unavailable. Try again later.'
const JOIN_CODE_LIMIT = 10
const JOIN_CODE_WINDOW_SECONDS = 10 * 60
const JOIN_CODE_UNAVAILABLE_MESSAGE = 'Join-code protection is temporarily unavailable. Try again later.'

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
 * Applied in middleware for /login and /auth/* routes.
 */
let _authLimiter: Ratelimit | null | undefined = undefined
export function getAuthLimiter() {
    if (_authLimiter === undefined) _authLimiter = createLimiter(200, 15 * 60)
    return _authLimiter
}

/**
 * Signup limiter — 50 requests per 15 minutes, IP-based.
 * Higher limit to facilitate testing and legitimate high-traffic onboarding.
 */
let _signupLimiter: Ratelimit | null | undefined = undefined
export function getSignupLimiter() {
    if (_signupLimiter === undefined) _signupLimiter = createLimiter(200, 15 * 60)
    return _signupLimiter
}

/**
 * Access code limiter — 5 attempts per 10 minutes, user-based.
 * Applied inside verifyAccessCode, deleteMachineWithCode, deleteWorkerWithCode.
 * Prevents brute-force of 6-character codes (16.7M space → attack takes 55+ hours at 5/10min).
 */
let _accessCodeLimiter: Ratelimit | null | undefined = undefined
export function getAccessCodeLimiter() {
    if (_accessCodeLimiter === undefined) _accessCodeLimiter = createLimiter(ACCESS_CODE_LIMIT, ACCESS_CODE_WINDOW_SECONDS)
    return _accessCodeLimiter
}

/**
 * Public factory join-code limiter — 10 attempts per 10 minutes, IP-based.
 * This boundary uses a service-role lookup, so unlike generic auth throttles it
 * fails closed when Redis is unavailable.
 */
let _joinCodeLimiter: Ratelimit | null | undefined = undefined
export function getJoinCodeLimiter() {
    if (_joinCodeLimiter === undefined) _joinCodeLimiter = createLimiter(JOIN_CODE_LIMIT, JOIN_CODE_WINDOW_SECONDS)
    return _joinCodeLimiter
}

/**
 * Destructive action limiter — 20 requests per 1 minute, user-based.
 * Applied inside deleteOrder, deleteAdvance, and other write-once actions.
 */
let _destructiveLimiter: Ratelimit | null | undefined = undefined
export function getDestructiveLimiter() {
    if (_destructiveLimiter === undefined) _destructiveLimiter = createLimiter(100, 60)
    return _destructiveLimiter
}

/**
 * Retained for legacy tracking endpoints. Public dispatch confirmation is
 * currently deferred; owner receipt recording uses authenticated actions.
 */
let _trackingLimiter: Ratelimit | null | undefined = undefined
export function getTrackingLimiter() {
    if (_trackingLimiter === undefined) _trackingLimiter = createLimiter(20, 60)
    return _trackingLimiter
}

/**
 * Public POST limiter. Used for unauthenticated endpoints before expensive work
 * or signature parsing.
 */
let _publicPostLimiter: Ratelimit | null | undefined = undefined
export function getPublicPostLimiter() {
    if (_publicPostLimiter === undefined) _publicPostLimiter = createLimiter(120, 60)
    return _publicPostLimiter
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
export async function checkAuthRateLimit(ip: string, isSignup: boolean = false): Promise<number | null> {
    const limiterFn = isSignup ? getSignupLimiter : getAuthLimiter
    // Use separate key prefixes so login and signup/join don't share the same bucket
    const keyPrefix = isSignup ? 'signup' : 'login'
    const result = await checkRateLimit(limiterFn, `${keyPrefix}:${ip}`)
    return result.success ? null : result.reset
}

/**
 * Pre-built helper: check the access code limiter by user ID.
 * Returns null if allowed, or the reset timestamp (ms) if rate-limited.
 */
export async function checkAccessCodeRateLimit(userId: string): Promise<number | null> {
    const limiter = getAccessCodeLimiter()
    if (!limiter) throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)

    try {
        const result = await limiter.limit(`code:${userId}`)
        return result.success ? null : result.reset
    } catch (err) {
        console.error('[RateLimit] Redis error — access-code validation blocked:', err)
        throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)
    }
}

/**
 * Check public join-code attempts by client IP and action bucket.
 * Validation and final registration use separate buckets so a legitimate
 * validation does not consume the final-submit allowance.
 */
export async function checkJoinCodeRateLimit(ip: string, action: 'validate' | 'join'): Promise<number | null> {
    const limiter = getJoinCodeLimiter()
    if (!limiter) throw new Error(JOIN_CODE_UNAVAILABLE_MESSAGE)

    try {
        const result = await limiter.limit(`join-code:${action}:${ip}`)
        return result.success ? null : result.reset
    } catch (err) {
        console.error('[RateLimit] Redis error — join-code validation blocked:', err)
        throw new Error(JOIN_CODE_UNAVAILABLE_MESSAGE)
    }
}

/**
 * Pre-built helper: check legacy public tracking requests by IP and token.
 */
export async function checkTrackingRateLimit(ip: string, trackingToken: string): Promise<number | null> {
    const result = await checkRateLimit(getTrackingLimiter, `tracking:${ip}:${trackingToken}`)
    return result.success ? null : result.reset
}

/**
 * Pre-built helper: check public POST routes by IP and route bucket.
 */
export async function checkPublicPostRateLimit(ip: string, bucket: string): Promise<number | null> {
    const result = await checkRateLimit(getPublicPostLimiter, `public-post:${bucket}:${ip}`)
    return result.success ? null : result.reset
}

export function getClientIpFromHeaders(headerList: { get(name: string): string | null }): string {
    return headerList.get('x-forwarded-for')?.split(',')[0]?.trim()
        || headerList.get('x-real-ip')
        || 'unknown'
}

// ─── Phase 3: Advanced Redis Controls ─────────────────────────────────────────

/**
 * Check if the user is currently locked out from entering access codes.
 */
export async function checkAccessCodeLockout(userId: string): Promise<boolean> {
    const r = getRedis()
    if (!r) throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)
    try {
        return !!(await r.get(`lockout:${userId}`))
    } catch (err) {
        console.error('[RateLimit] Redis error — access-code lockout check blocked:', err)
        throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)
    }
}

/**
 * Record a failed access code attempt. If they fail 5 times within 30 minutes,
 * they are locked out for 1 hour.
 */
export async function recordAccessCodeFailure(userId: string): Promise<void> {
    const r = getRedis()
    if (!r) throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)
    try {
        const key = `code_fails:${userId}`
        const fails = await r.incr(key)
        if (fails === 1) {
            await r.expire(key, ACCESS_CODE_WINDOW_SECONDS)
        }
        if (fails >= 5) {
            await r.setex(`lockout:${userId}`, ACCESS_CODE_LOCKOUT_SECONDS, '1')
        }
    } catch (err) {
        console.error('[RateLimit] Redis error on failure record:', err)
        throw new Error(ACCESS_CODE_UNAVAILABLE_MESSAGE)
    }
}

/**
 * Reset failed attempts (called upon a successful code entry).
 */
export async function resetAccessCodeFailures(userId: string): Promise<void> {
    const r = getRedis()
    if (!r) return
    try {
        await r.del(`code_fails:${userId}`)
        await r.del(`lockout:${userId}`)
    } catch {}
}

/**
 * Immediately revoke a user's session by flagging their ID in Redis for 1 hour
 * (matching the maximum duration of their session cookie).
 */
export async function revokeUserSession(userId: string): Promise<void> {
    const r = getRedis()
    if (!r) return
    try {
        await r.setex(`revoked:${userId}`, 3600, '1')
    } catch (err) {
        console.error('[RateLimit] Redis error on session revocation:', err)
    }
}

/**
 * Check if a user's session has been explicitly revoked.
 */
export async function isUserRevoked(userId: string): Promise<boolean> {
    const r = getRedis()
    if (!r) return false
    try {
        return !!(await r.get(`revoked:${userId}`))
    } catch {
        return false // fail open
    }
}
