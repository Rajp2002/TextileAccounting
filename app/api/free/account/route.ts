import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { freeError } from '@/lib/free-service'
import { freeJsonBody } from '@/lib/free-http'
import { checkAuthRateLimit } from '@/lib/rate-limit'
export async function POST(request:Request) {
 try {
  const {user}=await requireRole(['owner'],{allowFreeAccount:true})
  if(await checkAuthRateLimit(`free-account:${user.id}`) !== null) throw new Error('FREE_THROTTLED')
  const parsed=z.object({name:z.string().trim().min(2).max(100)}).strict().safeParse(await freeJsonBody(request))
  if(!parsed.success) throw new Error('FREE_INVALID_INPUT')
  const {error}=await createAdminClient().from('profiles').update({full_name:parsed.data.name}).eq('id',user.id)
  if(error) throw new Error('FREE_TEMPORARY_ERROR')
  return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}})
 }catch(error){return freeError(error)}
}
