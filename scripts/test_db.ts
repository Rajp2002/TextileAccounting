import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function run() {
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1)
  const orgId = orgs?.[0]?.id

  if (!orgId) return console.log('No org found')
  console.log('Org:', orgId)

  const { data: workers } = await supabase.from('workers').select('id, name, is_active').eq('org_id', orgId)
  console.log('Workers count:', workers?.length)
  console.log('Workers:', workers)
  
  const { data: fixed_workers } = await supabase.from('fixed_workers').select('id, name, role').eq('org_id', orgId)
  console.log('Fixed:', fixed_workers)

  const { data: logs } = await supabase.from('production_logs').select('*').eq('org_id', orgId)
  console.log('Logs:', logs)
}
run()
