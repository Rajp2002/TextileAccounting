import {getSupportPageAccess} from '@/lib/support/page-access'
import {SupportAccessFallback} from '@/components/support/access-fallback'
import {SensitiveBoundary} from '@/components/admin/sensitive-boundary'
import {SupportInbox} from '@/components/support/support-workspace'
export const dynamic='force-dynamic'
export default async function Page(){
 const access=await getSupportPageAccess()
 if('fallback'in access)return <SupportAccessFallback state={access.fallback}/>
 return <SensitiveBoundary userId={access.principal.userId} kind="customer"><SupportInbox founder={false}/></SensitiveBoundary>
}
