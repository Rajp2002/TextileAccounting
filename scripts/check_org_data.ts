import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function run() {
  const { data: user } = await supabase.from('profiles').select('*').eq('id', 'e3c72c69-b59f-4d26-8505-81ddad226135').single()
  console.log('User Profile found:', user)
  
  if (user) {
    const { data: workers } = await supabase.from('workers').select('*').eq('org_id', user.org_id)
    console.log('Workers for this org:', workers)
    const { data: fixed } = await supabase.from('fixed_workers').select('*').eq('org_id', user.org_id)
    console.log('Fixed for this org:', fixed)
    const { data: machines } = await supabase.from('machines').select('*').eq('org_id', user.org_id)
    console.log('Machines for this org:', machines)
  }
}
run()
