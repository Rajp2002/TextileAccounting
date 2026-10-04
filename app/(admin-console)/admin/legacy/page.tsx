import type { Metadata } from 'next'
import { requireFounderPage } from '@/lib/admin/founder'
import { AdminError } from '@/lib/admin/errors'
import { legacyReadsEnabled, listLegacyRecords } from '@/lib/admin/legacy-read'
import { LegacyLimits, LegacyList } from '@/components/admin/legacy-records'
import { AdminEmptyState, AdminPageHeader, AdminSurface, AdminUnavailable } from '@/components/admin/primitives'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: 'Formal operations', description: 'Retained read-only privacy and security records.' }

export default async function LegacyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    await requireFounderPage()
    if (!legacyReadsEnabled()) return <><AdminPageHeader title="Formal operations" description="Privacy and security records are preserved while their current operational owners are confirmed."/><AdminSurface><AdminEmptyState title="Fallback access is awaiting review" description="The retained read view is disabled until its operational owner and access requirements are confirmed. Changes remain separately gated."/></AdminSurface><LegacyLimits/></>
    const values = await searchParams, query = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => [key, Array.isArray(value) ? '\u0000' : value]))
    let report
    try { report = await listLegacyRecords(query) }
    catch (error) { return <><AdminPageHeader title="Formal operations" description="Read-only review of retained privacy and security sources."/><AdminUnavailable title={error instanceof AdminError && error.status === 400 ? 'Check the register filters' : 'Formal records are unavailable'} description={error instanceof AdminError ? error.publicMessage : 'The source could not be established. No empty register has been assumed.'}/><LegacyLimits/></> }
    return <><span hidden data-signin-ready="true"/><AdminPageHeader title="Formal operations" description="Inspect retained privacy grievances, security incidents, agreements and notices. Each list is bounded and read-only."/><LegacyList report={report}/><LegacyLimits/></>
}
