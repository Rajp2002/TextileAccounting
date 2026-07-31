/**
 * Parse a browser numeric input without allowing NaN, Infinity, or a value
 * below the field's lower bound to enter estimator state. Blank input remains
 * null so required-field validation can distinguish it from zero.
 */
export function parseNumericInput(raw: string, options: { min?: number } = {}): number | null {
  if (raw.trim() === '') return null

  const value = Number(raw)
  const min = options.min ?? 0
  if (!Number.isFinite(value) || value < min) return null

  return value
}

export function parseNonNegativeInput(raw: string): number | null {
  return parseNumericInput(raw, { min: 0 })
}
