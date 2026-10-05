import {getSupportPageAccess} from '@/lib/support/page-access'
import {SupportAccessFallback} from '@/components/support/access-fallback'
import {SensitiveBoundary} from '@/components/admin/sensitive-boundary'
import {SupportThread} from '@/components/support/support-workspace'
import {getOrgPlanAccess} from '@/lib/subscription'
export const dynamic='force-dynamic'
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const access=await getSupportPageAccess(`/support/${id}`)
 if('fallback'in access)return <SupportAccessFallback state={access.fallback}/>
 const compactMobile=await getOrgPlanAccess(access.principal.orgId).then(plan=>plan.effectiveTier==='free').catch(()=>false)
 return <SensitiveBoundary userId={access.principal.userId} kind="customer"><SupportThread founder={false} id={id} compactMobile={compactMobile}/></SensitiveBoundary>
}
