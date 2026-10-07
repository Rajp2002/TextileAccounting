import type { MouseEvent, PointerEvent } from 'react'

type SelectableField = HTMLInputElement | HTMLTextAreaElement

const tappedFields = new WeakSet<SelectableField>()

/**
 * Keep a pressed field's value selected so typing replaces it (1 then 2 gives 2, not 12).
 * A mouse focuses at once, before its click can collapse the selection. A finger is
 * left to the browser, which focuses only on a completed tap: focusing on touch-down
 * would open the keyboard for every scroll that happens to start on a field.
 */
export function focusFieldOnPress(event: PointerEvent<SelectableField>) {
    const field = event.currentTarget
    tappedFields.delete(field)
    if (field === document.activeElement) return
    if (event.pointerType !== 'mouse') {
        tappedFields.add(field)
        return
    }
    event.preventDefault()
    field.focus()
    field.select()
}

/** The tap that focused a field also placed the caret; select the value again after it. */
export function selectFieldAfterTap(event: MouseEvent<SelectableField>) {
    if (tappedFields.delete(event.currentTarget)) event.currentTarget.select()
}
