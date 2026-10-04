import {listSupportTickets,mutateSupport,supportJson,supportError,supportBody,supportFilters} from '@/lib/support/server'
export const dynamic='force-dynamic'
export async function GET(request:Request){try{return supportJson(await listSupportTickets(supportFilters(request),true))}catch(error){return supportError(error)}}
export async function POST(request:Request){try{return supportJson(await mutateSupport(true,'create',null,await supportBody(request)),201)}catch(error){return supportError(error)}}
