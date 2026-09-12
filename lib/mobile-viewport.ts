/** One viewport observer shared by navigation, dialogs, and floating controls. */
const listeners = new Set<() => void>()
let keyboardVisible = false
let stopObserving: (() => void) | undefined

export const getMobileKeyboardSnapshot = () => keyboardVisible
export const getServerMobileKeyboardSnapshot = () => false

function isEditing() {
    const element = document.activeElement
    if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled
    if (element instanceof HTMLInputElement) {
        return !element.readOnly && !element.disabled && element.inputMode !== 'none'
            && !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'hidden'].includes(element.type)
    }
    return element instanceof HTMLElement && element.isContentEditable
}

function observeViewport() {
    const viewport = window.visualViewport
    const touchDevice = window.matchMedia('(any-pointer: coarse)')
    const root = document.documentElement
    let baselineHeight = Math.max(window.innerHeight, viewport?.height ?? 0)
    let baselineWidth = window.innerWidth
    let frame = 0
    let lastHeight = ''
    let lastTop = ''

    const sync = () => {
        frame = 0
        // Pinch zoom must stay under the user's control, not reflow a dialog
        // or be mistaken for a software keyboard.
        if (viewport && Math.abs(viewport.scale - 1) > 0.05) return

        const height = viewport?.height ?? window.innerHeight
        if (Math.abs(window.innerWidth - baselineWidth) > 80) {
            baselineWidth = window.innerWidth
            baselineHeight = Math.max(window.innerHeight, height)
        }
        const shrunk = baselineHeight - height > 150
        const nextKeyboard = touchDevice.matches && shrunk && (isEditing() || keyboardVisible)
        if (!shrunk && (!isEditing() || height > baselineHeight)) baselineHeight = height

        const nextHeight = `${Math.round(height)}px`
        const nextTop = `${Math.round(viewport?.offsetTop ?? 0)}px`
        if (nextHeight !== lastHeight) root.style.setProperty('--mobile-viewport-height', nextHeight)
        if (nextTop !== lastTop) root.style.setProperty('--mobile-viewport-top', nextTop)
        lastHeight = nextHeight
        lastTop = nextTop

        if (keyboardVisible !== nextKeyboard) {
            keyboardVisible = nextKeyboard
            root.toggleAttribute('data-mobile-keyboard', nextKeyboard)
            listeners.forEach(listener => listener())
        }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync) }

    sync()
    // Focus alone does not hide navigation: tablets may use a hardware keyboard.
    document.addEventListener('focusin', schedule)
    document.addEventListener('focusout', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('pageshow', schedule)
    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', schedule, { passive: true })
    touchDevice.addEventListener('change', schedule)

    return () => {
        cancelAnimationFrame(frame)
        document.removeEventListener('focusin', schedule)
        document.removeEventListener('focusout', schedule)
        window.removeEventListener('resize', schedule)
        window.removeEventListener('pageshow', schedule)
        viewport?.removeEventListener('resize', schedule)
        viewport?.removeEventListener('scroll', schedule)
        touchDevice.removeEventListener('change', schedule)
        root.style.removeProperty('--mobile-viewport-height')
        root.style.removeProperty('--mobile-viewport-top')
        root.removeAttribute('data-mobile-keyboard')
        keyboardVisible = false
    }
}

export function subscribeMobileViewport(listener: () => void) {
    listeners.add(listener)
    if (!stopObserving) stopObserving = observeViewport()
    return () => {
        listeners.delete(listener)
        if (!listeners.size) {
            stopObserving?.()
            stopObserving = undefined
        }
    }
}
