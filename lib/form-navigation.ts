/**
 * Form Navigation Engine for Keyboard-First Data Entry
 *
 * Provides seamless Enter / Shift+Enter navigation across form inputs,
 * automatic text selection, and comfortable viewport auto-scrolling.
 */

export interface EnterKeyNavigationOptions {
    /**
     * Root container element to search for inputs.
     * Defaults to the event's currentTarget, the closest `[data-enter-navigate-container]`,
     * the closest `form`, or document.body.
     */
    container?: HTMLElement | null
    /**
     * Custom CSS selector to find focusable inputs.
     * Default selects all editable, non-hidden input elements.
     */
    selector?: string
    /**
     * Whether to automatically select the content of the focused input.
     * Default: true.
     */
    autoSelect?: boolean
    /**
     * Options passed to `scrollIntoView`.
     * Default: { behavior: 'smooth', block: 'nearest', inline: 'nearest' }.
     */
    scrollOptions?: ScrollIntoViewOptions
    /**
     * Whether Shift+Enter navigates to the previous field.
     * Default: true.
     */
    allowShiftPrev?: boolean
    /**
     * Whether to loop back to the first field after the last field.
     * Default: false.
     */
    loop?: boolean
    /**
     * Callback called when navigation completes.
     */
    onNavigate?: (nextElement: HTMLElement, prevElement: HTMLElement) => void
}

export const DEFAULT_INPUT_SELECTOR =
    'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([disabled]):not([readonly])'

function isHtmlElement(el: unknown): el is HTMLElement {
    if (!el || typeof el !== 'object') return false
    if (typeof HTMLElement !== 'undefined') {
        return el instanceof HTMLElement
    }
    return 'tagName' in el && typeof el.tagName === 'string'
}

function isInputElement(el: unknown): el is HTMLInputElement {
    if (!el || typeof el !== 'object') return false
    if (typeof HTMLInputElement !== 'undefined') {
        return el instanceof HTMLInputElement
    }
    return isHtmlElement(el) && el.tagName.toUpperCase() === 'INPUT'
}

function isTextAreaElement(el: unknown): el is HTMLTextAreaElement {
    if (!el || typeof el !== 'object') return false
    if (typeof HTMLTextAreaElement !== 'undefined') {
        return el instanceof HTMLTextAreaElement
    }
    return isHtmlElement(el) && el.tagName.toUpperCase() === 'TEXTAREA'
}

/**
 * Checks if an element is visible and interactive in the document.
 */
export function isElementNavigable(el: Element): el is HTMLElement {
    if (!isHtmlElement(el)) return false
    if ((el as HTMLInputElement).disabled) return false
    if ((el as HTMLInputElement).readOnly) return false
    if (el.tabIndex != null && el.tabIndex < 0) return false
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false
    if (el.getAttribute && el.getAttribute('data-prevent-enter-nav') === 'true') return false

    // Check visibility in browser environment
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        try {
            const style = window.getComputedStyle(el)
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false
            }
        } catch {
            // Ignore style computation errors on detached / mock elements
        }
    }

    // In DOM environment with layout, check bounding rects
    if (typeof el.getClientRects === 'function') {
        try {
            const rects = el.getClientRects()
            if (rects.length === 0 && el.offsetWidth === 0 && el.offsetHeight === 0) {
                if (el.offsetParent === null && el.tagName?.toUpperCase() !== 'BODY') {
                    return false
                }
            }
        } catch {
            // Ignore rect errors on mock elements
        }
    }

    return true
}

/**
 * Finds all navigable inputs within a root element in DOM order.
 */
export function findNavigableFormInputs(
    root: HTMLElement | Document | null = typeof document !== 'undefined' ? document : null,
    selector = DEFAULT_INPUT_SELECTOR
): HTMLElement[] {
    if (!root || typeof root.querySelectorAll !== 'function') return []
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector))
    return candidates.filter(isElementNavigable)
}

/**
 * iOS WebKit (Safari, home-screen apps and every iOS browser) shows its own ∧ ∨ ✓ bar above
 * the keyboard, which no page can remove, and scrolls each focused field into view above it,
 * ignoring preventScroll. `-webkit-touch-callout` is supported only there.
 */
export function hasIosFieldBar() {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('-webkit-touch-callout', 'none')
}

/**
 * Keeps a field inside the visible viewport, clear of a sticky header above and the
 * keyboard's field bar below, scrolling a scroll-locked dialog rather than the page.
 */
export function keepFieldInVisibleViewport(field: HTMLElement) {
    if (typeof window === 'undefined' || !field.isConnected || !field.getBoundingClientRect) return
    const viewport = window.visualViewport
    if (viewport && Math.abs(viewport.scale - 1) > 0.05) return
    const top = (viewport?.offsetTop ?? 0) + 72
    const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 80
    const rect = field.getBoundingClientRect()
    const delta = rect.bottom > bottom ? rect.bottom - bottom : rect.top < top ? rect.top - top : 0
    if (!delta) return
    let parent = field.parentElement
    while (parent && parent !== document.body) {
        if (/(auto|scroll)/.test(window.getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) {
            parent.scrollBy({ top: delta, behavior: 'auto' })
            return
        }
        parent = parent.parentElement
    }
    window.scrollBy({ top: delta, behavior: 'auto' })
}

/**
 * Comfortably brings an element into view, ensuring clearance from top/bottom bars.
 */
export function scrollInputIntoComfortableView(
    element: HTMLElement,
    scrollOptions?: ScrollIntoViewOptions
) {
    if (!element) return

    // iOS has already scrolled the field above its own bar; a second scroll fights it.
    if (hasIosFieldBar()) return

    // A phone's keyboard covers the lower part of the layout viewport, so centring a
    // section there hides the field being typed into. Move only as far as needed.
    if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) {
        keepFieldInVisibleViewport(element)
        return
    }

    const sectionTarget = typeof element.closest === 'function'
        ? element.closest<HTMLElement>('[data-enter-scroll-target]')
        : null
    // A tall section cannot be fully visible (particularly with a mobile keyboard).
    // In that case keep the field itself at the centre of the usable viewport.
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null
    const viewportHeight = typeof window !== 'undefined'
        ? viewport?.height ?? window.innerHeight
        : 0
    const oversizedSection = Boolean(sectionTarget && viewportHeight > 0 &&
        sectionTarget.getBoundingClientRect().height > viewportHeight - 160)
    const scrollTarget = oversizedSection ? element : sectionTarget ?? element
    if (typeof scrollTarget.scrollIntoView !== 'function') return

    const resolvedScrollOptions: ScrollIntoViewOptions = sectionTarget
        ? { behavior: 'smooth', block: 'center', inline: 'nearest', ...scrollOptions }
        : { behavior: 'smooth', block: 'nearest', inline: 'nearest', ...scrollOptions }

    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        resolvedScrollOptions.behavior = 'auto'
    }

    scrollTarget.scrollIntoView(resolvedScrollOptions)

    // A marked section is intentionally centered as a whole so its surrounding
    // context and lower fields remain visible after keyboard navigation.
    if (sectionTarget) return

    // Check if element is too close to sticky navigation headers on desktop / mobile
    if (typeof window !== 'undefined' && typeof element.getBoundingClientRect === 'function') {
        try {
            const rect = element.getBoundingClientRect()
            const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0
            const topMargin = 72 // sticky header allowance
            const bottomMargin = 80 // mobile bottom bar allowance

            if (viewportHeight > 0) {
                if (rect.top < topMargin) {
                    window.scrollBy({
                        top: rect.top - topMargin,
                        behavior: resolvedScrollOptions.behavior ?? 'smooth',
                    })
                } else if (rect.bottom > viewportHeight - bottomMargin) {
                    window.scrollBy({
                        top: rect.bottom - (viewportHeight - bottomMargin),
                        behavior: resolvedScrollOptions.behavior ?? 'smooth',
                    })
                }
            }
        } catch {
            // Ignore scroll errors in unsupported environments
        }
    }
}

/**
 * Focuses an element, selects its text if applicable, and scrolls it into view.
 */
export function focusAndSelectInput(
    element: HTMLElement,
    options: { autoSelect?: boolean; scrollOptions?: ScrollIntoViewOptions } = {}
) {
    const { autoSelect = true, scrollOptions } = options
    if (!element) return

    if (typeof element.focus === 'function') {
        // iOS reveals the field itself; elsewhere the scroll below places it.
        element.focus({ preventScroll: !hasIosFieldBar() })
    }

    if (autoSelect && (isInputElement(element) || isTextAreaElement(element))) {
        try {
            if (typeof element.select === 'function') {
                element.select()
            }
        } catch {
            // Some input types (e.g. date/time in certain browsers) may not support select()
        }
    }

    scrollInputIntoComfortableView(element, scrollOptions)
}

/**
 * Handles Enter and Shift+Enter key events on input elements to move focus to the next/previous field.
 *
 * @returns boolean `true` if navigation was handled, `false` otherwise.
 */
export function handleEnterKeyNavigation(
    event: React.KeyboardEvent<HTMLElement> | KeyboardEvent,
    options: EnterKeyNavigationOptions = {}
): boolean {
    if (!event || event.key !== 'Enter') return false

    // Ignore composition events (e.g. IME language input)
    const isComposing =
        ('nativeEvent' in event && event.nativeEvent.isComposing) ||
        ('isComposing' in event && event.isComposing)
    if (isComposing) return false

    // Ignore if default already prevented
    if (event.defaultPrevented) return false

    const target = (event.target || event.currentTarget) as HTMLElement | null
    if (!isHtmlElement(target)) return false

    // Do not intercept Enter on textareas (allows newlines) unless explicitly enabled
    if (target.tagName?.toUpperCase() === 'TEXTAREA') return false

    // Do not intercept on buttons, links, or file inputs
    if (target.tagName?.toUpperCase() === 'BUTTON') return false
    if (isInputElement(target)) {
        const type = (target.type || 'text').toLowerCase()
        if (['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image'].includes(type)) {
            return false
        }
    }

    if (target.getAttribute && target.getAttribute('data-prevent-enter-nav') === 'true') return false

    const {
        container: customContainer,
        selector = DEFAULT_INPUT_SELECTOR,
        autoSelect = true,
        scrollOptions,
        allowShiftPrev = true,
        loop = false,
        onNavigate,
    } = options

    const container =
        customContainer ||
        (isHtmlElement(event.currentTarget) && event.currentTarget !== target
            ? (event.currentTarget as HTMLElement)
            : null) ||
        (typeof target.closest === 'function'
            ? target.closest<HTMLElement>('[data-enter-navigate-container]') ||
              target.closest<HTMLElement>('form')
            : null) ||
        (typeof document !== 'undefined' ? document.body : null)

    if (!container) return false

    const inputs = findNavigableFormInputs(container, selector)
    if (inputs.length === 0) return false

    const currentIndex = inputs.indexOf(target)
    if (currentIndex === -1) return false

    const isShift = Boolean(event.shiftKey && allowShiftPrev)
    let nextIndex = isShift ? currentIndex - 1 : currentIndex + 1

    if (loop) {
        if (nextIndex < 0) nextIndex = inputs.length - 1
        if (nextIndex >= inputs.length) nextIndex = 0
    }

    if (nextIndex >= 0 && nextIndex < inputs.length) {
        if (typeof event.preventDefault === 'function') {
            event.preventDefault()
        }
        const nextInput = inputs[nextIndex]
        focusAndSelectInput(nextInput, { autoSelect, scrollOptions })
        onNavigate?.(nextInput, target)
        return true
    }

    return false
}
