'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {reportPwaWorkflowSuccess} from '@/lib/pwa-workflow-success'
import type {EstimateState,EstimatorV3Totals,CostingResultSnapshot} from '@/lib/estimator'
import type {freeStatus} from '@/lib/free-service'
import {canonicalFreeInputs} from '@/lib/free-estimator-canonical'
import {classifyFreeResponse,confirmFreeReview,correctFreeReview,FREE_EDITING,freeAttemptPayload,freeRequestIdOf,isFreeAttemptUnresolved,reconcileWithSaved,releaseFreeAttempt,resolveFreeSend,retryFreeAttempt,startFreeAttempt,type FreeReceiptQuota,type FreeTransaction,type FreeUnreconciled} from '@/lib/free-transaction'
import {useTranslation} from '@/lib/i18n/context'
import type {SubscriptionTier} from '@/lib/subscription-access'
import type {AuthChangeEvent,Session} from '@supabase/supabase-js'

type FreeStatus=Awaited<ReturnType<typeof freeStatus>>
/** A server-confirmed saved Free costing. `quota` is that receipt's balance, not the current one. */
type Completed={estimate:EstimateState;result:CostingResultSnapshot;totals:EstimatorV3Totals;signature:string;id:string;label:string;quota:FreeReceiptQuota;confirmedAt:string;statusReads:number;
 /** The caller's page snapshot when Calculate was pressed: the leave guard's clean baseline. */
 page:string|null}
const codeOf=(error:unknown)=>error instanceof Error&&error.message?error.message:'FREE_TEMPORARY_ERROR'
const signatureOf=(estimate:EstimateState)=>JSON.stringify(canonicalFreeInputs(estimate))
export function useFreeMeter(enabled:boolean,state:EstimateState,label:string,onPaidActivated?:(tier:SubscriptionTier)=>void) {
 const {language}=useTranslation()
 const [status,setStatus]=useState<FreeStatus|null>(null)
 const [completed,setCompleted]=useState<Completed|null>(null)
 const [transaction,setTransactionState]=useState<FreeTransaction>(FREE_EDITING)
 const [busy,setBusy]=useState(false),[statusError,setStatusError]=useState('')
 // Applied status reads; a save records the count so a later read can verify its balance.
 const [statusReads,setStatusReads]=useState(0),reads=useRef(0)
 // Refs mirror state so overlapping events read the latest transaction synchronously.
 const tx=useRef<FreeTransaction>(FREE_EDITING),lock=useRef(false),account=useRef<string|null>(null),pressPage=useRef<string|null>(null)
 // A send or status read started for an earlier owner is ignored when it returns.
 const generation=useRef(0),statusOrder=useRef({issued:0,applied:0})
 const setTransaction=useCallback((next:FreeTransaction)=>{tx.current=next;setTransactionState(next)},[])
 // Released attempts that may have committed, kept until saved history answers.
 const [unreconciled,setUnreconciledState]=useState<FreeUnreconciled[]>([]),tracked=useRef<FreeUnreconciled[]>([])
 const setUnreconciled=useCallback((next:FreeUnreconciled[])=>{tracked.current=next;setUnreconciledState(next)},[])
 // Verified paid access waits while a Free attempt is unresolved: the paid
 // estimator unmounts this meter, and a paid answer cannot replay the Free receipt.
 const heldPaid=useRef<SubscriptionTier|null>(null)
 const activatePaid=useCallback((tier:SubscriptionTier)=>{heldPaid.current=null;if(onPaidActivated)onPaidActivated(tier);else window.location.assign('/owner/estimator')},[onPaidActivated])
 const holdOrActivatePaid=useCallback(()=>{
  const tier=heldPaid.current,current=tx.current
  if(!tier)return
  if(current.phase==='unknown')setTransaction({...current,code:'FREE_PAID_ACTIVE',retryable:false})
  else if(!isFreeAttemptUnresolved(current))activatePaid(tier)
 },[activatePaid,setTransaction])
 const forgetOwner=useCallback(()=>{generation.current++;setTransaction(FREE_EDITING);setCompleted(null);setUnreconciled([])},[setTransaction,setUnreconciled])
 const readStatus=useCallback(async()=>{
  const order=++statusOrder.current.issued,owner=generation.current
  const r=await fetch('/api/free/status',{cache:'no-store',signal:AbortSignal.timeout(10000)});const data=await r.json() as FreeStatus&{code?:string}
  if(!r.ok)throw new Error(data.code)
  // Only the newest read may describe the current balance. A save also
  // retires every read issued before it (see send), as those predate its debit.
  if(order<=statusOrder.current.applied||owner!==generation.current)return data
  statusOrder.current.applied=order
  if(account.current&&data.account.id!==account.current)forgetOwner()
  account.current=data.account.id
  setStatus(data);setStatusError('');setStatusReads(++reads.current)
  if(data.accessState==='paid'){heldPaid.current=data.plan;holdOrActivatePaid()}
  return data
 },[forgetOwner,holdOrActivatePaid])
 /** Balance check for buttons and focus; a failure marks only the balance unverified. */
 const refresh=useCallback(async()=>{try{return await readStatus()}catch(error){setStatusError(codeOf(error));return null}},[readStatus])
 useEffect(()=>{if(!enabled)return;const load=()=>{void refresh()};load();window.addEventListener('focus',load);return()=>window.removeEventListener('focus',load)},[enabled,refresh])
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
      forgetOwner();setStatus(null);window.location.assign('/login')
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
 },[enabled,status?.account.id,forgetOwner])
 const signature=signatureOf(state)
 const stale=!!completed&&completed.signature!==signature
 // A review covers the exact values reviewed. Editing them is the correction.
 const reviewSignature=transaction.phase==='review'?signatureOf(transaction.attempt.estimate):null
 useEffect(()=>{if(reviewSignature!==null&&reviewSignature!==signature)setTransaction(correctFreeReview(tx.current))},[reviewSignature,signature,setTransaction])
 async function send(next:FreeTransaction) {
  if(next.phase!=='submitting')return
  setTransaction(next)
  const {attempt}=next,owner=generation.current
  let outcome
  try{
   const r=await fetch('/api/free/calculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(freeAttemptPayload(attempt)),cache:'no-store',signal:AbortSignal.timeout(30000)})
   outcome=classifyFreeResponse(r.status,await r.json().catch(()=>null))
  }catch{outcome={kind:'uncertain' as const,code:'FREE_TEMPORARY_ERROR'}}
  if(owner!==generation.current)return
  const resolved=resolveFreeSend(attempt,outcome)
  setTransaction(resolved.transaction)
  holdOrActivatePaid()
  const saved=resolved.saved
  if(saved){
   statusOrder.current.applied=statusOrder.current.issued
   setCompleted({estimate:attempt.estimate,result:saved.result,totals:saved.totals,signature:signatureOf(attempt.estimate),id:saved.savedCostingId,label:attempt.label,quota:saved.quota,confirmedAt:new Date().toISOString(),statusReads:reads.current,page:pressPage.current})
   reportPwaWorkflowSuccess('costing')
   void fetch('/api/free/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:saved.requestId,name:'result_viewed',language,entryPoint:'estimator'})}).catch(()=>{})
   if(saved.quota.remaining===0)void fetch('/api/free/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:saved.requestId,name:'quota_reached',language,entryPoint:'quota'})}).catch(()=>{})
  }
  // The saved result stands on its own; this only refreshes the current balance.
  if(saved||resolved.paidResult)await refresh()
 }
 async function run(task:()=>Promise<void>) {
  if(!enabled||lock.current)return
  lock.current=true;setBusy(true)
  try{await task()}finally{lock.current=false;setBusy(false)}
 }
 /** Start a new explicit calculation. Review and unresolved requests have their own actions. */
 const submit=(acknowledged=false,page:string|null=null)=>run(async()=>{
  const current=tx.current
  if(current.phase!=='editing'&&current.phase!=='rejected'||completed&&!stale)return
  pressPage.current=page
  // Freeze the inputs at the press, not after the token read.
  const estimate=structuredClone(state),name=label.trim()||'Costing',owner=account.current
  let fresh:FreeStatus
  try{fresh=await readStatus()}catch(error){setTransaction({phase:'rejected',code:codeOf(error)});return}
  // A different owner's session never calculates the previous owner's inputs.
  if(fresh.accessState==='paid'||owner&&fresh.account.id!==owner)return
  if(!fresh.requestToken){setTransaction({phase:'rejected',code:fresh.accessState==='active'&&!fresh.estimationEnabled?'FREE_PAUSED':'FREE_ACCESS_DENIED'});return}
  await send(startFreeAttempt(tx.current,{estimate,label:name,requestToken:fresh.requestToken,accountId:fresh.account.id,acknowledged,possiblyCommitted:false}))
 })
 const confirmReview=()=>run(()=>send(confirmFreeReview(tx.current)))
 const retry=()=>run(()=>send(retryFreeAttempt(tx.current)))
 const correctReview=()=>setTransaction(correctFreeReview(tx.current))
 /** Look every tracked attempt up in the owner's saved costings (newest page). */
 const checkUnreconciled=async()=>{
  if(tracked.current.length===0)return
  const owner=generation.current
  let ids:Set<string>|null=null
  try{
   const r=await fetch('/api/free/costings',{cache:'no-store',signal:AbortSignal.timeout(10000)})
   const data=await r.json() as {costings?:Array<{id?:unknown}>}
   if(r.ok&&Array.isArray(data.costings))ids=new Set(data.costings.map(costing=>costing.id).filter((id):id is string=>typeof id==='string'))
  }catch{ids=null}
  if(owner!==generation.current)return
  const before=tracked.current.filter(entry=>entry.check==='found').length
  const next=reconcileWithSaved(tracked.current,ids,new Date().toISOString())
  setUnreconciled(next)
  // A newly found save used a costing; show the balance that includes it.
  if(next.filter(entry=>entry.check==='found').length>before)await refresh()
 }
 /** Only after saved history answered, so stopping is an informed choice. */
 const dismissUnreconciled=(requestId:string|null)=>setUnreconciled(tracked.current.filter(entry=>entry.requestId!==requestId||entry.check!=='found'&&entry.check!=='not_found'))
 const release=()=>{
  const current=tx.current,next=releaseFreeAttempt(current)
  if(current.phase!=='unknown'||next===current)return
  setUnreconciled([...tracked.current,{attempt:current.attempt,requestId:freeRequestIdOf(current.attempt.requestToken),code:current.code,check:'checking',checkedAt:null}])
  setTransaction(next);holdOrActivatePaid()
  void checkUnreconciled()
 }
 // No status read has succeeded since the save, so the shown balance predates its debit.
 const balanceUnverified=!!completed&&!!statusError&&statusReads<=completed.statusReads
 return {enabled,status,completed,stale,transaction,busy,statusError,balanceUnverified,submit,confirmReview,correctReview,retry,release,refresh,
  unreconciled,checkUnreconciled,dismissUnreconciled,
  /** Editing is locked only while the original request may still commit. */
  pending:isFreeAttemptUnresolved(transaction),warning:transaction.phase==='review'}
}
