/** Block user-driven page scrolling without blocking the tour's programmatic scrolls. */
export function lockTourViewport(panel: HTMLElement) {
    let touchY: number | null = null
    const description = () => panel.querySelector<HTMLElement>('[data-tour-description-scroll]')
    const canScrollDescription = (target: EventTarget | null, delta: number) => {
        const area = description()
        if (!(target instanceof Node) || !area?.contains(target)) return false
        if (delta < 0) return area.scrollTop > 0
        if (delta > 0) return area.scrollTop + area.clientHeight < area.scrollHeight - 1
        return false
    }
    const wheel = (event: WheelEvent) => {
        // Keep browser zoom accessible.
        if (event.ctrlKey) return
        if (!canScrollDescription(event.target, event.deltaY)) event.preventDefault()
    }
    const touchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? null }
    const touchMove = (event: TouchEvent) => {
        if (event.touches.length > 1) return // Preserve pinch zoom.
        const nextY = event.touches[0]?.clientY ?? null
        const delta = touchY === null || nextY === null ? 0 : touchY - nextY
        touchY = nextY
        if (!canScrollDescription(event.target, delta)) event.preventDefault()
    }
    const keydown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return
        // Space must still activate Next, Back and Skip.
        if (event.key === ' ' && event.target instanceof Element && event.target.closest('button')) return
        event.preventDefault()
        const area = description()
        if (!area) return
        const page = Math.max(40, area.clientHeight - 24)
        const delta = event.key === 'Home' ? -area.scrollHeight
            : event.key === 'End' ? area.scrollHeight
            : event.key === 'ArrowUp' ? -40
            : event.key === 'ArrowDown' ? 40
            : event.key === 'PageUp' || (event.key === ' ' && event.shiftKey) ? -page : page
        area.scrollBy({ top: delta, behavior: 'instant' })
    }
    const blocking = { passive: false, capture: true }
    document.addEventListener('wheel', wheel, blocking)
    document.addEventListener('touchstart', touchStart, { passive: true, capture: true })
    document.addEventListener('touchmove', touchMove, blocking)
    document.addEventListener('keydown', keydown, true)
    return () => {
        document.removeEventListener('wheel', wheel, true)
        document.removeEventListener('touchstart', touchStart, true)
        document.removeEventListener('touchmove', touchMove, true)
        document.removeEventListener('keydown', keydown, true)
    }
}
