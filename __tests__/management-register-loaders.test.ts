import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ tier: 'base', orgId: 'tenant-one', error: null as null | {message: string}, rows: [{ id: 'record-one', name: 'Fixture', monthly_salary: '10000', pay_type: 'fixed_monthly', is_active: true }], from: vi.fn(), eq: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth', () => ({ requireRole: vi.fn(async (roles: string[]) => { expect(roles).toEqual(['owner']); return { profile: { org_id: fixture.orgId } } }) }))
vi.mock('@/lib/subscription', () => ({ getCachedOrgPlanAccess: vi.fn(async () => ({ effectiveTier: fixture.tier })) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: fixture.from }) }))
import { loadWorkersRegister, loadMachinesRegister } from '../app/(dashboard)/owner/production/registers/loaders'
 beforeEach(() => {
  fixture.tier = 'base'; fixture.orgId = 'tenant-one'; fixture.error = null; vi.clearAllMocks()
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(() => chain),
    eq: fixture.eq,
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(async () => ({ data: fixture.error ? null : fixture.rows, error: fixture.error, count: 1 })),
  }
  fixture.eq.mockReturnValue(chain); fixture.from.mockReturnValue(chain)
 })
 describe('independent authorized register reads', () => {
  it('workers reads operational workers, assignments and loom names without payroll or advance tables', async () => {
   const data = await loadWorkersRegister()
   expect(fixture.from.mock.calls).toEqual([
    ['base_production_workers'],
    ['base_worker_machine_assignments'],
    ['base_production_machines'],
   ])
   expect(fixture.eq).toHaveBeenCalledWith('org_id','tenant-one')
   expect(data?.workers[0]).toMatchObject({ id: 'record-one', monthly_salary: 10000, pay_type: 'fixed_monthly' })
   // The shift-switch modal gets only open day/night assignments plus loom names.
   expect(data?.rotation).toEqual({ assignments: [], machineNames: { 'record-one': 'Fixture' } })
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
  it('lists machines by number rather than as text, with inactive machines after active ones', async () => {
   // Rows arrive in the order Postgres gives a text `name` sort, where "10" and "11" come before "2".
   const machineRows: Record<string, unknown>[] = [
    { id: 'm-1', name: '1', machine_type: 'jacquard', custom_label: null, is_active: true, inactive_reason: null },
    { id: 'm-10', name: '10', machine_type: 'jacquard', custom_label: null, is_active: true, inactive_reason: null },
    { id: 'm-11', name: '11', machine_type: 'jacquard', custom_label: null, is_active: true, inactive_reason: null },
    { id: 'm-2', name: '2', machine_type: 'jacquard', custom_label: null, is_active: true, inactive_reason: null },
    { id: 'm-3', name: '3', machine_type: 'jacquard', custom_label: null, is_active: false, inactive_reason: 'Sold' },
   ]
   const original = fixture.rows
   fixture.rows = machineRows as typeof fixture.rows
   try {
    const data = await loadMachinesRegister()
    expect(data?.machines.map(machine => machine.name)).toEqual(['1', '2', '10', '11', '3'])
   } finally {
    fixture.rows = original
   }
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
