import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function run() {
  const { data: logs } = await supabase.from('production_logs').select('*').eq('meters', 152)
  console.log('Logs with 152 meters:', logs)
  
  if (logs && logs.length > 0) {
     const workerIds = logs.map(l => l.worker_id)
     const { data: matchedWorkers } = await supabase.from('workers').select('*').in('id', workerIds)
     console.log('Matched Meter Workers:', matchedWorkers)
     const { data: matchedFixed } = await supabase.from('fixed_workers').select('*').in('id', workerIds)
     console.log('Matched Fixed Workers:', matchedFixed)
  }
}
run()
