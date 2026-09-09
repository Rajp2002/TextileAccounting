/** Node-only primitives for the future authenticated Free calculation service. */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

type Keyring = Readonly<Record<string, string>>
export type FreeRequestIdentity = {
  version: 1
  keyId: string
  subjectId: string
  requestId: string
  engineVersion: string
  issuedAt: string
  expiresAt: string
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LIFETIME_MS = 30 * 86400000

function keyFor(keys: Keyring, id: string): string {
  const key = Object.hasOwn(keys, id) ? keys[id] : undefined
  if (!key || Buffer.byteLength(key) < 32) throw new Error('FREE_SIGNING_KEY_UNAVAILABLE')
  return key
}
function mac(key: string, domain: string, payload: string) {
  return createHmac('sha256', key).update(domain).update('\0').update(payload).digest()
}

/** Keep the returned token in page memory. Issuance requires authenticated grant resolution. */
export function issueFreeRequest(input: {
  subjectId: string; engineVersion: string; keyId: string; keys: Keyring
  serverTime: Date; lifetimeMs: number
}): string {
  if (!UUID.test(input.subjectId) || !input.engineVersion || input.engineVersion.length > 80
    || !Number.isFinite(input.serverTime.getTime()) || !Number.isSafeInteger(input.lifetimeMs)
    || input.lifetimeMs <= 0 || input.lifetimeMs > MAX_LIFETIME_MS) throw new Error('FREE_INVALID_REQUEST')
  const identity: FreeRequestIdentity = {
    version: 1, keyId: input.keyId, subjectId: input.subjectId, requestId: randomUUID(),
    engineVersion: input.engineVersion, issuedAt: input.serverTime.toISOString(),
    expiresAt: new Date(input.serverTime.getTime() + input.lifetimeMs).toISOString(),
  }
  const payload = Buffer.from(JSON.stringify(identity)).toString('base64url')
  return `${payload}.${mac(keyFor(input.keys, input.keyId), 'weavly-free-request-v1', payload).toString('base64url')}`
}

export function verifyFreeRequest(token: string, expected: {
  subjectId: string; engineVersion: string; keys: Keyring; serverTime: Date
}): FreeRequestIdentity {
  try {
    if (token.length > 2048) throw new Error()
    const parts = token.split('.')
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error()
    const identity = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as FreeRequestIdentity
    const provided = Buffer.from(parts[1], 'base64url')
    const expectedMac = mac(keyFor(expected.keys, identity.keyId), 'weavly-free-request-v1', parts[0])
    if (provided.length !== expectedMac.length || !timingSafeEqual(provided, expectedMac)) throw new Error()
    const issued = Date.parse(identity.issuedAt), expires = Date.parse(identity.expiresAt)
    const now = expected.serverTime.getTime()
    if (identity.version !== 1 || identity.subjectId !== expected.subjectId
      || identity.engineVersion !== expected.engineVersion || !UUID.test(identity.requestId)
      || !Number.isFinite(issued) || !Number.isFinite(expires) || !Number.isFinite(now)
      || issued > now || expires <= now || expires <= issued || expires - issued > MAX_LIFETIME_MS) throw new Error()
    return identity
  } catch {
    // Never include the submitted token, payload, inputs, or signature in errors.
    throw new Error('FREE_REQUEST_INVALID_OR_EXPIRED')
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  throw new Error('FREE_INPUT_BINDING_INVALID')
}

/** Caller must first normalize/validate effective engine inputs; omit UI-only state. */
export function bindFreeEffectiveInputs(identity: FreeRequestIdentity, effectiveInputs: unknown, keys: Keyring): string {
  return mac(keyFor(keys, identity.keyId), 'weavly-free-effective-input-v1', canonicalJson({
    subjectId: identity.subjectId, engineVersion: identity.engineVersion, effectiveInputs,
  })).toString('hex')
}
