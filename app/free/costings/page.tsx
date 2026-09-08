import {freeContext} from '@/lib/free-service'
import SavedFreeCostings from './SavedFreeCostings'
export default async function Page(){await freeContext({allowInactive:true});return <SavedFreeCostings/>}
