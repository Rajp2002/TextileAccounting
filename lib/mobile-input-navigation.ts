import { DEFAULT_INPUT_SELECTOR, findNavigableFormInputs, focusAndSelectInput, keepFieldInVisibleViewport } from './form-navigation'

const SCOPE_SELECTOR = '[data-enter-navigate-container], form, [role="dialog"], main'
const INPUT_SELECTOR = `${DEFAULT_INPUT_SELECTOR}:not([type="range"]):not([type="color"]):not([type="image"]):not([inputmode="none"])`
// A collapsed section whose fields mount only when opened (a yarn row on a phone)
// is a stop in the flow, so Next does not skip every field inside it.
const COLLAPSED_SECTION_SELECTOR = 'button[data-input-flow-expand][aria-expanded="false"]'

export function getMobileInputNavigation(input: HTMLInputElement) {
    const container = input.closest<HTMLElement>(SCOPE_SELECTOR)
    if (!container || !input.matches(INPUT_SELECTOR)) return null
    // Keep a dialog or a separate form from becoming part of another form's flow.
    const fields = findNavigableFormInputs(container, `${INPUT_SELECTOR}, ${COLLAPSED_SECTION_SELECTOR}`).filter(field =>
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

const isCollapsedSection = (element: HTMLElement) => element.getAttribute('data-input-flow-expand') !== null

/**
 * The iPhone's own ∨ cannot open a collapsed row, so open the row that comes next while the
 * user is on the field before it. It opens below the field, so nothing on screen moves.
 */
export function openNextCollapsedSection(input: HTMLInputElement) {
    const next = getMobileInputNavigation(input)?.next
    if (!next || !isCollapsedSection(next)) return false
    next.click()
    return true
}

/**
 * Re-read the live form on every tap, so added/removed rows never leave stale targets.
 * `expand` must open a collapsed section synchronously (flushSync) so its field can be
 * focused inside the same tap.
 */
export function moveMobileInput(
    input: HTMLInputElement,
    direction: 'previous' | 'next',
    expand: (toggle: HTMLElement) => void = toggle => toggle.click(),
) {
    let target = getMobileInputNavigation(input)?.[direction]
    if (!target) return false
    if (isCollapsedSection(target)) {
        const regionId = target.getAttribute('aria-controls')
        expand(target)
        const fields = findNavigableFormInputs(regionId ? document.getElementById(regionId) : null, INPUT_SELECTOR)
        const field = direction === 'next' ? fields[0] : fields[fields.length - 1]
        // The section opened, but it has nothing to type into; stay on the current field.
        if (!field) return true
        target = field
    }
    // Keep focus inside the trusted tap event: iOS can then keep its keyboard open.
    focusAndSelectInput(target, { scrollOptions: { behavior: 'auto', block: 'center', inline: 'nearest' } })
    keepMobileInputVisible(target)
    return true
}

/** Keep the field above the accessory, including inside a scroll-locked dialog. */
export const keepMobileInputVisible = keepFieldInVisibleViewport
