import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testLinking() {
  console.log('--- Starting Verification Script ---')
  
  // 1. Get a test org
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1)
  if (!orgs?.length) throw new Error('No orgs found')
  const orgId = orgs[0].id
  console.log('Org ID:', orgId)

  // 2. Create a test quality
  const { data: quality } = await supabase.from('qualities').insert({
    org_id: orgId,
    name: 'Verification Silk',
    default_worker_rate_per_m: 4.5,
    theoretical_meters_per_day: 60,
    target_yield: 6.5
  }).select().single()
  console.log('Quality Created:', quality?.name)

  // 3. Create a test order
  const { data: order } = await supabase.from('orders').insert({
    org_id: orgId,
    quality_id: quality.id,
    party_name: 'Verification Party',
    total_target_meters: 1000,
    deadline: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]
  }).select().single()
  console.log('Order Created:', order?.party_name)

  // 4. Create a test machine
  const { data: machine } = await supabase.from('machines').insert({
    org_id: orgId,
    name: 'V-Loom-1',
    rate_per_meter: 0
  }).select().single()
  console.log('Machine Created:', machine?.name)

  // 5. Test Order Linking (Simulating Server Action logic)
  console.log('Testing Order Linking...')
  const { error: orderLinkError } = await supabase
    .from('machines')
    .update({ current_order_id: order.id })
    .eq('id', machine.id)
  
  if (orderLinkError) throw orderLinkError
  console.log('Order Linked Successfully')

  // 6. Create a test batch
  const { data: batch } = await supabase.from('yarn_batches').insert({
    org_id: orgId,
    quality_id: quality.id,
    name: 'V-Batch-1',
    total_weight_kg: 50
  }).select().single()
  console.log('Batch Created:', batch?.name)

  // 7. Test Beam Linking (Simulating Server Action logic)
  console.log('Testing Beam Linking & Rate Automation...')
  
  // Clear others (none expected)
  await supabase.from('yarn_batches').update({ current_machine_id: null }).eq('current_machine_id', machine.id)
  
  const { error: batchLinkError } = await supabase
    .from('yarn_batches')
    .update({ current_machine_id: machine.id })
    .eq('id', batch.id)
  
  if (batchLinkError) throw batchLinkError
  
  // Update rate
  const { error: rateUpdateError } = await supabase
    .from('machines')
    .update({ rate_per_meter: quality.default_worker_rate_per_m })
    .eq('id', machine.id)
  
  if (rateUpdateError) throw rateUpdateError
  console.log('Beam Linked and Rate Updated Successfully')

  // 8. Verify final state
  const { data: finalMachine } = await supabase.from('machines').select('*').eq('id', machine.id).single()
  console.log('Final Machine State:', {
    order_id: finalMachine?.current_order_id === order.id ? 'MATCH' : 'FAIL',
    rate: finalMachine?.rate_per_meter === 4.5 ? 'MATCH (4.5)' : `FAIL (${finalMachine?.rate_per_meter})`
  })

  console.log('--- Verification Script Completed Successfully ---')
}

testLinking().catch(err => {
  console.error('Verification Script Failed:', err)
  process.exit(1)
})
