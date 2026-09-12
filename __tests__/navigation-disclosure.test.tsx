import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { groupOwnerNavigation } from '../lib/disclosure-navigation'
import { visibleOwnerNavigation } from '../lib/owner-navigation'
import { NavigationDisclosure } from '../components/navigation/navigation-disclosure'
const location = vi.hoisted(() => ({pathname:'/owner/stock'}))
vi.mock('next/navigation',()=>({usePathname:()=>location.pathname}))
vi.mock('../lib/i18n/context',()=>({useTranslation:()=>({t:(key:string)=>key})}))
const groups = groupOwnerNavigation(visibleOwnerNavigation({tier:'base',productionMode:'market_run'}),'base').flatMap(s=>s.nodes).filter(n=>n.kind==='group')
const noop=()=>{}
const render = (index:number, expanded:boolean) => renderToStaticMarkup(createElement(NavigationDisclosure, {group:groups[index],expanded,onToggle:noop,onCollapse:noop,onNavigate:noop}))
describe('disclosure semantics shared by all three groups',()=>{
 it.each([0,1,2])('uses a native button and hidden nested list for group %s',index=>{
  const html=render(index,false)
  expect(html).toContain('type="button"')
  expect(html).toContain('aria-expanded="false"')
  expect(html).toMatch(/<ul[^>]+hidden=""/)
  expect(html).not.toMatch(/role="(menu|menuitem|tab|tablist)"/)
  const control=html.match(/aria-controls="([^"]+)"/)![1]
  expect(html).toContain(`<ul id="${control}"`)
 })
 it.each([0,1,2])('exposes normal links only when expanded for group %s',index=>{
  const html=render(index,true)
  expect(html).toContain('aria-expanded="true"')
  expect(html).not.toContain('hidden=""')
  for(const child of groups[index].children)expect(html).toContain(`href="${child.href}"`)
 })
 it('keeps active parent styling while collapsed and distinguishes exact pages from details',()=>{
  location.pathname='/owner/stock/yarn'
  expect(render(1,false)).toContain('bg-saffron-deep')
  expect(render(1,true)).toContain('aria-current="page"')
  location.pathname='/owner/stock/yarn/example'
  const html=render(1,true)
  expect(html).toContain('aria-current="location"')
  expect(html).not.toContain('aria-current="page"')
 })
})
