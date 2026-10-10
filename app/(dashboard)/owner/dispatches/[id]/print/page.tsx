import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getCachedOwnerOrganization } from '@/lib/owner-organization'
import { orgHasDocumentBranding } from '@/lib/document-branding/access.server'
import { getDocumentBranding } from '@/lib/document-branding/service.server'
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
    // The factory's logo is optional: any branding failure prints the Weavly masthead.
    const [result, organization, branding] = await Promise.all([
        getChallan(id),
        getCachedOwnerOrganization(user.id, profile.org_id),
        orgHasDocumentBranding(profile.org_id)
            .then(entitled => entitled ? getDocumentBranding(profile.org_id, 'delivery_challan') : null)
            .catch(() => null),
    ])
    if (!result.data) notFound()
    const d = result.data
    return <ChallanPrint d={d} businessName={organization.data?.name ?? ''} branding={branding} />
}
