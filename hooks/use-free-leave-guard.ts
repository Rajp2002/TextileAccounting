'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { guardedLinkHref } from '@/lib/free-leave-guard'

/** Why leaving would lose page-memory work, or null when the page is clean. */
export type FreeLeaveReason = 'unresolved' | 'unsaved' | null
type AnchorLike = { href: string; target: string; hasAttribute: (name: string) => boolean }

/**
 * Free keeps unsaved inputs and an unconfirmed request only in this page's
 * memory. While either is at risk, in-app links and reloads ask first. Links
 * that open a new tab keep this page and pass straight through. Browser Back
 * and Forward are not intercepted.
 */
export function useFreeLeaveGuard(reason: FreeLeaveReason) {
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const leaving = useRef(false)

  useEffect(() => {
    if (!reason) return
    const onClick = (event: MouseEvent) => {
      const target = event.target as { closest?: (selector: string) => unknown } | null
      const anchor = typeof target?.closest === 'function' ? target.closest('a[href]') as AnchorLike | null : null
      if (!anchor) return
      const href = guardedLinkHref({
        defaultPrevented: event.defaultPrevented, button: event.button,
        metaKey: event.metaKey, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey,
        href: anchor.href, target: anchor.target, download: anchor.hasAttribute('download'),
      }, window.location)
      if (!href) return
      event.preventDefault()
      setPendingHref(href)
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    // Capture runs before next/link, which skips navigation once the click is prevented.
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [reason])

  const stay = useCallback(() => setPendingHref(null), [])
  const leave = useCallback(() => {
    const href = pendingHref
    setPendingHref(null)
    if (!href) return
    if (href.startsWith('/')) return router.push(href)
    leaving.current = true
    window.location.assign(href)
  }, [pendingHref, router])

  return { pendingHref, stay, leave }
}
