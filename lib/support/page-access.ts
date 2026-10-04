import 'server-only'
import {redirect} from 'next/navigation'
import {AdminError} from '@/lib/admin/errors'
import {requireSupportOwner} from './server'
export type SupportPageAccess={principal:{userId:string;orgId:string}}|{fallback:'denied'|'unavailable'}
export async function getSupportPageAccess(returnPath='/support'):Promise<SupportPageAccess>{
 try{return{principal:await requireSupportOwner()}}
 catch(error){
  if(error instanceof AdminError&&error.status===401){const safe=returnPath==='/support'||/^\/support\/[0-9a-f-]{36}$/i.test(returnPath)?returnPath:'/support';redirect(`/login?next=${encodeURIComponent(safe)}`)}
  return{fallback:error instanceof AdminError&&error.status===403?'denied':'unavailable'}
 }
}
