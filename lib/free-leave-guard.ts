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
