import {requireFounderPage} from '@/lib/admin/founder'
import {SensitiveBoundary} from '@/components/admin/sensitive-boundary'
import {SupportThread} from '@/components/support/support-workspace'
export const dynamic='force-dynamic'
export default async function Page({params}:{params:Promise<{id:string}>}){
 const who=await requireFounderPage()
 return <SensitiveBoundary userId={who.userId} kind="founder"><SupportThread founder={true} id={(await params).id}/></SensitiveBoundary>
}
