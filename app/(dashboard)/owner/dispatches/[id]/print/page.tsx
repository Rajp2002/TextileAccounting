import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'
import { getChallan } from '../../challan-actions'
import ChallanPrint from '../../ChallanPrint'
export const dynamic = 'force-dynamic'
export default async function PrintChallan({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const { user, profile } = await requireRole(['owner'])
    // The factory's name heads every copy; a blank one falls back to the consignor's.
    const [result, organization] = await Promise.all([
        getChallan(id),
        getCachedOwnerOrganization(user.id, profile.org_id),
    ])
    if (!result.data) notFound()
    const d = result.data
    return <ChallanPrint d={d} businessName={organization.data?.name ?? ''} />
}
