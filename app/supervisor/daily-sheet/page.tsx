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
    const [{ data, error }, goLive] = await Promise.all([
        supabase.rpc('get_supervisor_daily_sheet', { p_production_date: date, p_shift: shift }),
        supabase.rpc('get_supervisor_go_live'),
    ])
    let sheet: SupervisorSheetData | null = null
    if (!error && data) {
        try { sheet = parseSupervisorSheet(data) } catch { sheet = null }
    }
    if (!sheet) return <SupervisorSheetLoadError />

    // Recording opens on go-live; null while the owner has not scheduled it. A failed read leaves the sheet open,
    // since the database refuses a save before go-live anyway.
    const goLiveDate = goLive.error ? undefined : (goLive.data as string | null)
    return <SupervisorDailySheet key={`${date}:${shift}`} data={sheet} date={date} shift={shift} actorId={session.userId} goLiveDate={goLiveDate} />
}
