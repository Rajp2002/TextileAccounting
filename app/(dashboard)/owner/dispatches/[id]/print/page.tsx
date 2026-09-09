import { notFound } from 'next/navigation'
import { getChallan } from '../../challan-actions'
import ChallanPrint from '../../ChallanPrint'
export const dynamic = 'force-dynamic'
export default async function PrintChallan({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const result = await getChallan(id)
    if (!result.data) notFound()
    const d = result.data
    return <ChallanPrint d={d} />
}
