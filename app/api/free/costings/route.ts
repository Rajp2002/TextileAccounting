import {freeContext,freeError} from '@/lib/free-service'
import {freeEditWindow} from '@/lib/free-costing-window'
import {createAdminClient} from '@/lib/supabase/admin'
export async function GET(request: Request) {
 try {
  const params=new URL(request.url).searchParams
  const page=Number(params.get('page') ?? '0')
  const requests=params.get('recalculationRequests')?.split(',') ?? []
  if(requests.length>50||requests.some(id=>!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)))throw new Error('FREE_INVALID_INPUT')
  if(!Number.isSafeInteger(page)||page<0||page>100000)throw new Error('FREE_INVALID_INPUT')
  const {grant,profile,paid,access}=await freeContext({allowInactive:true})
  const {data,error}=await createAdminClient().from('free_saved_costings').select('*').eq('subject_id',grant.subjectId).eq('org_id',profile.org_id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*50,page*50+50)
  if(error)throw new Error('FREE_TEMPORARY_ERROR')
  const {data:serverTime,error:clockError}=await createAdminClient().rpc('free_server_time')
  if(clockError||!serverTime)throw new Error('FREE_TEMPORARY_ERROR')
  let recalculationRequestIds:string[]=[]
  if(requests.length){
   // Revisions retain the costing id; only their own committed receipt proves a request was saved.
   const {data:receipts,error:receiptError}=await createAdminClient().from('free_costing_recalculation_receipts')
    .select('request_id,free_saved_costings!inner(subject_id,org_id)').in('request_id',requests)
    .eq('free_saved_costings.subject_id',grant.subjectId).eq('free_saved_costings.org_id',profile.org_id)
   if(receiptError)throw new Error('FREE_TEMPORARY_ERROR')
   recalculationRequestIds=receipts.map(receipt=>receipt.request_id)
  }
  const editable=!paid&&access.effectiveTier==='free'&&grant.state==='active'
  return Response.json({serverTime,recalculationRequestIds,costings:data.slice(0,50).map(row=>({...row,editWindow:editable?freeEditWindow(row,serverTime):undefined})),nextPage:data.length>50?page+1:null},{headers:{'Cache-Control':'private, no-store'}})
 }catch(error){return freeError(error)}
}
