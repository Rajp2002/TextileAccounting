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
 it.each([0,1,2])('includes disclosure chevron and animated wrapper structure for group %s',index=>{
  const closed = render(index, false)
  expect(closed).toContain('nav-chevron')
  expect(closed).toContain('submenu-wrapper')
  expect(closed).toContain('data-open="false"')
  expect(closed).toContain('submenu-inner')
  expect(closed).toContain('submenu-content')
  expect(closed).toContain('inert=""')

  const open = render(index, true)
  expect(open).toContain('nav-chevron')
  expect(open).toContain('rotate-90')
  expect(open).toContain('data-open="true"')
  expect(open).not.toContain('inert=""')
 })
 it('does not apply active styling to an expanded group when viewing another module',()=>{
  location.pathname='/owner/payroll'
  // Group 0 is costing, Group 1 is stock, Group 2 is workforce
  // Viewing payroll means workforce is active, costing is not
  const costingOpen = render(0, true)
  expect(costingOpen).not.toContain('bg-saffron-deep')
  expect(costingOpen).toContain('aria-expanded="true"')
  const workforceCollapsed = render(2, false)
  expect(workforceCollapsed).toContain('bg-saffron-deep')
 })
})

describe('navigation motion tokens and css architecture', () => {
  it('defines all required motion tokens and rules in globals.css', async () => {
   const fs = await import('node:fs')
   const path = await import('node:path')
   const css = fs.readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf-8')

   expect(css).toContain('--nav-disclosure-expand-duration: 180ms;')
   expect(css).toContain('--nav-disclosure-collapse-duration: 150ms;')
   expect(css).toContain('--nav-chevron-duration: 160ms;')
   expect(css).toContain('--nav-child-fade-duration: 140ms;')
   expect(css).toContain('--nav-disclosure-ease: cubic-bezier(0.22, 1, 0.36, 1);')
   expect(css).toContain('--nav-child-offset: 4px;')

   expect(css).toContain('.submenu-wrapper')
   expect(css).toContain('grid-template-rows: 0fr;')
   expect(css).toContain('.submenu-wrapper[data-open="true"]')
   expect(css).toContain('grid-template-rows: 1fr;')
   expect(css).toContain('.submenu-inner')
   expect(css).toContain('overflow: hidden;')
   expect(css).toContain('.submenu-content')
   expect(css).toContain('.nav-chevron')
   expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
