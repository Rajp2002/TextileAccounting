import {readSupportTicket,supportFilters,supportJson,supportError,mutateSupport,supportBody} from '@/lib/support/server'
export const dynamic='force-dynamic'
type Context={params:Promise<{id:string}>}
export async function GET(request:Request,context:Context){try{return supportJson(await readSupportTicket((await context.params).id,true,supportFilters(request)))}catch(error){return supportError(error)}}
export async function PATCH(request:Request,context:Context){try{return supportJson(await mutateSupport(true,'patch',(await context.params).id,await supportBody(request)))}catch(error){return supportError(error)}}
