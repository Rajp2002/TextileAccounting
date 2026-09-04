export type EstimatorPlaceholderKind = 'example' | 'applied-default'

/**
 * Keep empty estimator controls unambiguous: examples are prefixed so they
 * cannot be mistaken for entered data, while applied defaults retain their
 * plain value and can use the estimator's saffron emphasis.
 */
export function formatEstimatorPlaceholder(
    value: string | number | null | undefined,
    kind: EstimatorPlaceholderKind = 'example',
) {
    const text = String(value ?? '').trim()
    if (!text || kind === 'applied-default') return text
    return /^e\.?\s*g\.?\s+/i.test(text) ? text : `e.g. ${text}`
}
