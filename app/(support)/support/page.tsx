import {getSupportPageAccess} from '@/lib/support/page-access'
import {SupportAccessFallback} from '@/components/support/access-fallback'
import {SensitiveBoundary} from '@/components/admin/sensitive-boundary'
import {SupportInbox} from '@/components/support/support-workspace'
export const dynamic='force-dynamic'
export default async function Page(){
 const access=await getSupportPageAccess()
 if('fallback'in access)return <SupportAccessFallback state={access.fallback}/>
 return <SensitiveBoundary userId={access.principal.userId} kind="customer"><SupportInbox founder={false}/><div className="mt-8 border-t border-hairline pt-4"><a href="/api/support/export" download className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Download your public support history</a><p className="mt-1 text-xs text-subtle">Includes your own tickets and in-app conversation.</p></div></SensitiveBoundary>
}
