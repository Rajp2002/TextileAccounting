import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { OwnerSidebar } from '../../../components/navigation/owner-sidebar'
import { I18nProvider, useTranslation } from '../../../lib/i18n/context'
import { RouterFixture, usePathname } from './router'
import type { SubscriptionTier } from '../../../lib/subscription-access'
import '../../../app/globals.css'
function Page(){
 const pathname=usePathname();const {t}=useTranslation()
 const key=({'/owner/stock':'qualityStock.title','/owner/stock/yarn':'navigation.yarnStock','/owner/estimator':'navigation.estimate','/owner/rates':'navigation.rates','/owner/quotes':'navigation.costings','/owner/workers':'navigation.workers','/owner/payroll':'navigation.payroll','/free':'navigation.estimate','/free/costings':'navigation.costings'} as Record<string,string>)[pathname]
 return <><h1 className="text-3xl font-semibold">{key?t(key):pathname}</h1><p>Navigation-only fixture. Business content is not loaded.</p><label>Unsaved draft<input className="block border p-2" placeholder="Type a draft" /></label><p>Committed route: {pathname}</p></>
}
function Fixture(){
 const [tier,setTier]=useState<SubscriptionTier>('base');const [blocked,setBlocked]=useState(false)
 return <I18nProvider><RouterFixture blocked={blocked}><OwnerSidebar key={tier} subscriptionTier={tier} factoryName="Navigation QA" productionMode="market_run" yarnReviewDueCount={3}/><main className="space-y-5 p-5 pb-24 md:ml-[248px]"><Page/><label>Access fixture<select value={tier} onChange={e=>setTier(e.target.value as SubscriptionTier)}><option value="base">Base</option><option value="free">Free (existing grants)</option><option value="lite">Lite</option><option value="none">Unresolved access</option></select></label><label className="block"><input type="checkbox" checked={blocked} onChange={e=>setBlocked(e.target.checked)}/> Block fixture navigation before commitment</label></main></RouterFixture></I18nProvider>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
