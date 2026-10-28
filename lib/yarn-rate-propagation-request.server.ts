import 'server-only'
import crypto from 'crypto'

/**
 * Same save, same id: a second click or a retry replays the original version
 * instead of creating another. UUID-shaped like the initial-quality ids.
 * Server-only because it uses Node crypto.
 */
export function buildPropagationRequestId(sourceQuoteId: string, rateId: string, newRate: number): string {
    const hex = crypto
        .createHash('sha256')
        .update(`yarn-rate-propagation:${sourceQuoteId}:${rateId}:${newRate.toFixed(6)}`)
        .digest('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/**
 * The same for bringing a costing to the Rate Book's rates: keyed on the source
 * version and every layer's new rate, so a retry of the same update replays.
 */
export function buildRateBookUpdateRequestId(sourceQuoteId: string, changes: readonly { layer: string; index: number; to: number }[]): string {
    const key = changes.map(change => `${change.layer}${change.index}=${change.to.toFixed(6)}`).join(',')
    const hex = crypto
        .createHash('sha256')
        .update(`rate-book-update:${sourceQuoteId}:${key}`)
        .digest('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
