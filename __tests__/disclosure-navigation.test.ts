import { describe, expect, it } from 'vitest'
import { groupOwnerNavigation, isCurrentNavigationPage, resolveDisclosureState, toggleDisclosure, type DisclosureState } from '../lib/disclosure-navigation'
import { visibleOwnerNavigation } from '../lib/owner-navigation'
const sections = (tier: 'base' | 'lite' | 'free' | 'none' = 'base') => visibleOwnerNavigation({ tier, productionMode: 'market_run' })
const grouped = (tier: 'base' | 'lite' | 'free' | 'none' = 'base') => groupOwnerNavigation(sections(tier), tier)

describe('grouped navigation policy and destinations', () => {
 it('groups the costing, production and workforce destinations in approved order', () => {
  expect(grouped().flatMap(s => s.nodes).filter(n => n.kind === 'group').map(n => [n.id, n.kind === 'group' && n.children.map(c => c.id)])).toEqual([
   ['costing', ['estimate','rates','costings']], ['production', ['production_overview', 'production_daily_sheet']], ['workforce',['workers','payroll']],
  ])
 })
 it('keeps Production and Account destinations and relative order intact', () => {
  for (const id of ['production_stock','utilities']) {
   const before = sections().find(s => s.id === id)!.items.filter(n => n.id !== 'production')
   const after = grouped().find(s => s.id === id)!.nodes.filter(n => n.kind === 'link')
   expect(after.map(n => [n.id, n.kind === 'link' && n.href])).toEqual(before.map(n => [n.id,n.href]))
  }
 })
 it('renders an estimator-only entitlement as a direct link', () => {
  const input = sections('free').map(s => s.id === 'costing' ? {...s, items:s.items.filter(i => i.id === 'estimate')} : s)
  expect(groupOwnerNavigation(input, 'base')[0].nodes.map(n => [n.id,n.kind])).toEqual([['estimate','link']])
 })
 it.each(['free','lite','none'] as const)('keeps %s other navigation flat with existing grants and order', tier => {
  const before = visibleOwnerNavigation({tier,productionMode:'market_run'})
  const after = groupOwnerNavigation(before,tier)
  expect(after.flatMap(s=>s.nodes).every(n=>n.id === 'production' ? n.kind === 'group' : n.kind === 'link')).toBe(true)
  expect(after.map(s=>s.nodes.map(n=>n.id))).toEqual(before.map(s=>s.items.map(n=>n.id)))
 })
 it('keeps one-child workforce within Base presentation', () => {
  const input = sections().map(s => s.id === 'workforce' ? {...s, items:s.items.filter(i => i.id === 'payroll')} : s)
  const one = groupOwnerNavigation(input, 'base').find(s => s.id === 'workforce')!.nodes[0]
  expect(one.kind === 'group' && one.children.map(c => c.id)).toEqual(['payroll'])
 })
 it('keeps Stock a plain link and includes detail paths', () => {
  const groups = grouped().flatMap(s => s.nodes).filter(n => n.kind === 'group')
  const active = (path: string) => groups.filter(n => n.kind === 'group' && n.children.some(c => c.active(path,c.href))).map(n => n.id)
  expect(active('/owner/production')).toEqual(['production'])
  expect(active('/owner/production/daily-sheet')).toEqual(['production'])
  const production = groups.find(n => n.id === 'production')!
  expect(production.children.filter(c => c.active('/owner/production/daily-sheet', c.href)).map(c => c.id)).toEqual(['production_daily_sheet'])
  expect(active('/owner/rates')).toEqual(['costing'])
  expect(active('/owner/stock')).toEqual([])
  const stock = grouped().find(s => s.id === 'production_stock')!.nodes.find(n => n.id === 'stock')!
  expect(stock.kind === 'link' && stock.href).toBe('/owner/stock')
  expect(active('/owner/quotes/example')).toEqual(['costing'])
  expect(active('/owner/workers/example')).toEqual(['workforce'])
  expect(active('/owner/workers-other')).toEqual([])
 })
 it('does not confuse detail pages with listings', () => {
  expect(isCurrentNavigationPage('/owner/stock/123','/owner/stock')).toBe(false)
  expect(isCurrentNavigationPage('/owner/stock','/owner/stock')).toBe(true)
  expect(isCurrentNavigationPage('/owner/workers','/owner/workers')).toBe(true)
 })
})
describe('local one-open-group state', () => {
 const initial: DisclosureState = { location:'/owner/stock', scope:'workspace-a', expanded:null }
 it.each(['costing','production','workforce'] as const)('toggles %s without changing location', id => {
  const open = toggleDisclosure(initial,id)
  expect(open).toEqual({...initial, expanded:id})
  expect(toggleDisclosure(open,id)).toEqual(initial)
 })
 it('opening another group closes the first', () => {
  expect(toggleDisclosure(toggleDisclosure(initial,'costing'),'workforce').expanded).toBe('workforce')
 })
 it('keeps selection available until a location commits; resets for navigation or workspace change', () => {
  const open = toggleDisclosure(initial,'costing')
  expect(resolveDisclosureState(open,initial.location,initial.scope)).toBe(open)
  expect(resolveDisclosureState(open,'/owner/quotes',initial.scope).expanded).toBeNull()
  expect(resolveDisclosureState(open,initial.location,'workspace-b').expanded).toBeNull()
 })
})
