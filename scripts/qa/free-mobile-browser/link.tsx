import React from 'react'
export function useLinkStatus() { return { pending: false } }
export default function Link(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props} /> }
