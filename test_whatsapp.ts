import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vzhwahudircrpgtitwzd.supabase.co'
const supabaseKey = '***REMOVED_JWT***'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLogs() {
  const { data, error } = await supabase
    .from('whatsapp_delivery_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching logs:', error)
  } else {
    console.log('Recent logs:')
    console.dir(data, { depth: null })
  }
}

checkLogs()
