import { redirect } from 'next/navigation'
import { getSupervisorSession } from '@/lib/supervisor-session'
import { SUPERVISOR_SHEET_PATH } from '@/lib/supervisor-access'
import { SupervisorStatusView } from '@/components/supervisor/supervisor-status-view'

/** Supervisor home: the daily sheet once approved, otherwise why it is not available. */
export default async function SupervisorHomePage() {
    const session = await getSupervisorSession()
    if (!session) redirect('/login')
    if (session.status === 'approved' && session.planActive && !session.locked) redirect(SUPERVISOR_SHEET_PATH)
    const state = session.status === 'pending' ? 'pending' : session.status === 'approved' ? 'unavailable' : 'none'
    return <SupervisorStatusView state={state} factoryName={session.factoryName} />
}
