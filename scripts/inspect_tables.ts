import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function run() {
  const { data: cols, error } = await supabase.rpc('inspect_table_columns', { table_name: 'machines' })
  console.log('Columns for machines:', cols || error)
  const { data: cols2, error: e2 } = await supabase.rpc('inspect_table_columns', { table_name: 'production_logs' })
  console.log('Columns for production_logs:', cols2 || e2)
}
run()
