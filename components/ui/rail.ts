/**
 * Shared presentation for route guidance and route actions (see "Workspace
 * composition" in app/globals.css). The pages once pinned these to side rails;
 * the names stayed when the rails went. The Guide modal, page toolbars and page
 * headers use these strings so guidance reads as one quiet family: a hairline
 * surface, ink text, and saffron kept for the small brand accent on the icon.
 */

/** A single quiet surface: the tour card, a toolbar card, a notice. */
export const railSurface = 'rounded-xl border border-hairline bg-surface/95 shadow-xs'

/** A full-width secondary control in a list (Guide topics, walkthroughs, reference). */
export const railButton = 'group flex min-h-11 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-hairline bg-surface/95 px-3.5 py-2.5 text-left text-sm font-semibold text-ink shadow-xs transition-colors duration-150 hover:border-hairline-strong hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50 disabled:pointer-events-none disabled:opacity-50'

/** Leading icon inside a guidance control. */
export const railIcon = 'h-4 w-4 shrink-0 text-saffron-deep'

/**
 * The route's tour is the one guidance item meant to be noticed, so it does not use the neutral
 * surfaces above. It is a warm saffron-tinted surface with a filled icon tile, shown at the top of
 * the Guide modal while the tour is still new.
 */
export const railGuideSurface = 'rounded-xl border border-saffron/40 bg-saffron-soft shadow-sm'

/** The filled tile behind the guide's compass icon. */
export const railGuideIcon = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-saffron-deep text-white'

/**
 * The route's primary action. It ends the page header's action row, beside the Guide, at the
 * row's 40px height; phones keep the 44px touch minimum (the phone root font is 14px, so this is
 * set in pixels rather than rem).
 */
export const railPrimaryAction = 'min-h-10 rounded-lg bg-loom px-4 text-sm font-semibold text-white shadow-[var(--shadow-button)] hover:bg-loom-elevated hover:text-white focus-visible:ring-saffron/40 max-md:min-h-[44px]'
