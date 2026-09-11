import 'server-only'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { createClient } from '@/lib/supabase/server'
import { readCompleteBaseRows } from '@/lib/base-complete-query'
import { normalizeWorker, normalizeMachine } from './normalize'

// Check capability before reading any register, independently of layout rendering.
async function registerContext() {
 const { profile } = await requireRole(['owner'])
 const access = await getCachedOrgPlanAccess(profile.org_id)
 return hasCapability(access.effectiveTier, 'production_management') ? profile.org_id : null
}
export async function loadWorkersRegister() {
 const orgId = await registerContext()
 if (!orgId) return null
 const db = await createClient()
 const result = await readCompleteBaseRows((from, to) => db.from('base_production_workers')
  .select('id, name, rate_per_meter, shift_availability, is_active, pay_type, role, monthly_salary, salary_effective_from, salary_history, start_date, end_date, updated_at', from === 0 ? { count: 'exact' } : {})
  .eq('org_id', orgId).order('is_active', { ascending: false }).order('name').order('id').range(from, to))
 if (result.error) throw new Error('Unable to load workers. Please retry.')
 return { orgId, workers: (result.data ?? []).map(normalizeWorker) }
}
export async function loadMachinesRegister() {
 const orgId = await registerContext()
 if (!orgId) return null
 const db = await createClient()
 const result = await readCompleteBaseRows((from, to) => db.from('base_production_machines')
  .select('id, name, machine_type, custom_label, is_active', from === 0 ? { count: 'exact' } : {})
  .eq('org_id', orgId).order('is_active', { ascending: false }).order('name').order('id').range(from, to))
 if (result.error) throw new Error('Unable to load machines. Please retry.')
 return { orgId, machines: (result.data ?? []).map(normalizeMachine) }
}
