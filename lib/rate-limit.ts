/**
 * lib/rate-limit.ts — Rate Limiter Factory
 *
 * Uses @upstash/ratelimit (Redis-backed sliding window) when UPSTASH_REDIS_REST_URL
 * is set. Generic public routes fall back gracefully in environments without
 * Redis. Authentication and access-code checks use stricter bounded/fail-closed
 * behavior when Redis is unavailable.
 *
 * Two usage patterns:
 *   1. Middleware tier: IP-based, for auth routes (/login, /signup)
 *   2. Server action tier: User-based, for destructive operations
 *
 * Usage in middleware:
 *   const resetAt = await checkAuthRateLimit(ip)
 *   if (resetAt !== null) return rateLimitResponse(resetAt)
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
let authFallbackAlerted = false
const AUTH_LIMIT = 200
const AUTH_WINDOW_SECONDS = 15 * 60
const LOCAL_AUTH_BUCKET_CAPACITY = 10_000
const ACCESS_CODE_LIMIT = 5
const ACCESS_CODE_WINDOW_SECONDS = 10 * 60
const ACCESS_CODE_LOCKOUT_SECONDS = 10 * 60
const ACCESS_CODE_UNAVAILABLE_MESSAGE = 'Access-code protection is temporarily unavailable. Try again later.'

type LocalAuthBucket = {
    count: number
    reset: number
}

const localAuthBuckets = new Map<string, LocalAuthBucket>()

function getRedis(): Redis | null {
    if (redis) return redis

    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
        if (!redisWarned) {
            console.warn(
                '[RateLimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set. ' +
                'Redis-backed rate limiting is unavailable. Configure Upstash Redis for distributed limits: https://upstash.com'
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
 * Auth limiter — 200 requests per 15 minutes, IP-based.
 * Applied in middleware for /login and /auth/* routes.
 */
let _authLimiter: Ratelimit | null | undefined = undefined
export function getAuthLimiter() {
    if (_authLimiter === undefined) _authLimiter = createLimiter(AUTH_LIMIT, AUTH_WINDOW_SECONDS)
    return _authLimiter
}

/**
 * Signup limiter — 200 requests per 15 minutes, IP-based.
 * Higher limit to facilitate testing and legitimate high-traffic onboarding.
 */
let _signupLimiter: Ratelimit | null | undefined = undefined
export function getSignupLimiter() {
    if (_signupLimiter === undefined) _signupLimiter = createLimiter(AUTH_LIMIT, AUTH_WINDOW_SECONDS)
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
 * This generic helper is intentionally fail-open for non-auth callers; auth routes
 * must use checkAuthRateLimit so they retain a bounded fallback.
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

function alertAuthFallback(reason: string, error?: unknown) {
    if (authFallbackAlerted) return
    authFallbackAlerted = true

    if (error) {
        console.error(`[RateLimit] ${reason} — using bounded local auth fallback:`, error)
    } else {
        console.error(`[RateLimit] ${reason} — using bounded local auth fallback.`)
    }
}

function evictLocalAuthBucket(nowMs: number) {
    for (const [key, bucket] of localAuthBuckets) {
        if (bucket.reset <= nowMs) {
            localAuthBuckets.delete(key)
            return
        }
    }

    const oldestKey = localAuthBuckets.keys().next().value
    if (typeof oldestKey === 'string') localAuthBuckets.delete(oldestKey)
}

function checkLocalAuthRateLimit(
    identifier: string,
    reason: string,
    error?: unknown,
    nowMs = Date.now()
): number | null {
    alertAuthFallback(reason, error)

    let bucket = localAuthBuckets.get(identifier)
    if (!bucket || bucket.reset <= nowMs) {
        if (bucket) localAuthBuckets.delete(identifier)
        if (localAuthBuckets.size >= LOCAL_AUTH_BUCKET_CAPACITY) {
            evictLocalAuthBucket(nowMs)
        }

        bucket = {
            count: 0,
            reset: nowMs + AUTH_WINDOW_SECONDS * 1000,
        }
        localAuthBuckets.set(identifier, bucket)
    }

    bucket.count = Math.min(bucket.count + 1, AUTH_LIMIT + 1)
    return bucket.count > AUTH_LIMIT ? bucket.reset : null
}

/**
 * Pre-built helper: check the auth limiter by IP.
 * Returns null if allowed, or the reset timestamp (ms) if rate-limited.
 * Missing or failing Redis uses a bounded per-runtime fallback instead of
 * allowing authentication traffic through without any throttling.
 */
export async function checkAuthRateLimit(ip: string, isSignup: boolean = false): Promise<number | null> {
    const limiterFn = isSignup ? getSignupLimiter : getAuthLimiter
    // Use separate key prefixes so login and signup/join don't share the same bucket
    const keyPrefix = isSignup ? 'signup' : 'login'
    const identifier = `${keyPrefix}:${ip}`
    let limiter: Ratelimit | null

    try {
        limiter = limiterFn()
    } catch (err) {
        return checkLocalAuthRateLimit(identifier, 'Auth rate limiter initialization failed', err)
    }

    if (!limiter) {
        return checkLocalAuthRateLimit(identifier, 'Auth rate limiter unavailable')
    }

    try {
        const result = await limiter.limit(identifier)
        return result.success ? null : result.reset
    } catch (err) {
        return checkLocalAuthRateLimit(identifier, 'Auth Redis error', err)
    }
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
