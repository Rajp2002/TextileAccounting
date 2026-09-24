import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    classifySignInClient,
    isSignInTraceId,
    normalizeSignInDestination,
    sanitizeTimingMs,
} from '../lib/sign-in-trace'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('sign-in timing telemetry', () => {
    it('accepts random trace identifiers and restricts reported destinations', () => {
        expect(isSignInTraceId('89b0ec11-6db8-4b64-8695-b538c59c49c1')).toBe(true)
        expect(isSignInTraceId('short')).toBe(false)
        expect(normalizeSignInDestination('/owner/estimator?from=login')).toBe('/owner/estimator')
        expect(normalizeSignInDestination('/private/customer/record')).toBe('/other')
    })

    it('bounds timings and reduces user agents to privacy-safe families', () => {
        expect(sanitizeTimingMs(5123.6)).toBe(5124)
        expect(sanitizeTimingMs(-1)).toBeNull()
        expect(sanitizeTimingMs(999_999)).toBe(120_000)
        expect(classifySignInClient(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1'
        )).toEqual({ platform: 'ios', browser: 'safari' })
        expect(classifySignInClient(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/138.0 Mobile/15E148 Safari/604.1'
        )).toEqual({ platform: 'ios', browser: 'chrome' })
    })

    it('correlates the client click, server action, and meaningful dashboard readiness', () => {
        const loginForm = read('app/(auth)/login/login-form.tsx')
        const authAction = read('app/(auth)/actions/auth.ts')
        const reporter = read('components/telemetry/sign-in-timing-reporter.tsx')
        const endpoint = read('app/api/telemetry/sign-in/route.ts')

        expect(loginForm).toContain('signIn({ email: email.trim(), password, traceId })')
        expect(loginForm).toContain('SIGN_IN_TRACE_STORAGE_KEY')
        expect(authAction).toContain("createSignInServerTimer('sign_in_server_action', input.traceId)")
        expect(authAction).toMatch(/telemetry\.measure\(\s*'password_auth'/)
        expect(authAction).toContain("telemetry.measure('tier_lookup'")
        expect(reporter).toContain("reportStage(trace, 'route_painted'")
        expect(reporter).toContain("finish('dashboard_ready')")
        expect(endpoint).toContain("event: 'sign_in_client_timing'")
        expect(endpoint).not.toContain('body.email')
        expect(endpoint).not.toContain('body.password')
        expect(endpoint).not.toContain("'user-agent':")
    })

    it('places readiness markers after landing data is available', () => {
        expect(read('app/(dashboard)/owner/estimator/EstimatorClient.tsx'))
            .toContain('data-signin-ready="true"')
        expect(read('app/(dashboard)/admin/page.tsx'))
            .toContain('data-signin-ready="true"')
    })
})
