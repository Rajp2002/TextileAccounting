/** Email is a sign-in restriction, never a replacement for the UUID grant. */
const APPROVED_FOUNDER_EMAIL = 'rajpatel86420@gmail.com'

export function founderEmailAllowed(value: unknown): boolean {
    // Synthetic tests cannot accidentally change a development/production
    // allowlist. Do not normalize Gmail dots, aliases or plus addresses.
    const fixture = process.env.NODE_ENV === 'test' ? process.env.WEAVLY_FOUNDER_TEST_EMAIL : undefined
    const expected = fixture && /^[^\s@]+@[^\s@]+\.(invalid|test)$/.test(fixture) ? fixture : APPROVED_FOUNDER_EMAIL
    return typeof value === 'string' && value.trim().toLowerCase() === expected
}
