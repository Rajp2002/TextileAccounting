import { describe, expect, it } from 'vitest'
import { visibleOwnerNavigation, ownerRouteActive } from '../lib/owner-navigation'
import { legacyManagementHref } from '../lib/management-navigation'
import { safeBaseReturnPath } from '../lib/base-production-navigation'
import { en } from '../lib/i18n/locales/en'
import { hi } from '../lib/i18n/locales/hi'
import { gu } from '../lib/i18n/locales/gu'
import type { SubscriptionTier } from '../lib/subscription-access'

const groups = (tier: SubscriptionTier) => visibleOwnerNavigation({ tier, productionMode: 'market_run' })
const id = '11111111-1111-4111-8111-111111111111'
describe('shared owner navigation', () => {
 it('orders the complete Base tree and consolidates utilities', () => {
  expect(groups('base').map(group => [group.id, group.items.map(item => item.id)])).toEqual([
   ['costing', ['estimate', 'costings', 'rates']],
   ['production_stock', ['production', 'assignments', 'stock', 'dispatches', 'machines']],
   ['workforce', ['workers', 'payroll']],
   ['utilities', ['settings', 'billing']],
  ])
 })
 it.each(['free','lite'] as const)('removes operational sections for %s', tier => {
  expect(groups(tier).map(group => group.id)).toEqual(['costing','utilities'])
  expect(groups(tier)[0].items.map(item => item.id)).toEqual(tier === 'free' ? ['estimate','costings'] : ['estimate','costings','rates'])
 })
 it('does not render any destination until an entitlement resolves', () => expect(groups('none')).toEqual([]))
 it('keeps Base production routes visible', () => {
  const items = groups('base').flatMap(group => group.items)
  expect(items.find(item => item.id === 'machines')?.href).toBe('/owner/machines')
  expect(items.find(item => item.id === 'workers')?.href).toBe('/owner/workers')
  expect(items.some(item => item.id === 'assignments')).toBe(true)
 })
 it('matches parents precisely without selecting adjacent modules', () => {
  expect(ownerRouteActive('/owner/workers/123/edit','/owner/workers')).toBe(true)
  expect(ownerRouteActive('/owner/assignments','/owner/workers')).toBe(false)
  expect(ownerRouteActive('/owner/workers-extra','/owner/workers')).toBe(false)
  expect(ownerRouteActive('/free/costings','/free')).toBe(false)
  expect(ownerRouteActive('/owner/machines','/owner/machines?register=base')).toBe(true)
 })
 it.each([en,hi,gu])('provides translation keys for every visible item', locale => {
  for (const group of groups('lite').concat(groups('base'))) {
   expect(locale.navigation.sections[group.id]).toBeTruthy()
   for (const item of group.items) expect(locale.navigation[item.id as keyof typeof locale.navigation]).toBeTruthy()
  }
 })
})
describe('legacy compatibility and safe round trips', () => {
 it.each([
  ['', '/owner/workers'],
  ['section=workers', '/owner/workers'],
  ['section=machines', '/owner/machines?register=base'],
  ['add=machine', '/owner/machines?register=base&add=machine'],
  ['add=worker', '/owner/workers?add=worker'],
  [`worker=${id}`, `/owner/workers?worker=${id}`],
  [`section=machines&worker=${id}&id=${id}&salary=999&tab=machines`, '/owner/machines?register=base'],
 ])('resolves supported selectors without guessing record types: %s', (query, expected) => expect(legacyManagementHref('setup',new URLSearchParams(query))).toBe(expected))
 it('preserves assignment context and never issues add commands', () => {
  expect(legacyManagementHref('operations',new URLSearchParams(`worker=${id}&shift=night&add=worker`))).toBe(`/owner/assignments?worker=${id}&shift=night`)
 })
 it('allowlists nested returns and drops unknown/sensitive payloads', () => {
  expect(safeBaseReturnPath(`/owner/assignments?machine=${id}&shift=night&salary=40000&returnTo=https://evil.test`)).toBe(`/owner/assignments?machine=${id}&shift=night`)
  for (const url of ['https://evil.test', '//evil.test','/owner/workers/../../api/delete','/owner/workers\\evil','/owner/workers#https://evil.test','/owner/workers%0d%0a']) expect(safeBaseReturnPath(url)).toBeUndefined()
 })
})
