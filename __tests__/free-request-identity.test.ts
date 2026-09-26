import { describe, expect, it } from 'vitest'
import { bindFreeEffectiveInputs, issueFreeRequest, resolveFreeSigningKeys, verifyFreeRequest } from '../lib/free-request-identity'
const keys = { launch: 'test-only-key-at-least-thirty-two-bytes-long' }
const subjectId = 'a0000000-0000-4000-8000-000000000001'
const serverTime = new Date('2026-09-08T18:00:00Z')
const engineVersion = 'estimator_v3_2026_08'
const expected = { subjectId, engineVersion, keys, serverTime }
const issue = () => issueFreeRequest({ ...expected, keyId: 'launch', lifetimeMs: 30 * 86400000 })

describe('Free in-memory request identities', () => {
  it('issues unique opaque request IDs with a protected issuance time', () => {
    const first = verifyFreeRequest(issue(), expected)
    const second = verifyFreeRequest(issue(), expected)
    expect(first.requestId).not.toBe(second.requestId)
    expect(first.issuedAt).toBe(serverTime.toISOString())
  })
  it('rejects tampering, other subjects, engine changes and unavailable signing keys', () => {
    const token = issue()
    const [payload, signature] = token.split('.')
    expect(() => verifyFreeRequest(`${payload}.${signature.slice(0, -4)}AAAA`, expected)).toThrow('FREE_REQUEST_INVALID_OR_EXPIRED')
    expect(() => verifyFreeRequest(token, { ...expected, subjectId: 'b0000000-0000-4000-8000-000000000002' })).toThrow()
    expect(() => verifyFreeRequest(token, { ...expected, engineVersion: 'different-engine' })).toThrow()
    expect(() => verifyFreeRequest(token, { ...expected, keys: {} })).toThrow()
  })
  it('supports original-key retries across a month boundary, but not past expiry', () => {
    const token = issue()
    expect(verifyFreeRequest(token, { ...expected, serverTime: new Date('2026-09-14T00:00:00Z'), keys: { ...keys, rotated: 'another-test-only-key-at-least-thirty-two-bytes' } }).subjectId).toBe(subjectId)
    expect(() => verifyFreeRequest(token, { ...expected, serverTime: new Date('2026-10-08T18:00:00Z') })).toThrow()
    expect(() => verifyFreeRequest(token, { ...expected, serverTime: new Date('2026-09-08T17:59:59Z') })).toThrow()
  })
  it('rejects unsafe key lengths and receipt lifetimes', () => {
    for (const lifetimeMs of [0, -1, NaN, 31 * 86400000]) {
      expect(() => issueFreeRequest({ ...expected, keyId: 'launch', lifetimeMs })).toThrow()
    }
    expect(() => issueFreeRequest({ ...expected, keys: { launch: 'short' }, keyId: 'launch', lifetimeMs: 1000 })).toThrow()
  })
  it('uses a keyed account-scoped canonical binding without storing content', () => {
    const identity = verifyFreeRequest(issue(), expected)
    const binding = bindFreeEffectiveInputs(identity, { rate: 100, density: 75 }, keys)
    expect(binding).toMatch(/^[a-f0-9]{64}$/)
    expect(bindFreeEffectiveInputs(identity, { density: 75, rate: 100 }, keys)).toBe(binding)
    expect(bindFreeEffectiveInputs(identity, { density: 75, rate: 101 }, keys)).not.toBe(binding)
    expect(bindFreeEffectiveInputs({ ...identity, subjectId: 'other' }, { rate: 100, density: 75 }, keys)).not.toBe(binding)
    expect(() => bindFreeEffectiveInputs(identity, { rate: NaN }, keys)).toThrow('FREE_INPUT_BINDING_INVALID')
  })
})

// Fix package F2 (CS-3): production used to fall back to a key written in the
// source, so anyone with the repository could mint Free request tokens.
describe('Free signing keyring (CS-3 fixed)', () => {
  const strong = 'k'.repeat(32)
  it('INVARIANT: production refuses a missing, unparseable or short active key', () => {
    const invalid = [undefined, '', 'not json', '"a string"', '[]', '{}', JSON.stringify({ launch: 'k'.repeat(31) }), JSON.stringify({ launch: 42 }), JSON.stringify({ other: strong })]
    for (const WEAVLY_FREE_SIGNING_KEYS of invalid) {
      expect(() => resolveFreeSigningKeys({ NODE_ENV: 'production', WEAVLY_FREE_SIGNING_KEYS })).toThrow('FREE_SIGNING_KEY_UNAVAILABLE')
    }
    expect(() => resolveFreeSigningKeys({ NODE_ENV: 'production', WEAVLY_FREE_SIGNING_KEY_ID: 'next', WEAVLY_FREE_SIGNING_KEYS: JSON.stringify({ launch: strong }) }))
      .toThrow('FREE_SIGNING_KEY_UNAVAILABLE')
  })
  it('INVARIANT: production signs with the configured key and keeps older keys for verification', () => {
    const configured = { launch: strong, next: 'n'.repeat(40) }
    expect(resolveFreeSigningKeys({ NODE_ENV: 'production', WEAVLY_FREE_SIGNING_KEY_ID: 'next', WEAVLY_FREE_SIGNING_KEYS: JSON.stringify(configured) }))
      .toEqual({ keyId: 'next', keys: configured })
    expect(resolveFreeSigningKeys({ NODE_ENV: 'production', WEAVLY_FREE_SIGNING_KEYS: JSON.stringify({ launch: strong }) }))
      .toEqual({ keyId: 'launch', keys: { launch: strong } })
  })
  it('CHARACTERIZATION: outside production a built-in key is used only when none is configured', () => {
    const fallback = resolveFreeSigningKeys({ NODE_ENV: 'development' })
    expect(fallback.keyId).toBe('launch')
    expect(Buffer.byteLength(fallback.keys.launch)).toBeGreaterThanOrEqual(32)
    expect(resolveFreeSigningKeys({ NODE_ENV: 'test', WEAVLY_FREE_SIGNING_KEYS: JSON.stringify({ launch: strong }) }).keys).toEqual({ launch: strong })
  })
})
