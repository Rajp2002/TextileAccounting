import {getCachedSession} from '@/lib/auth'
import {redirect} from 'next/navigation'
import {cookies} from 'next/headers'
import FreeWorkspace from './FreeWorkspace'
import {getOrgPlanAccess} from '@/lib/subscription'
import {WorkspaceHintSync} from '@/components/auth/workspace-hint-sync'
import {hasFreeWorkspaceHint,isFreeWorkspaceAccess,WORKSPACE_HINT_COOKIE} from '@/lib/workspace-hint'
import {parseSidebarPreference,SIDEBAR_PREFERENCE_COOKIE} from '@/lib/sidebar-preference'
export default async function FreeLayout({children}:{children:React.ReactNode}){
 const session=await getCachedSession();if(!session)redirect('/login')
 const access=await getOrgPlanAccess(session.profile.org_id)
 const freeWorkspace=isFreeWorkspaceAccess(access)
 const cookieStore=await cookies()
 const freeWorkspaceHint=hasFreeWorkspaceHint(cookieStore.get(WORKSPACE_HINT_COOKIE)?.value,session.user.id)
 // Proxy guessed /free from a hint that predates an upgrade. The owner layout re-checks the plan and clears the hint.
 if(freeWorkspaceHint&&!freeWorkspace)redirect('/owner/estimator')
 return <>{freeWorkspace&&!freeWorkspaceHint&&<WorkspaceHintSync/>}<FreeWorkspace initialTier={access.effectiveTier} userName={session.profile.full_name??''} sidebarPreference={parseSidebarPreference(cookieStore.get(SIDEBAR_PREFERENCE_COOKIE)?.value)}>{children}</FreeWorkspace></>
}
