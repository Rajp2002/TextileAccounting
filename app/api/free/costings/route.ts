import {freeContext,freeError} from '@/lib/free-service'
import {createAdminClient} from '@/lib/supabase/admin'
export async function GET(request: Request) {
 try {
  const page=Number(new URL(request.url).searchParams.get('page') ?? '0')
  if(!Number.isSafeInteger(page)||page<0||page>100000)throw new Error('FREE_INVALID_INPUT')
  const {grant,profile}=await freeContext({allowInactive:true})
  const {data,error}=await createAdminClient().from('free_saved_costings').select('*').eq('subject_id',grant.subjectId).eq('org_id',profile.org_id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*50,page*50+50)
  if(error)throw new Error('FREE_TEMPORARY_ERROR')
  return Response.json({costings:data.slice(0,50),nextPage:data.length>50?page+1:null},{headers:{'Cache-Control':'private, no-store'}})
 }catch(error){return freeError(error)}
}
