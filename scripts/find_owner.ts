import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function run() {
  const { data: owners } = await supabase.from('profiles').select('*').eq('org_id', '38932c6c-526d-40fd-bb3b-6054d72036a7').eq('role', 'owner')
  console.log('Owners for this org:', owners)
}
run()
