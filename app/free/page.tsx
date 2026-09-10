import {freeContext} from '@/lib/free-service'
import FreeClient from './FreeClient'
export const dynamic='force-dynamic'
export const metadata={title:'Weavly Free — Costing',robots:{index:false,follow:false}}
export default async function FreePage(){
 const {user,profile,org}=await freeContext({allowInactive:true})
 return <FreeClient userId={user.id} orgId={profile.org_id} organizationName={org.name} tutorialDismissed={user.user_metadata?.cost_estimate_tutorial_dismissed === true}/>
}
