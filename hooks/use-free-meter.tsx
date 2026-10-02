'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {reportPwaWorkflowSuccess} from '@/lib/pwa-workflow-success'
import Link from 'next/link'
import {UpgradeBenefitsPreview} from '@/components/estimator/UpgradeBenefitsPreview'
import type {EstimateState,EstimatorV3Totals,CostingResultSnapshot} from '@/lib/estimator'
import type {freeStatus} from '@/lib/free-service'
import {canonicalFreeInputs} from '@/lib/free-estimator-canonical'
import {freeText,freeErrorText} from '@/lib/i18n/free-tier'
import {useTranslation} from '@/lib/i18n/context'
import {Button} from '@/components/ui/button'
import type {SubscriptionTier} from '@/lib/subscription-access'
import type {AuthChangeEvent,Session} from '@supabase/supabase-js'

type Completed={estimate:EstimateState;result:CostingResultSnapshot;totals:EstimatorV3Totals;signature:string;id:string}
export function useFreeMeter(enabled:boolean,state:EstimateState,label:string,onPaidActivated?:(tier:SubscriptionTier)=>void) {
 const {language}=useTranslation()
 const [status,setStatus]=useState<Awaited<ReturnType<typeof freeStatus>>|null>(null)
 const [completed,setCompleted]=useState<Completed|null>(null)
 const [busy,setBusy]=useState(false),[submitError,setSubmitError]=useState(''),[statusError,setStatusError]=useState(''),[warning,setWarning]=useState(false)
 const pending=useRef<{estimate:EstimateState;label:string;requestToken:string}|null>(null),lock=useRef(false)
 const refresh=useCallback(async()=>{const r=await fetch('/api/free/status',{cache:'no-store',signal:AbortSignal.timeout(10000)});const data=await r.json();if(!r.ok)throw new Error(data.code);if(data.accessState==='paid'){if(onPaidActivated)onPaidActivated(data.plan);else window.location.assign('/owner/estimator')}setStatus(data);setStatusError('');return data as Awaited<ReturnType<typeof freeStatus>>},[onPaidActivated])
 useEffect(()=>{if(!enabled)return;const load=()=>{void refresh().catch(()=>setStatusError('FREE_TEMPORARY_ERROR'))};load();window.addEventListener('focus',load);return()=>window.removeEventListener('focus',load)},[enabled,refresh])
 useEffect(()=>{
  if(!enabled)return
  // Only Free uses the browser Supabase client, so load it here instead of in
  // the estimator bundle that Lite and Base owners land on after sign-in.
  let cancelled=false,loading=false,unsubscribe:(()=>void)|undefined
  const subscribe=()=>{
   if(cancelled||loading||unsubscribe)return
   loading=true
   import('@/lib/supabase/client').then(({createClient})=>{
    if(cancelled)return
    const {data:{subscription}}=createClient().auth.onAuthStateChange((event:AuthChangeEvent,session:Session|null)=>{
     if(event==='SIGNED_OUT'||event==='SIGNED_IN'&&status?.account.id&&session?.user.id!==status.account.id){
      pending.current=null;setCompleted(null);setStatus(null);window.location.assign('/login')
     }
    })
    unsubscribe=()=>subscription.unsubscribe()
   }).catch(()=>{}).finally(()=>{loading=false})
  }
  subscribe()
  // A failed chunk load must not leave Free without its cross-tab sign-out
  // redirect, so retry when the tab regains focus or the network returns.
  window.addEventListener('focus',subscribe);window.addEventListener('online',subscribe)
  return()=>{cancelled=true;window.removeEventListener('focus',subscribe);window.removeEventListener('online',subscribe);unsubscribe?.()}
 },[enabled,status?.account.id])
 const signature=JSON.stringify(canonicalFreeInputs(state))
 const stale=!!completed&&completed.signature!==signature
 async function submit(ack=false) {
  if(!enabled||lock.current||completed&&!stale&&!pending.current)return
  lock.current=true;setBusy(true);setSubmitError('')
  try {
   if(!pending.current){const fresh=await refresh();if(!fresh.requestToken)throw new Error('FREE_ACCESS_DENIED');pending.current={estimate:structuredClone(state),label:label.trim()||'Costing',requestToken:fresh.requestToken}}
   const payload=pending.current
   const r=await fetch('/api/free/calculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,warningsAcknowledged:ack}),cache:'no-store',signal:AbortSignal.timeout(30000)})
   const data=await r.json()
   if(!r.ok){if(r.status<500&&r.status!==429)pending.current=null;throw new Error(data.code)}
   if(data.needsAcknowledgement){setWarning(true);return}
   setCompleted({estimate:payload.estimate,result:data.result,totals:data.totals,signature:JSON.stringify(canonicalFreeInputs(payload.estimate)),id:data.savedCostingId})
   pending.current=null;setWarning(false);
   reportPwaWorkflowSuccess('costing')
   void fetch('/api/free/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:data.requestId,name:'result_viewed',language,entryPoint:'estimator'})}).catch(()=>{})
   if(data.quota?.remaining===0)void fetch('/api/free/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:data.requestId,name:'quota_reached',language,entryPoint:'quota'})}).catch(()=>{})
   await refresh()
  }catch(e){setSubmitError(e instanceof Error?e.message:'FREE_TEMPORARY_ERROR')}
  finally{lock.current=false;setBusy(false)}
 }
 return {enabled,status,completed,stale,busy,error:submitError,statusError,usageError:submitError||statusError,warning,submit,refresh,pending:!!pending.current}
}
export function FreeMeterPanel({meter}:{meter:ReturnType<typeof useFreeMeter>}) {
 const {language}=useTranslation()
 const [tourStep,setTour]=useState<number|null|undefined>(undefined)
 const tour=tourStep===undefined ? meter.status?.tourState==='new' ? 0 : null : tourStep
 function finishTour(completed=false){setTour(null);void fetch('/api/free/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:crypto.randomUUID(),name:completed?'tour_completed':'tour_skipped',language,entryPoint:'tour'})}).catch(()=>{});document.getElementById('free-tour-help')?.focus()}
 const t=(key:Parameters<typeof freeText>[1],values:Record<string,string|number>={})=>freeText(language,key,values)
 if(!meter.enabled)return null
 return <section data-i18n-skip="true" className="space-y-3 rounded-xl border border-wv-border-default bg-surface p-4" aria-live="polite">
  <p>{t('freeSavedPolicy')}</p>
  {meter.status?.tourEnabled&&<Button id="free-tour-help" variant="outline" onClick={()=>setTour(0)}>{t('help')}</Button>}
  {tour!==null&&meter.status?.tourEnabled&&<div className="space-y-2 rounded border p-3"><p>{t('sample')} · {tour+1}/5</p><p>{t(`tour${tour+1}` as Parameters<typeof freeText>[1])}</p>{tour===3&&<p>₹{meter.status.demo?.productionCostPerM.toFixed(2)}/m</p>}<Button variant="outline" disabled={tour===0} onClick={()=>setTour(tour-1)}>{t('back')}</Button> <Button onClick={()=>tour===4?finishTour(true):setTour(tour+1)}>{t(tour===4?'done':'next')}</Button> <Button variant="ghost" onClick={()=>finishTour()}>{t('skip')}</Button></div>}
  {meter.status&&<><p className="font-semibold">{t('quota',{remaining:meter.status.quota.remaining,limit:meter.status.quota.limit})}</p><p>{t('reset',{date:new Intl.DateTimeFormat(`${language}-IN`,{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(meter.status.quota.resetsAt))})}</p></>}
  {meter.stale&&<p>{t('stale')}</p>}{meter.error&&<p role="alert">{t(freeErrorText(meter.error))}</p>}{meter.warning&&<p>{t('warning')}</p>}
  <div className="flex flex-wrap gap-3"><Button disabled={meter.busy||!meter.status||!meter.pending&&(!meter.status.estimationEnabled||meter.status.quota.remaining===0||!!meter.completed&&!meter.stale)} onClick={()=>void meter.submit(meter.warning)}>{meter.busy?t('calculating'):meter.warning?t('confirm'):meter.pending?t('retry'):t('calculateSave')}</Button><Button variant="outline" onClick={()=>void meter.refresh().catch(()=>{})}>{t('refresh')}</Button><Link className="underline" href="/free/costings">{t('savedCostings')}</Link><Link className="underline" href="/free/account">{t('settings')}</Link></div>
 <UpgradeBenefitsPreview onActivated={()=>void meter.refresh().catch(()=>{})}/>
 </section>
}
