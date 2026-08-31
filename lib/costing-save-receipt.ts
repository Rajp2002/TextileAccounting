import type { SupabaseClient } from '@supabase/supabase-js'

/** A receipt lookup never creates or modifies a costing, even when no row is found. */
export async function findCostingSaveReceipt(client: SupabaseClient, orgId: string, requestId: string) {
  return client.from('estimator_quotes')
    .select('id, version_number, updated_at, created_at, quality_label, record_kind')
    .eq('org_id', orgId)
    .eq('client_request_id', requestId)
    .maybeSingle()
}
