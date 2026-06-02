export const TRACKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{12,64}$/

export function normalizeTrackingToken(token: string): string {
    return token.trim()
}

export function isValidTrackingToken(token: string): boolean {
    return TRACKING_TOKEN_PATTERN.test(normalizeTrackingToken(token))
}
