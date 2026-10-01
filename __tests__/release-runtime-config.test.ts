import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { redactSensitiveText, redactSentryEvent } from '../lib/sentry-redaction'
import { buildSentryReleaseScript } from '../lib/sentry-release'

function read(path: string) {
  return readFileSync(path, 'utf8')
}

describe('release/runtime configuration', () => {
  it('gates the release build behind the Vitest test script', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.test).toBe('vitest run')
    expect(packageJson.scripts?.prebuild).toBe('npm run test')
  })

  it('uses shared Sentry redaction in client, node, and edge instrumentation', () => {
    expect(read('instrumentation.ts')).toContain('redactSentryEvent(event)')
    expect(read('instrumentation-client.ts')).toContain('redactSentryEvent(event)')
    expect(read('instrumentation.edge.ts')).toContain('redactSentryEvent(event)')

    expect(redactSensitiveText('Call 9876543210 about account 123456789012')).toBe(
      'Call [PHONE_REDACTED] about account [AADHAAR_REDACTED]'
    )
  })

  it('uses one Sentry tunnel route controlled by withSentryConfig', () => {
    const nextConfig = read('next.config.ts')
    const clientInstrumentation = read('instrumentation-client.ts')
    const proxy = read('proxy.ts')

    expect(nextConfig).toContain("tunnelRoute: '/monitoring'")
    expect(clientInstrumentation).not.toContain('tunnel:')
    expect(clientInstrumentation).not.toContain('/api/sentry-tunnel')
    expect(existsSync('app/api/sentry-tunnel/route.ts')).toBe(false)
    expect(proxy).not.toContain("pathname === '/api/sentry-tunnel'")
    expect(proxy).toContain('?!monitoring|_next/static')
  })

  it('requires build-time Sentry auth token configuration for releases and source maps', () => {
    const nextConfig = read('next.config.ts')

    expect(nextConfig).toContain('authToken: process.env.SENTRY_AUTH_TOKEN')
    expect(nextConfig).toContain('release:')
    expect(nextConfig).toContain('process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA')
    expect(nextConfig).toContain('widenClientFileUpload: true')
  })

  it('creates Sentry releases at build time without compiling the release into client bundles', () => {
    const nextConfig = read('next.config.ts')
    const layout = read('app/layout.tsx')
    const clientInstrumentation = read('instrumentation-client.ts')

    // A commit SHA inside the shared Sentry chunk changed it on every deploy,
    // so every user re-downloaded and recompiled it on their next open.
    expect(nextConfig).toContain('release: { create: false }')
    expect(nextConfig).toContain('unstable_sentryWebpackPluginOptions')
    expect(nextConfig).toContain('inject: false')
    expect(nextConfig).toContain('deploy: process.env.VERCEL_ENV ? { env: process.env.VERCEL_ENV } : undefined')
    // The browser gets the release from the page at runtime instead.
    expect(layout).toContain('<SentryReleaseScript />')
    expect(layout.indexOf('<SentryReleaseScript />')).toBeLessThan(layout.indexOf('<body'))
    expect(clientInstrumentation).toContain('release: readRuntimeSentryRelease()')
    expect(clientInstrumentation).toContain('withRuntimeRelease(')
  })

  it('hands the browser a release script that cannot close its script element', () => {
    expect(buildSentryReleaseScript('2904d7a44cc0247ee3d68c62e645406036e0036b')).toBe(
      'window.SENTRY_RELEASE={id:"2904d7a44cc0247ee3d68c62e645406036e0036b"};'
    )
    expect(buildSentryReleaseScript('</script><script>alert(1)</script>')).not.toContain('</script>')
  })

  it('allows only self and blob workers in the production CSP', () => {
    const nextConfig = read('next.config.ts')

    expect(nextConfig).toContain("worker-src 'self' blob:;")
    expect(nextConfig).not.toContain('worker-src *')
    expect(nextConfig).not.toContain("worker-src 'unsafe-inline'")
  })

  it('redacts sensitive Sentry event fields before reporting', () => {
    const event = redactSentryEvent({
      message: 'Call 9876543210; bank account 123456789012345',
      user: {
        email: 'owner@example.com',
        ip_address: '203.0.113.1',
        username: 'owner@example.com',
        id: 'user-123',
      },
      request: {
        url: 'https://textile-accounting.vercel.app/login?phone=9876543210',
        query_string: 'token=secret',
        cookies: 'sb-auth-token=secret',
        headers: {
          authorization: 'Bearer secret',
          Cookie: 'session=secret',
          'x-request-id': 'safe-request-id',
        },
      },
      breadcrumbs: [
        {
          message: 'Saved phone 9876543210',
          data: { url: 'https://example.com/path?account=123456789012345' },
        },
      ],
      exception: {
        values: [{ value: 'Failed for Aadhaar 1234 5678 9012' }],
      },
    })

    expect(event.message).toBe('Call [PHONE_REDACTED]; bank account [BANK_AC_REDACTED]')
    expect(event.user.email).toBe('[redacted]')
    expect(event.user.ip_address).toBe('[redacted]')
    expect(event.user.username).toBe('[redacted]')
    expect(event.user.id).toBe('user-123')
    expect(event.request.url).toContain('[PHONE_REDACTED]')
    expect(event.request.query_string).toBe('[redacted]')
    expect(event.request.cookies).toBe('[redacted]')
    expect(event.request.headers.authorization).toBe('[redacted]')
    expect(event.request.headers.Cookie).toBe('[redacted]')
    expect(event.request.headers['x-request-id']).toBe('safe-request-id')
    expect(event.breadcrumbs[0].message).toBe('Saved phone [PHONE_REDACTED]')
    expect(event.breadcrumbs[0].data.url).toContain('[BANK_AC_REDACTED]')
    expect(event.exception.values[0].value).toBe('Failed for Aadhaar [AADHAAR_REDACTED]')
  })

  it('fails WhatsApp status webhooks closed when the Meta signing secret is unavailable', () => {
    const webhook = read('supabase/functions/whatsapp-webhook/index.ts')

    expect(webhook).toContain('if (!appSecret)')
    expect(webhook).toContain('Webhook signing secret not configured')
    expect(webhook).not.toContain('signature verification disabled')
    expect(webhook).not.toContain('?? "weavly_webhook_verify"')
    expect(webhook).toContain('Webhook verification token not configured')
  })
})
