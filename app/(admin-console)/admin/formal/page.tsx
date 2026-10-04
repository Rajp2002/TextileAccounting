import { requireFounderPage } from '@/lib/admin/founder'
import { listFormalCases } from '@/lib/admin/formal'
import { formalListSchema } from '@/lib/admin/formal-contracts'
import { FormalInbox } from '@/components/admin/formal-workspace'
import { AdminPageHeader, AdminUnavailable } from '@/components/admin/primitives'
import { SensitiveBoundary } from '@/components/admin/sensitive-boundary'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const who = await requireFounderPage(), filters = await searchParams
    let report: Awaited<ReturnType<typeof listFormalCases>> | null = null
    const input = formalListSchema.safeParse(filters)
    try { if (input.success) report = await listFormalCases(filters) } catch { /* Explicit unavailable state below. */ }
    if (!report || !input.success) return <><AdminPageHeader title="Formal operations" description="Privacy requests and security incidents remain separate from ordinary support."/><AdminUnavailable description="Case handling is disabled, the selected filters are invalid, or the source is unavailable. No count or outcome has been assumed."/></>
    return <SensitiveBoundary userId={who.userId} kind="founder"><FormalInbox report={report} kind={input.data.kind} queue={input.data.queue} search={input.data.search}/></SensitiveBoundary>
}
