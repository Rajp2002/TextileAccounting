import {readSupportTicket,supportFilters,supportJson,supportError} from '@/lib/support/server'
export const dynamic='force-dynamic'
type Context={params:Promise<{id:string}>}
export async function GET(request:Request,context:Context){try{return supportJson(await readSupportTicket((await context.params).id,false,supportFilters(request)))}catch(error){return supportError(error)}}
