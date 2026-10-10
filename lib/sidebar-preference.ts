/**
 * The desktop sidebar is a 248px menu or a 72px icon rail. Without a saved
 * choice it follows the screen: the rail from 768px to 1279px (tablets and
 * small laptops), the full menu from 1280px. The owner's own choice is kept in
 * a cookie so the workspace layouts render the right width on the first paint.
 *
 * The shell element carries the choice as `data-sidebar-preference`, and
 * app/globals.css turns it into `--shell-sidebar-w`, which every offset
 * (content padding, docked shortcuts, centred dialogs) reads.
 */
export const SIDEBAR_PREFERENCE_COOKIE = 'weavly_sidebar'
export const SIDEBAR_RAIL_WIDTH = 72
export const SIDEBAR_FULL_WIDTH = 248
/** Below this width the menu is a rail, so a hover, focus or tap on a group opens it over the page. */
export const SIDEBAR_RAIL_THRESHOLD = 120
/** Widths where the rail is the default. */
export const SIDEBAR_RAIL_DEFAULT_QUERY = '(min-width: 768px) and (max-width: 1279.98px)'

export type SidebarPreference = 'auto' | 'collapsed' | 'expanded'

export function parseSidebarPreference(value: string | null | undefined): SidebarPreference {
    return value === 'collapsed' || value === 'expanded' ? value : 'auto'
}

/** The choice a toggle makes: the opposite of what the screen shows now. */
export function nextSidebarPreference(current: SidebarPreference, railByDefault: boolean): Exclude<SidebarPreference, 'auto'> {
    const collapsed = current === 'collapsed' || (current === 'auto' && railByDefault)
    return collapsed ? 'expanded' : 'collapsed'
}

/** A layout preference only, so it is readable by the page and carries no account data. */
export function sidebarPreferenceCookie(preference: Exclude<SidebarPreference, 'auto'>): string {
    return `${SIDEBAR_PREFERENCE_COOKIE}=${preference}; Path=/; Max-Age=${365 * 24 * 60 * 60}; SameSite=Lax`
}
