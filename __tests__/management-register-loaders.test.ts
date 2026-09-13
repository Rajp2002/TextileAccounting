import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ tier: 'base', orgId: 'tenant-one', error: null as null | {message: string}, rows: [{ id: 'record-one', name: 'Fixture', monthly_salary: '10000', pay_type: 'fixed_monthly', is_active: true }], from: vi.fn(), eq: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth', () => ({ requireRole: vi.fn(async (roles: string[]) => { expect(roles).toEqual(['owner']); return { profile: { org_id: fixture.orgId } } }) }))
vi.mock('@/lib/subscription', () => ({ getCachedOrgPlanAccess: vi.fn(async () => ({ effectiveTier: fixture.tier })) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: fixture.from }) }))
import { loadWorkersRegister, loadMachinesRegister } from '../app/(dashboard)/owner/production/registers/loaders'
 beforeEach(() => {
  fixture.tier = 'base'; fixture.orgId = 'tenant-one'; fixture.error = null; vi.clearAllMocks()
  const chain: any = {
    select: vi.fn(() => chain),
    eq: fixture.eq,
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(async () => ({ data: fixture.error ? null : fixture.rows, error: fixture.error, count: 1 })),
  }
  fixture.eq.mockReturnValue(chain); fixture.from.mockReturnValue(chain)
 })
 describe('independent authorized register reads', () => {
  it('workers reads operational workers and assignments without payroll or advance tables', async () => {
   const data = await loadWorkersRegister()
   expect(fixture.from.mock.calls).toEqual([
    ['base_production_workers'],
    ['base_worker_machine_assignments'],
   ])
   expect(fixture.eq).toHaveBeenCalledWith('org_id','tenant-one')
   expect(data?.workers[0]).toMatchObject({ id: 'record-one', monthly_salary: 10000, pay_type: 'fixed_monthly' })
  })
  it('machines reads operational machines, assignments, job contexts, workers and jobs without payroll or salary tables', async () => {
   await loadMachinesRegister()
   expect(fixture.from.mock.calls).toEqual([
    ['base_production_machines'],
    ['base_worker_machine_assignments'],
    ['base_machine_job_contexts'],
    ['base_production_workers'],
    ['base_production_jobs'],
   ])
   expect(fixture.eq).toHaveBeenCalledWith('org_id','tenant-one')
  })
 it.each(['free','lite','none'])('denies %s before a business-data query', async tier => {
  fixture.tier = tier
  expect(await loadWorkersRegister()).toBeNull(); expect(await loadMachinesRegister()).toBeNull()
  expect(fixture.from).not.toHaveBeenCalled()
 })
 it('fails visibly instead of returning a false empty register', async () => {
  fixture.error = { message: 'sensitive database error' }
  await expect(loadWorkersRegister()).rejects.toThrow('Unable to load workers. Please retry.')
  await expect(loadMachinesRegister()).rejects.toThrow('Unable to load machines. Please retry.')
 })
  it('resolves the new tenant on each read without module-level cached rows', async () => {
   await loadWorkersRegister(); fixture.orgId = 'tenant-two'; await loadWorkersRegister()
   expect(fixture.eq).toHaveBeenCalledWith('org_id','tenant-one')
   expect(fixture.eq).toHaveBeenCalledWith('org_id','tenant-two')
  })
})
