import { requireFounderPage } from '@/lib/admin/founder'
import { getFormalCase } from '@/lib/admin/formal'
import { FormalCaseWorkspace } from '@/components/admin/formal-workspace'
import { SensitiveBoundary } from '@/components/admin/sensitive-boundary'
import { AdminUnavailable } from '@/components/admin/primitives'
export const dynamic = 'force-dynamic'
export default async function Page({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const who = await requireFounderPage(), { kind, id } = await params
    let detail: Awaited<ReturnType<typeof getFormalCase>> | null = null
    try { detail = await getFormalCase(kind, id, await searchParams) } catch { /* Explicit unavailable state below. */ }
    if (!detail) return <AdminUnavailable description="This case is unavailable, the selected history page is invalid, or formal handling is disabled. No response or change has been confirmed."/>
    return <SensitiveBoundary userId={who.userId} kind="founder"><FormalCaseWorkspace detail={detail}/></SensitiveBoundary>
}
