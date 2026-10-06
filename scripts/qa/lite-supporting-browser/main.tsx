/* eslint-disable @typescript-eslint/no-explicit-any -- Synthetic-only renderer bridges server elements; no production transport. */
import React from 'react'
import {createRoot} from 'react-dom/client'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import FreeAccount from '../../../app/free/account/FreeAccount'
import SettingsPage from '../../../app/(dashboard)/owner/settings/page'
import BillingPage from '../../../app/(dashboard)/owner/billing/page'
import ExportPage from '../../../app/(dashboard)/owner/data-export/page'
import AuditPage from '../../../app/(dashboard)/owner/settings/audit/page'
import {SupportInbox,SupportThread} from '../../../components/support/support-workspace'
import {OwnerPlanProvider} from '../../../components/providers/owner-plan-provider'
import {I18nProvider} from '../../../lib/i18n/context'
import '../../../app/globals.css'
const params=new URL(location.href).searchParams, tier=params.get('tier')??'lite',view=params.get('view')??(location.pathname.startsWith('/support/')?'thread':location.pathname==='/support'?'support':'settings')
localStorage.setItem('weavly_language',params.get('lang')??'en')
async function resolveAsync(node:any):Promise<any>{if(Array.isArray(node))return Promise.all(node.map(async(child,index)=>{const resolved=await resolveAsync(child);return React.isValidElement(resolved)&&resolved.key===null?React.cloneElement(resolved,{key:index}):resolved}));if(!React.isValidElement(node))return node;const element=node as React.ReactElement<any>;if(typeof element.type==='function'&&element.type.constructor.name==='AsyncFunction')return resolveAsync(await (element.type as any)(element.props));return React.cloneElement(element,{},await resolveAsync(element.props.children))}
const fixture=view==='free-account'?<FreeAccount name="Synthetic Owner" email="synthetic@example.test" phone="+919999900000" organizationName="Synthetic Weaving Factory" organizationId="22222222-2222-4222-8222-222222222222" userId="11111111-1111-4111-8111-111111111111" emailVerified/>:view==='billing'?await resolveAsync(await BillingPage()):view==='export'?await ExportPage():view==='audit'?<AuditPage/>:view==='support'?<SupportInbox founder={false} compactMobile={tier==='lite'||tier==='free'}/>:view==='thread'?<SupportThread founder={false} compactMobile={tier==='lite'||tier==='free'} id="33333333-3333-4333-8333-333333333333"/>:<SettingsPage/>
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}})}><OwnerPlanProvider access={{effectiveTier:tier as any,subscriptionTier:tier as any}}><I18nProvider><main className="mx-auto min-h-screen max-w-7xl bg-background px-3 py-4 text-ink" style={{fontFamily:'system-ui, sans-serif'}}><p className="mb-3 text-xs text-subtle" data-i18n-skip="true">Synthetic Lite component fixture · no account or device evidence</p>{fixture}</main></I18nProvider></OwnerPlanProvider></QueryClientProvider>)
