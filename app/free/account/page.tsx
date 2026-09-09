import {freeContext} from '@/lib/free-service'
import FreeAccount from './FreeAccount'
export default async function Page(){const {org,profile,user}=await freeContext({allowInactive:true});return <FreeAccount name={profile.full_name??''} email={user.email??''} organizationName={org.name}/>}
