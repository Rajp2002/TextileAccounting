import {describe,expect,it} from 'vitest'
import {freeEditWindow,remainingFreeEditMs} from '@/lib/free-costing-window'

describe('Free costing edit availability',()=>{
 const created_at='2026-10-04T00:00:00Z'
 const serverTime='2026-10-04T00:10:00Z'
 it('keeps recalculation unavailable until the database has revision metadata',()=>{
  expect(freeEditWindow({created_at},serverTime)).toBeUndefined()
  expect(freeEditWindow({created_at,updated_at:created_at},serverTime)).toBeUndefined()
 })
 it('retains the original deadline when a revision is saved',()=>{
  const window=freeEditWindow({created_at,updated_at:'2026-10-04T00:20:00Z',revision:4},serverTime)
  expect(window).toMatchObject({revision:4,editExpiresAt:'2026-10-04T00:30:00.000Z'})
  expect(remainingFreeEditMs(window,Date.parse(serverTime))).toBe(20*60*1000)
  expect(remainingFreeEditMs(window,Date.parse('2026-10-04T00:30:00Z'))).toBe(0)
 })
 it('does not advertise a window with invalid revision metadata',()=>{
  expect(freeEditWindow({created_at,updated_at:created_at,revision:0},serverTime)).toBeUndefined()
  expect(freeEditWindow({created_at,updated_at:'invalid',revision:1},serverTime)).toBeUndefined()
 })
})
