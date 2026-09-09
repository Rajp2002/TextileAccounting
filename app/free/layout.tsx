import {getCachedSession} from '@/lib/auth'
import {redirect} from 'next/navigation'
import FreeWorkspace from './FreeWorkspace'
import {getOrgPlanAccess} from '@/lib/subscription'
export default async function FreeLayout({children}:{children:React.ReactNode}){
 const session=await getCachedSession();if(!session)redirect('/login')
 const access=await getOrgPlanAccess(session.profile.org_id)
 return <FreeWorkspace initialTier={access.effectiveTier} userName={session.profile.full_name??''}>{children}</FreeWorkspace>
}
