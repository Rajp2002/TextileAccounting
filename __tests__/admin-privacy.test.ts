import { describe, expect, it } from 'vitest'
import { isSensitiveRoute, isSensitiveTelemetryEvent, mayPersistQuery, redactUrlQuery } from '@/lib/sensitive-routes'
import { redactSentryEvent } from '@/lib/sentry-redaction'

describe('founder and requester privacy boundaries', () => {
    it('covers exact protected paths and arbitrary nested objects without hiding unrelated URLs', () => {
        for (const path of ['/admin','/admin/login','/admin/factories/a','/api/admin/session','/support','/support/a','/api/support/a/messages']) {
            expect(isSensitiveRoute(`https://qa.invalid${path}?token=secret`)).toBe(true)
        }
        for (const path of ['/administrator','/supporting','/api/supporting','/owner','/privacy-request']) expect(isSensitiveRoute(path)).toBe(false)
    })
    it('discards protected request/transaction telemetry', () => {
        expect(isSensitiveTelemetryEvent({ request: { url: '/api/support/a?body=private' } })).toBe(true)
        expect(isSensitiveTelemetryEvent({ transaction: '/admin/support/[ticketId]' })).toBe(true)
        expect(isSensitiveTelemetryEvent({ transaction: '/owner/estimator' })).toBe(false)
        for (const transaction of ['GET /api/admin/support/[id]', 'POST /api/support/[id]/messages', 'PATCH /admin/support/[id]']) {
            expect(isSensitiveTelemetryEvent({ transaction })).toBe(true)
        }
        expect(isSensitiveTelemetryEvent({ transaction: 'GET /owner' })).toBe(false)
    })
    it('prevents sensitive query persistence even in an accidentally scoped provider', () => {
        expect(mayPersistQuery({ queryKey: ['admin', 'factories'] })).toBe(false)
        expect(mayPersistQuery({ queryKey: ['support:thread', 'ticket'] })).toBe(false)
        expect(mayPersistQuery({ queryKey: ['/api/support'] })).toBe(false)
        expect(mayPersistQuery({ queryKey: ['other'], meta: { sensitive: true } })).toBe(false)
        expect(mayPersistQuery({ queryKey: ['machine-list'] })).toBe(true)
    })
    it('strips query/fragment secrets and request body/cookies from ordinary diagnostics', () => {
        const event = redactSentryEvent({ request: { url: 'https://qa.invalid/login?token=secret#password', data: { password: 'secret' }, query_string: 'secret', cookies: 'secret', headers: { Authorization: 'secret' } }, breadcrumbs: [{ data: { url: '/owner?search=private#details' } }] })
        expect(event.request.url).toBe('https://qa.invalid/login')
        expect(event.request).not.toHaveProperty('data')
        expect(event.request.cookies).toBe('[redacted]')
        expect(event.request.headers.Authorization).toBe('[redacted]')
        expect(event.breadcrumbs[0].data.url).toBe('/owner')
        expect(redactUrlQuery('/support?draft=private#details')).toBe('/support')
    })
})
