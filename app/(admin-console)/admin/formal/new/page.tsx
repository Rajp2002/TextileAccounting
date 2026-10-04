import { requireFounderPage } from '@/lib/admin/founder'
import { formalOperationsEnabled } from '@/lib/admin/formal'
import { FormalIntake } from '@/components/admin/formal-workspace'
import { SensitiveBoundary } from '@/components/admin/sensitive-boundary'
import { AdminUnavailable } from '@/components/admin/primitives'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const who = await requireFounderPage(), input = await searchParams
    if (!formalOperationsEnabled()) return <AdminUnavailable description="Formal case handling is not enabled. The published contact route remains available."/>
    return <SensitiveBoundary userId={who.userId} kind="founder"><FormalIntake initialKind={input.kind === 'security' ? 'security' : 'privacy'}/></SensitiveBoundary>
}
