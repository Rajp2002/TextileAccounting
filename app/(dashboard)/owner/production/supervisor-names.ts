import 'server-only'

import { createClient as createServerClient } from '@/lib/supabase/server'

/**
 * Every supervisor ever linked to the owner's factory, for "saved by" labels on
 * daily-sheet revisions. A label only: on any failure the sheet falls back to
 * the id fragment it showed before.
 */
export async function loadSupervisorNames(): Promise<Record<string, string>> {
    try {
        const supabase = await createServerClient()
        const { data, error } = await supabase.rpc('get_supervisor_display_names')
        if (error || !Array.isArray(data)) return {}
        return Object.fromEntries((data as Array<{ user_id: string; full_name: string | null }>).map(row => [row.user_id, row.full_name ?? '']))
    } catch {
        return {}
    }
}
