import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeWorker, normalizeMachine } from '../app/(dashboard)/owner/production/registers/normalize'
const fixture = vi.hoisted(() => ({ query: '', action: vi.fn() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(fixture.query), usePathname: () => '/owner/workers', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ tx: (text: string) => text, t: (text: string) => text }) }))
vi.mock('@/components/navigation/navigation-link', () => ({ NavigationLink: ({ children, ...props }: React.ComponentProps<'a'>) => React.createElement('a',props,children) }))
vi.mock('../app/(dashboard)/owner/production/actions', () => ({ createBaseProductionWorker: fixture.action, updateBaseProductionWorker: fixture.action, createBaseProductionMachine: fixture.action, updateBaseProductionMachine: fixture.action }))
import WorkersRegister from '../app/(dashboard)/owner/production/registers/WorkersRegister'
import MachinesRegister from '../app/(dashboard)/owner/production/registers/MachinesRegister'
const workers = [normalizeWorker({ id:'piece-worker',name:'Piece fixture',pay_type:'piece_rate',is_active:true }),normalizeWorker({ id:'staff-worker',name:'Staff fixture',pay_type:'fixed_monthly',monthly_salary:'10000',is_active:true })]
const machines = [normalizeMachine({ id:'machine-one',name:'Loom fixture',is_active:true,machine_type:'rapier' })]
beforeEach(() => { fixture.query = ''; fixture.action.mockClear() })
describe('dedicated register composition', () => {
 it('renders both compensation types without mounting machine management', () => {
  const html = renderToStaticMarkup(React.createElement(WorkersRegister,{workers,today:'2026-09-11'}))
  expect(html).toContain('Piece fixture'); expect(html).toContain('Staff fixture')
  expect(html).toContain('View machine assignments'); expect(html).not.toContain('Add machine')
  expect(html).not.toContain('role="tablist"'); expect(fixture.action).not.toHaveBeenCalled()
 })
 it('restores the salary filter directly from the URL', () => {
  fixture.query='payType=fixed_monthly'
  const html=renderToStaticMarkup(React.createElement(WorkersRegister,{workers,today:'2026-09-11'}))
  expect(html).toContain('Staff fixture');expect(html).not.toContain('Piece fixture');expect(html).not.toContain('View machine assignments')
 })
 it('shows filtered empty for an unavailable worker without leaking another record', () => {
  fixture.query='worker=other-tenant-id'
  const html=renderToStaticMarkup(React.createElement(WorkersRegister,{workers,today:'2026-09-11'}))
  expect(html).toContain('This record is unavailable.');expect(html).toContain('No workers match this view');expect(html).not.toContain('Staff fixture');expect(html).not.toContain('Add your first worker')
 })
 it('renders an independent machine register and a contextual assignment link', () => {
  const html=renderToStaticMarkup(React.createElement(MachinesRegister,{machines,today:'2026-09-11'}))
  expect(html).toContain('Loom fixture');expect(html).toContain('/owner/assignments?machine=machine-one');expect(html).not.toContain('Add worker');expect(html).not.toContain('role="tablist"');expect(fixture.action).not.toHaveBeenCalled()
 })
 it('does not mutate on an add-intent visit and excludes external return links', () => {
  fixture.query='add=worker&returnTo=https://attacker.test'
  const html=renderToStaticMarkup(React.createElement(WorkersRegister,{workers:[],today:'2026-09-11'}))
  expect(html).not.toContain('attacker.test');expect(fixture.action).not.toHaveBeenCalled()
 })
})
