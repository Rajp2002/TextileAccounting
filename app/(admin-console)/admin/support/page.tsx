import {requireFounderPage} from '@/lib/admin/founder'
import {SensitiveBoundary} from '@/components/admin/sensitive-boundary'
import {SupportInbox} from '@/components/support/support-workspace'
export const dynamic='force-dynamic'
export default async function Page(){
 const who=await requireFounderPage()
 return <SensitiveBoundary userId={who.userId} kind="founder"><SupportInbox founder={true}/></SensitiveBoundary>
}
