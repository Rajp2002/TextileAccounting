import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vzhwahudircrpgtitwzd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6aHdhaHVkaXJjcnBndGl0d3pkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI0MDE5NywiZXhwIjoyMDg2ODE2MTk3fQ.355XIvote_askYX1mgF0Sy7YGzIPMaSVDXU_IBI6pOM'

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
