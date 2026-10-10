import {freeContext,getSavedFreeCosting} from '@/lib/free-service'
import FreeClient from './FreeClient'
export const dynamic='force-dynamic'
export const metadata={title:'Weavly Free — Costing',robots:{index:false,follow:false}}
export default async function FreePage({searchParams}:{searchParams:Promise<{costing?:string}>}){
 const {costing}=await searchParams
 const initialFreeCosting=costing?await getSavedFreeCosting(costing):undefined
 const {user,profile,org,access}=await freeContext({allowInactive:true})
 return <FreeClient key={initialFreeCosting?.id ?? "new"} initialFreeCosting={initialFreeCosting} userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }} userId={user.id} orgId={profile.org_id} organizationName={org.name} baseVisible={access.baseVisible === true} liteTrialEligible={access.liteTrialEligible === true} tutorialDismissed={user.user_metadata?.cost_estimate_tutorial_dismissed === true}/>
}
