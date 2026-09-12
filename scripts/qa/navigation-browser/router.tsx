import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
const Router = createContext<{pathname:string;navigate:(href:string)=>void}>({pathname:'/owner/stock', navigate:() => {}})
export function RouterFixture({children, blocked}:{children:ReactNode;blocked:boolean}) {
 const [pathname,setPathname]=useState(window.location.pathname)
 useEffect(()=>{const update=()=>setPathname(window.location.pathname);window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update)},[])
 return <Router.Provider value={{pathname,navigate:href=>{if(blocked)return;window.history.pushState(null,'',href);setPathname(window.location.pathname)}}}>{children}</Router.Provider>
}
export function usePathname(){return useContext(Router).pathname}
export function useFixtureRouter(){return useContext(Router)}
