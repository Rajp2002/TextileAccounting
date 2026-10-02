/**
 * Shared presentation for the workspace rails (see "Workspace composition" in
 * app/globals.css). Guides, help, and rail actions use these strings so every
 * route's rails read as one quiet family: a hairline surface, ink text, and
 * saffron kept for the small brand accent on the icon.
 */

/** A single rail surface: guide card, help disclosure, notice. */
export const railSurface = 'rounded-xl border border-hairline bg-surface/95 shadow-xs'

/** A full-width secondary control in a rail (help, walkthrough, reference). */
export const railButton = 'group flex min-h-11 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-hairline bg-surface/95 px-3.5 py-2.5 text-left text-sm font-semibold text-ink shadow-xs transition-colors duration-150 hover:border-hairline-strong hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50 disabled:pointer-events-none disabled:opacity-50'

/** Leading icon inside a rail control. */
export const railIcon = 'h-4 w-4 shrink-0 text-saffron-deep'

/**
 * The route's guide is the one rail item meant to be noticed, so it does not use the neutral
 * surfaces above. It is a warm saffron-tinted surface, taller and larger than the other rail
 * controls, with a filled icon tile. The guide card and the replay launcher share these.
 */
export const railGuideSurface = 'rounded-xl border border-saffron/40 bg-saffron-soft shadow-sm'

/** The replay launcher: the guide card collapsed to one row once the invitation is decided. */
export const railGuideButton = 'group flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-saffron/40 bg-saffron-soft px-3.5 py-3 text-left text-[0.9375rem] font-semibold leading-snug text-ink shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-saffron hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60 disabled:pointer-events-none disabled:opacity-50'

/** The filled tile behind the guide's compass icon. */
export const railGuideIcon = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-saffron-deep text-white'

/**
 * The route's primary action. It sits at the top of the right rail on desktop
 * and in the page header on narrow screens, so it carries no width of its own.
 */
export const railPrimaryAction = 'min-h-11 rounded-lg bg-loom px-4 text-sm font-semibold text-white shadow-[var(--shadow-button)] hover:bg-loom-elevated hover:text-white focus-visible:ring-saffron/40'
