import { describe, expect, it } from 'vitest'
import { parseNumericInput, parseNonNegativeInput } from '../lib/numeric-input'

describe('LST-10 & LST-11: WCAG 2.2 AA & Numeric Input Hardening', () => {
  it('correctly parses valid positive integers and decimals', () => {
    expect(parseNumericInput('100')).toBe(100)
    expect(parseNumericInput('75.5')).toBe(75.5)
    expect(parseNumericInput('  0.28  ')).toBe(0.28)
    expect(parseNonNegativeInput('0')).toBe(0)
  })

  it('safely handles empty, blank, NaN, and infinite inputs without polluting state', () => {
    expect(parseNumericInput('')).toBeNull()
    expect(parseNumericInput('   ')).toBeNull()
    expect(parseNumericInput('abc')).toBeNull()
    expect(parseNumericInput('Infinity')).toBeNull()
    expect(parseNumericInput('-Infinity')).toBeNull()
    expect(parseNumericInput('NaN')).toBeNull()
  })

  it('strictly enforces min bounds and non-negative constraints', () => {
    expect(parseNumericInput('-5', { min: 0 })).toBeNull()
    expect(parseNonNegativeInput('-1')).toBeNull()
    expect(parseNumericInput('5', { min: 10 })).toBeNull()
    expect(parseNumericInput('10', { min: 10 })).toBe(10)
  })
})
