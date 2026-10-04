import {mutateSupport,supportJson,supportError,supportBody} from '@/lib/support/server'
export const dynamic='force-dynamic'
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{return supportJson(await mutateSupport(false,'reply',(await context.params).id,await supportBody(request)))}catch(error){return supportError(error)}}
