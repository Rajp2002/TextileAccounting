'use client'
import {createContext,useCallback,useContext,useState} from 'react'
import {usePathname} from 'next/navigation'
import {OwnerSidebar} from '@/components/navigation/owner-sidebar'
import {BrandBackground} from '@/components/brand-background'
import type {SubscriptionTier} from '@/lib/subscription-access'
const WorkspaceContext=createContext<{paid:boolean;tier:SubscriptionTier;activatePaid:(tier:SubscriptionTier)=>void}>({paid:false,tier:'free',activatePaid:()=>{}})
export const useFreeWorkspace=()=>useContext(WorkspaceContext)
export default function FreeWorkspace({children,userName,initialTier='free'}:{children:React.ReactNode;userName:string;initialTier?:SubscriptionTier}){
 const [tier,setTier]=useState(initialTier)
 const pathname=usePathname()
 const paid=['lite','base'].includes(tier)
 const activatePaid=useCallback((verifiedTier:SubscriptionTier)=>setTier(verifiedTier),[])
 return <WorkspaceContext.Provider value={{paid,tier,activatePaid}}><div className="relative isolate min-h-svh overflow-x-hidden bg-background"><BrandBackground variant={pathname === '/free/billing' ? 'billing' : 'app'}/><OwnerSidebar factoryName={paid?'Weavly':'Weavly Free'} userName={userName} productionMode="market_run" subscriptionTier={tier}/><div className="mobile-workspace-content relative z-10 min-w-0 px-safe"><main id="free-main" tabIndex={-1} className="dashboard-main mx-auto min-h-svh w-full min-w-0 max-w-[var(--main-max)] px-3 pb-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] xs:px-4 md:px-6 md:pb-6 md:pt-[calc(1.5rem+var(--safe-area-top))] lg:px-8">{children}</main></div></div></WorkspaceContext.Provider>
}
