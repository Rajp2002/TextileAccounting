import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { redactSensitiveText } from '../lib/sentry-redaction'

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

  it('fails WhatsApp status webhooks closed when the Meta signing secret is unavailable', () => {
    const webhook = read('supabase/functions/whatsapp-webhook/index.ts')

    expect(webhook).toContain('if (!appSecret)')
    expect(webhook).toContain('Webhook signing secret not configured')
    expect(webhook).not.toContain('signature verification disabled')
  })
})
