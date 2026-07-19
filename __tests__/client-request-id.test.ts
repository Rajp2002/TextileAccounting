import { describe, expect, it } from 'vitest'
import { createClientRequestUuid } from '../lib/client-request-id'

describe('createClientRequestUuid', () => {
  it('uses a cryptographic UUID when available', () => {
    expect(createClientRequestUuid({ randomUUID: () => 'fixed-id' })).toBe('fixed-id')
  })

  it('creates an RFC 4122 v4 UUID when randomUUID is unavailable', () => {
    const uuid = createClientRequestUuid({
      getRandomValues: array => {
        array.fill(0)
        return array
      },
    })
    expect(uuid).toBe('00000000-0000-4000-8000-000000000000')
  })
})
