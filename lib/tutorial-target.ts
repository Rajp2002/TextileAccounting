/** Rendered targets may be offscreen: the tour scrolls them into view separately. */
export function isTourTargetVisible(element: HTMLElement | null): element is HTMLElement {
    if (!element?.isConnected || !element.getClientRects().length) return false
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
        const style = window.getComputedStyle(node)
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false
    }
    return true
}

export function findTourTarget(selector: string): HTMLElement | null {
    return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isTourTargetVisible) ?? null
}

export function clipTourRect(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>, bounds: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>) {
    const left = Math.max(rect.left, bounds.left)
    const top = Math.max(rect.top, bounds.top)
    const right = Math.min(rect.right, bounds.right)
    const bottom = Math.min(rect.bottom, bounds.bottom)
    return right > left && bottom > top ? { left, top, right, bottom, width: right - left, height: bottom - top } : null
}
