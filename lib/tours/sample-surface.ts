/**
 * Props that make a REAL dialog or sheet safe to show while a tour teaches it.
 *
 * A Radix modal traps focus and blocks pointer events outside itself, which would lock the tour card. So during
 * a tour the surface is non-modal, has no close control or overlay of its own (the tour draws the backdrop), and
 * ignores every dismissal and autofocus. It keeps its regular size and position: the tour card adapts to it.
 *
 * `data-tour-surface` is the one selector every tour uses as a step's `context`.
 *
 *   <Dialog open={open} {...surface.root}>
 *     <DialogContent {...surface.content} className="...">
 */
export function tourSurfaceProps(active: boolean) {
    if (!active) return { root: {}, content: {} }
    const stop = (event: Event) => event.preventDefault()
    return {
        root: { modal: false as const },
        content: {
            'data-tour-surface': 'true',
            showCloseButton: false,
            hideOverlay: true,
            onPointerDownOutside: stop,
            onInteractOutside: stop,
            onEscapeKeyDown: stop,
            onOpenAutoFocus: stop,
            onCloseAutoFocus: stop,
        },
    }
}

/** Selector for the open tour surface. Dialog steps use it as the step `context`. */
export const TOUR_SURFACE_SELECTOR = '[data-tour-surface="true"]'
