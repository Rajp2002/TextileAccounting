import React from 'react'
import { navigate } from './navigation'
export function useLinkStatus() { return { pending: false } }
export default function Link({ onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    return <a {...props} onClick={event => {
        onClick?.(event)
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || !props.href || props.href.startsWith('#')) return
        event.preventDefault(); navigate(props.href)
    }} />
}
