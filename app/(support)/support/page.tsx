import {getSupportPageAccess} from '@/lib/support/page-access'
import {SupportAccessFallback} from '@/components/support/access-fallback'
import {SensitiveBoundary} from '@/components/admin/sensitive-boundary'
import {SupportInbox} from '@/components/support/support-workspace'
import {SupportHistoryExport} from '@/components/support/support-history-export'
import {getOrgPlanAccess} from '@/lib/subscription'
export const dynamic='force-dynamic'
export default async function Page(){
 const access=await getSupportPageAccess()
 if('fallback'in access)return <SupportAccessFallback state={access.fallback}/>
 const compactMobile=await getOrgPlanAccess(access.principal.orgId).then(plan=>plan.effectiveTier==='free'||plan.effectiveTier==='lite').catch(()=>false)
 return <SensitiveBoundary userId={access.principal.userId} kind="customer"><SupportInbox founder={false} compactMobile={compactMobile}/><SupportHistoryExport compactMobile={compactMobile}/></SensitiveBoundary>
}
