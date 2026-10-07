import { requireActiveSupervisor } from '@/lib/supervisor-session'
import { createClient } from '@/lib/supabase/server'
import { supervisorDateWindow } from '@/lib/supervisor-access'
import { parseSupervisorSheet, type SupervisorSheetData } from '@/lib/supervisor-daily-sheet'
import { SupervisorDailySheet } from '@/components/supervisor/SupervisorDailySheet'
import { SupervisorSheetLoadError } from '@/components/supervisor/supervisor-status-view'

export default async function SupervisorDailySheetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const session = await requireActiveSupervisor()
    const params = await searchParams
    const window = supervisorDateWindow(session.today)
    const date = params.date === window.min ? window.min : window.max
    const shift = params.shift === 'night' ? 'night' : 'day'

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_supervisor_daily_sheet', { p_production_date: date, p_shift: shift })
    let sheet: SupervisorSheetData | null = null
    if (!error && data) {
        try { sheet = parseSupervisorSheet(data) } catch { sheet = null }
    }
    if (!sheet) return <SupervisorSheetLoadError />

    return <SupervisorDailySheet key={`${date}:${shift}`} data={sheet} date={date} shift={shift} actorId={session.userId} />
}
