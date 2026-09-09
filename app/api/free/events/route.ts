import { checkAuthRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { freeContext, freeError, freeStatus } from '@/lib/free-service'
import { freeJsonBody } from '@/lib/free-http'
import { createAdminClient } from '@/lib/supabase/admin'
const schema=z.object({eventId:z.uuid(),name:z.enum(['tour_completed','tour_skipped','result_viewed','quota_reached','locked_feature_requested','upgrade_started']),language:z.enum(['en','gu','hi']),entryPoint:z.enum(['estimator','tour','quota','save','rate_book','billing'])}).strict()
export async function POST(request:Request) {
  try {
    const parsed=schema.safeParse(await freeJsonBody(request)); if(!parsed.success) throw new Error('FREE_INVALID_INPUT')
    const {grant}=await freeContext();
    if(await checkAuthRateLimit(`free-event:${grant.subjectId}`) !== null) throw new Error('FREE_THROTTLED'); const event=parsed.data; const admin=createAdminClient()
    if(event.name==='result_viewed') {
      const {data,error}=await admin.from('free_calculation_receipts').select('request_id').eq('request_id',event.eventId).eq('subject_id',grant.subjectId).maybeSingle()
      if(error||!data) throw new Error('FREE_ACCESS_DENIED')
    }
    if(event.name==='quota_reached' && (await freeStatus()).quota.remaining>0) throw new Error('FREE_INVALID_INPUT')
    if(event.name==='tour_completed'||event.name==='tour_skipped') {
      const {error}=await admin.from('free_account_subjects').update({tour_state:event.name==='tour_completed'?'completed':'skipped'}).eq('id',grant.subjectId)
      if(error) throw new Error('FREE_TEMPORARY_ERROR')
    }
    const {error}=await admin.from('free_funnel_events').upsert({subject_id:grant.subjectId,event_id:event.eventId,event_name:event.name,language:event.language,entry_point:event.entryPoint},{onConflict:'subject_id,event_id,event_name',ignoreDuplicates:true})
    if(error) throw new Error('FREE_TEMPORARY_ERROR')
    return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}})
  } catch(error) { return freeError(error) }
}
