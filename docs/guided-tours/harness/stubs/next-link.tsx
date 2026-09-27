/* eslint-disable -- guided-tour harness: a local diagnostic tool, not application code. */
import React from 'react'
const Link = React.forwardRef<HTMLAnchorElement, any>(function Link({ href, prefetch, replace, scroll, ...rest }, ref) {
  return <a ref={ref} href={typeof href === 'string' ? href : href?.pathname ?? '#'} onClick={e => { e.preventDefault(); ((window as any).__navigations ||= []).push({ kind: 'link', href }) }} {...rest} />
})
export default Link
export function useLinkStatus() { return { pending: false } }
