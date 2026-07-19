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
 * `crypto.randomUUID()` is unavailable on some plain-LAN HTTP origins, such
 * as a physical phone testing a local development server. Prefer Web Crypto
 * bytes and retain a legacy fallback so Save remains functional there.
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
