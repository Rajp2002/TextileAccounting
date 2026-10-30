'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * An inline script that only exists in server-rendered HTML. The browser runs it while parsing the
 * first document; hydration keeps it, then it unmounts. On a client-side navigation it renders
 * nothing: React never runs a script it creates itself and warns ("Encountered a script tag while
 * rendering React component") when asked to.
 */
export function DocumentLoadScript({ html }: { html: string }) {
  // The server snapshot (true) applies on the server and during hydration, the client one after.
  const fromServerHtml = useSyncExternalStore(subscribe, () => false, () => true)
  if (!fromServerHtml) return null
  return <script dangerouslySetInnerHTML={{ __html: html }} />
}
