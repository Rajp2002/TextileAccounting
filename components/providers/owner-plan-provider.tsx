'use client'

import { createContext, useContext } from 'react'
import type { SubscriptionTier } from '@/lib/subscription-access'

const OwnerPlanContext = createContext<SubscriptionTier>('none')

export function OwnerPlanProvider({ tier, children }: { tier: SubscriptionTier; children: React.ReactNode }) {
    return <OwnerPlanContext.Provider value={tier}>{children}</OwnerPlanContext.Provider>
}

export function useOwnerPlan() {
    return useContext(OwnerPlanContext)
}
