import type { AnchorHTMLAttributes } from 'react'
import { useFixtureRouter } from './router'
export default function Link({href,onClick,prefetch: _prefetch,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{href:string;prefetch?:boolean}) {
 void _prefetch
 const router=useFixtureRouter()
 return <a {...props} href={href} onClick={event=>{onClick?.(event);if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();router.navigate(href)}}/>
}
export function useLinkStatus(){return {pending:false}}
