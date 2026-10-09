import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getChallan } from '../../challan-actions'
import ChallanPrint from '../../ChallanPrint'
export const dynamic = 'force-dynamic'
/** The factory's name from its account, which heads every copy; blank if it cannot be read. */
async function factoryName() {
    const { profile } = await requireRole(['owner'])
    const db = await createClient()
    const { data } = await db
        .from('organizations')
        .select('name')
        .eq('id', profile.org_id)
        .single()
    return data?.name ?? ''
}
export default async function PrintChallan({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const [result, businessName] = await Promise.all([
        getChallan(id),
        factoryName(),
    ])
    if (!result.data) notFound()
    const d = result.data
    return <ChallanPrint d={d} businessName={businessName} />
}
