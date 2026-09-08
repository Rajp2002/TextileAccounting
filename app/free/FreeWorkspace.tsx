'use client'
import {createContext,useCallback,useContext,useState} from 'react'
import {OwnerSidebar} from '@/components/navigation/owner-sidebar'
import {BrandBackground} from '@/components/brand-background'
import type {SubscriptionTier} from '@/lib/subscription-access'
const WorkspaceContext=createContext<{paid:boolean;tier:SubscriptionTier;activatePaid:(tier:SubscriptionTier)=>void}>({paid:false,tier:'free',activatePaid:()=>{}})
export const useFreeWorkspace=()=>useContext(WorkspaceContext)
export default function FreeWorkspace({children,userName,initialTier='free'}:{children:React.ReactNode;userName:string;initialTier?:SubscriptionTier}){
 const [tier,setTier]=useState(initialTier)
 const paid=['lite','base','premium','trial'].includes(tier)
 const activatePaid=useCallback((verifiedTier:SubscriptionTier)=>setTier(verifiedTier),[])
 return <WorkspaceContext.Provider value={{paid,tier,activatePaid}}><div className="relative isolate min-h-screen overflow-x-hidden bg-background"><BrandBackground/><OwnerSidebar factoryName={paid?'Weavly':'Weavly Free'} userName={userName} productionMode="market_run" subscriptionTier={tier}/><div className="relative z-10 min-w-0 pb-[calc(72px+env(safe-area-inset-bottom,0px))] px-safe md:!pl-[248px] md:pr-0 md:pb-0"><main className="dashboard-main mx-auto min-h-screen w-full min-w-0 max-w-7xl px-2 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] xs:px-3 md:px-6 md:py-6 lg:px-8">{children}</main></div></div></WorkspaceContext.Provider>
}
