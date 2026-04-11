import { createClient } from './lib/supabase/server'
import { getSuratTodayString, getSuratYesterdayString } from './lib/time'
import { parseJWT } from './lib/auth'

async function debug() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.log("No session")
    return
  }
  const { org_id } = parseJWT(session.access_token)
  const today = getSuratTodayString()
  const yesterday = getSuratYesterdayString()

  console.log("Org ID:", org_id)
  console.log("Today:", today)
  console.log("Yesterday:", yesterday)

  const { data: trendLogs } = await supabase
    .from('production_logs')
    .select('date, meters')
    .eq('org_id', org_id)
    .gte('date', yesterday)
    .lte('date', today)
  
  console.log("Trend Logs for range:", trendLogs)

  const { data: kpiYesterday, error: errY } = await supabase.rpc('get_kpi_yesterday', { p_org_id: org_id, p_date: yesterday })
  console.log("KPI Yesterday RPC Result:", kpiYesterday, errY)

  const { data: kpiToday, error: errT } = await supabase.rpc('get_kpi_today_live', { p_org_id: org_id, p_date: today })
  console.log("KPI Today RPC Result:", kpiToday, errT)
}

debug()
