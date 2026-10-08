import type { HTMLAttributes } from 'react'

export type InputModeAttribute = HTMLAttributes<HTMLInputElement>['inputMode']

/**
 * Pick the on-screen keyboard for a field. A bare `type="number"` makes iOS show its full
 * symbols keyboard, so numeric fields get the decimal pad: digits plus a decimal point, which
 * suits rupee amounts, percentages and kilograms. A field that only ever holds whole numbers
 * (a count, a day of the month) asks for `inputMode="numeric"` itself. `step` is deliberately
 * not consulted: it sets the browser's validation grid, not what the user may need to type.
 * Every non-number type keeps its standard keyboard.
 */
export function resolveInputMode({ type, inputMode }: {
    type?: string
    inputMode?: InputModeAttribute
}): InputModeAttribute {
    if (inputMode) return inputMode
    return type === 'number' ? 'decimal' : undefined
}
