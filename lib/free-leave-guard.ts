/** What the guard reads from a click on a link. */
export type GuardClick = {
  defaultPrevented: boolean
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  /** Fully resolved `anchor.href`. */
  href: string
  target: string
  download: boolean
}
type Here = { origin: string; pathname: string; search: string }

/**
 * The destination to confirm before a link click unmounts this page, or null
 * when the click keeps the page (a new tab, a download, an in-page anchor) or
 * is not a web navigation. In-app destinations come back as a path, ready for
 * the router.
 */
export function guardedLinkHref(click: GuardClick, here: Here): string | null {
  if (click.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null
  if (click.download || click.target && click.target !== '_self') return null
  let url: URL
  try { url = new URL(click.href) } catch { return null }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.origin !== here.origin) return url.href
  if (url.pathname === here.pathname && url.search === here.search) return null
  return `${url.pathname}${url.search}${url.hash}`
}

/** Why leaving would lose page-memory work, or null when the page is clean. */
export type FreeLeaveReason = 'unresolved' | 'unsaved' | null

/**
 * Everything the owner can type on the page, as it stands: inputs including
 * row names, the costing name and the construction notes. Not only the inputs
 * that change the money, because Free keeps all of it only in page memory.
 */
export function freePageSnapshot(page: { state: unknown; qualityLabel: string; warpInstruction: string; weftInstruction: string }): string {
  return JSON.stringify([page.state, page.qualityLabel, page.warpInstruction, page.weftInstruction])
}

/**
 * A page is clean when the owner has not edited it, or it is exactly the page
 * of the last confirmed save. An unconfirmed request always counts first.
 */
export function freeLeaveReason(input: { guarded: boolean; unresolved: boolean; hasUnsavedEdits: boolean; page: string; savedPage: string | null }): FreeLeaveReason {
  if (!input.guarded) return null
  if (input.unresolved) return 'unresolved'
  return input.hasUnsavedEdits && input.page !== input.savedPage ? 'unsaved' : null
}
