type BrowserRandomSource = {
  randomUUID?: () => string
  getRandomValues?: (array: Uint8Array) => Uint8Array
}

function fillWithMathRandom(bytes: Uint8Array) {
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256)
  }
}

/**
 * Creates an RFC 4122 version-4 UUID for client-side idempotency.
 *
 * `crypto.randomUUID()` is unavailable in browsers served from a plain LAN
 * HTTP origin (for example, a physical phone opening 192.168.x.x). Web Crypto
 * still exposes `getRandomValues()` in those contexts, so use it to preserve a
 * valid UUID and fall back to non-security-sensitive PRNG bytes only for older
 * browser engines.
 */
export function createClientRequestUuid(
  randomSource: BrowserRandomSource | undefined = globalThis.crypto
): string {
  if (typeof randomSource?.randomUUID === 'function') {
    try {
      return randomSource.randomUUID()
    } catch {
      // Some engines expose the method but reject it outside a secure context.
    }
  }

  const bytes = new Uint8Array(16)
  if (typeof randomSource?.getRandomValues === 'function') {
    try {
      randomSource.getRandomValues(bytes)
    } catch {
      fillWithMathRandom(bytes)
    }
  } else {
    fillWithMathRandom(bytes)
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}
