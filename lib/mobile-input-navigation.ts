import { DEFAULT_INPUT_SELECTOR, findNavigableFormInputs, focusAndSelectInput } from './form-navigation'

const SCOPE_SELECTOR = '[data-enter-navigate-container], form, [role="dialog"], main'
const INPUT_SELECTOR = `${DEFAULT_INPUT_SELECTOR}:not([type="range"]):not([type="color"]):not([type="image"]):not([inputmode="none"])`

export function getMobileInputNavigation(input: HTMLInputElement) {
    const container = input.closest<HTMLElement>(SCOPE_SELECTOR)
    if (!container || !input.matches(INPUT_SELECTOR)) return null
    // Keep a dialog or a separate form from becoming part of another form's flow.
    const fields = findNavigableFormInputs(container, INPUT_SELECTOR).filter(field =>
        field.closest(SCOPE_SELECTOR) === container
        && !field.closest('[inert], [hidden], [aria-hidden="true"], fieldset:disabled')
    )
    const index = fields.indexOf(input)
    if (index < 0) return null
    return {
        container,
        previous: fields[index - 1] ?? null,
        next: fields[index + 1] ?? null,
    }
}

/** Re-read the live form on every tap, so added/removed rows never leave stale targets. */
export function moveMobileInput(input: HTMLInputElement, direction: 'previous' | 'next') {
    const target = getMobileInputNavigation(input)?.[direction]
    if (!target) return false
    // Keep focus inside the trusted tap event: iOS can then keep its keyboard open.
    focusAndSelectInput(target, { scrollOptions: { behavior: 'auto', block: 'center', inline: 'nearest' } })
    keepMobileInputVisible(target)
    return true
}

/** Keep the field above the accessory, including inside a scroll-locked dialog. */
export function keepMobileInputVisible(input: HTMLElement) {
    if (typeof window === 'undefined' || !input.isConnected || !input.getBoundingClientRect) return
    const viewport = window.visualViewport
    if (viewport && Math.abs(viewport.scale - 1) > 0.05) return
    const top = (viewport?.offsetTop ?? 0) + 72
    const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 80
    const rect = input.getBoundingClientRect()
    const delta = rect.bottom > bottom ? rect.bottom - bottom : rect.top < top ? rect.top - top : 0
    if (!delta) return
    let parent = input.parentElement
    while (parent && parent !== document.body) {
        if (/(auto|scroll)/.test(window.getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) {
            parent.scrollBy({ top: delta, behavior: 'auto' })
            return
        }
        parent = parent.parentElement
    }
    window.scrollBy({ top: delta, behavior: 'auto' })
}
