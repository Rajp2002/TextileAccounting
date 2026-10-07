import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSupervisorSession } from '@/lib/supervisor-session'
import { SupervisorShell } from '@/components/supervisor/supervisor-shell'

export const metadata: Metadata = { title: 'Daily sheet · Weavly' }

export default async function SupervisorLayout({ children }: { children: ReactNode }) {
    const session = await getSupervisorSession()
    if (!session) redirect('/login')
    return <SupervisorShell factoryName={session.factoryName} fullName={session.fullName}>{children}</SupervisorShell>
}
