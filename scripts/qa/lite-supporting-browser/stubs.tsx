/* eslint-disable @typescript-eslint/no-explicit-any -- Explicit local transport intentionally adapts multiple server read shapes. */
import React from 'react'
const params=()=>new URL(location.href).searchParams
const tier=()=>params().get('tier')??'lite'
export const profile={id:'11111111-1111-4111-8111-111111111111',org_id:'22222222-2222-4222-8222-222222222222',full_name:'Synthetic Owner',phone:'+919999900000',role:'owner'}
export const defaultProfile={yarn_shortage_pct:2,default_margin_pct:15,overhead_mode:'direct',default_warping_mode:'in_house',default_sizing_mode:'outsourced',updated_at:'2026-10-01T10:00:00Z'}
export const subscription=()=>({id:'sub-fixture',org_id:profile.org_id,plan_tier:tier(),status:'active',current_start:'2026-01-01T00:00:00Z',current_end:'2026-10-20T00:00:00Z',checkout_purchase_type:'initial_purchase',checkout_amount_paise:299900,created_at:'2026-01-01T00:00:00Z'})
export const attempt=()=>({id:'attempt-fixture',org_id:profile.org_id,client_request_id:'fixture-request',plan_tier:tier(),purchase_type:'renewal',status:params().get('attemptState')??'unknown',provider_order_id:params().has('noOrder')?null:'order_fixture1234567890',provider_payment_id:null,total_amount_paise:149900,created_at:'2026-10-06T00:00:00Z',updated_at:'2026-10-06T00:00:00Z'})
const audit=[{id:'audit-fixture',table_name:'estimator_quotes',action:'UPDATE',record_id:'quality-fixture-11111111',new_data:{name:'Synthetic Shirting',status:'saved',version:2},old_data:{name:'Synthetic Shirting',status:'draft',version:1},changed_at:'2026-10-01T10:00:00Z',profiles:{full_name:'Synthetic Owner',role:'owner'}}]
function result(table:string){if(table==='organizations')return{name:'Synthetic Weaving Factory',production_mode:'in_house'};if(table==='org_subscriptions')return[subscription()];if(table==='subscription_payments')return[{id:'payment-fixture',subscription_id:'sub-fixture',status:'captured',razorpay_payment_id:'pay_fixture1234567890',razorpay_order_id:'order_paidfixture',created_at:'2026-01-01T00:00:00Z',amount_paise:299900,method:'upi'}];if(table==='billing_checkout_attempts')return params().has('attention')?[attempt(),...(params().has('historical')?[{...attempt(),id:'attempt-older',status:'reconciliation_required',provider_order_id:'order_older_98765432',provider_payment_id:'pay_older_12345678',created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'}]:[])]:[];if(table==='audit_log')return params().has('empty')?[]:audit;if(table==='profiles')return[profile];return[]}
export function createClient(){return{from(table:string){const query=new Proxy({}, {get(_target,key){if(key==='then')return(resolve:any)=>resolve({data:result(table),error:params().has('auditError')&&table==='audit_log'?new Error('Synthetic audit failure'):null,count:audit.length});return()=>query}});return query},auth:{getUser:async()=>({data:{user:{id:profile.id,email:'synthetic@example.test',email_confirmed_at:'2026-01-01T00:00:00Z'}}})}}}
export function useUserProfile(){return{data:profile,isLoading:false}}
export async function requireRole(){return{profile,user:{id:profile.id}}}
export async function getSubscriptionDetail(){return{subscription:subscription()}}
export async function getCachedOrgPlanAccess(){return{effectiveTier:tier(),subscriptionTier:tier()}}
export const getOrgPlanAccess=getCachedOrgPlanAccess
export async function getCachedOwnerOrganization(){return{data:{name:'Synthetic Weaving Factory'}}}
export async function getReferralStats(){return null}
export function getBillingReadiness(){return{canCreateOrder:true,publicMessage:'Synthetic checkout only'}}
export async function getFactoryCostProfile(){return{data:defaultProfile}}
export async function getBasePayrollCycleConfig(){return null}
export async function saveBasePayrollCycleConfig(){throw new Error('Fixture cannot change payroll')}
export async function getSafePayrollCycleEffectiveDateAction(){throw new Error('Fixture cannot change payroll')}
const delay=()=>new Promise(resolve=>setTimeout(resolve,300))
export async function updatePersonalInformation(input:{fullName:string}){await delay();return input.fullName==='Synthetic rejected owner'?{error:'Synthetic save could not be confirmed'}:{success:true,fullName:input.fullName}}
export async function updateFactoryDetails(input:{name:string}){await delay();return{success:true,name:input.name}}
export async function requestSecurityPasswordReset(){return{success:true,email:'synthetic@example.test'}}
export async function saveCostingDefaults(input:any){(window as any).__defaultsCalls=((window as any).__defaultsCalls??0)+1;(window as any).__defaultsPayload=input;await delay();return params().has('stale')?{error:'Stale fixture',stale:true}:params().has('saveError')?{error:'Synthetic defaults failure'}:{success:true,defaults:input,updatedAt:'2026-10-06T10:00:00Z'}}
export async function deleteAccountPermanently(){(window as any).__deletionCalls=((window as any).__deletionCalls??0)+1;throw new Error('Synthetic fixture cannot delete')}
export async function getOrganizationExportHistory(){return{data:[{changed_at:'2026-10-01T10:00:00Z',record_id:'export-fixture',actor_name:'Synthetic Owner',status:'generated',description:'Export generated; filename SyntheticFactory_2026-10-01.json'}]}}
export async function exportOrganizationData(){(window as any).__exportCalls=((window as any).__exportCalls??0)+1;await delay();if(params().has('exportError'))throw new Error('Synthetic generation failed');return{filename:'SyntheticFactory_2026-10-06.json',export_run:{id:'export-fixture-new',exported_at:'2026-10-06T10:00:00Z',actor_name:'Synthetic Owner'}}}
export function downloadJson(){if(params().has('downloadError'))throw new Error('Synthetic browser download failed');(window as any).__downloadCalls=((window as any).__downloadCalls??0)+1}
export function usePathname(){return location.pathname}
export function useSearchParams(){return params()}
export function useRouter(){return{push:(href:string)=>location.assign(href),replace:(href:string)=>location.replace(href),refresh(){}}}
export function redirect(href:string){throw new Error('Fixture redirect '+href)}
export function RouteMilestones(){return null}
export function trackPlanEvent(){return Promise.resolve()}
export default function Adapter(props:any){if(props.href)return <a {...props}/>;if(typeof props==='function'){const Lazy=React.lazy(()=>props().then((component:any)=>({default:component.default??component})));return function DynamicFixture(p:any){return <React.Suspense fallback={null}><Lazy {...p}/></React.Suspense>}};return null}

export function useFreeWorkspace(){return{tier:'free',paid:false,activatePaid(){}}}
