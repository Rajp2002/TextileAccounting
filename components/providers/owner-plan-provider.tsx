'use client'

import { createContext, useContext } from 'react'
import type { OrgPlanAccess, SubscriptionTier } from '@/lib/subscription-access'

const DEFAULT_ACCESS: OrgPlanAccess = {
    subscriptionTier: 'none',
    effectiveTier: 'none',
}

const OwnerPlanContext = createContext<OrgPlanAccess>(DEFAULT_ACCESS)

export function OwnerPlanProvider({ access, children }: { access: OrgPlanAccess; children: React.ReactNode }) {
    return <OwnerPlanContext.Provider value={access}>{children}</OwnerPlanContext.Provider>
}

export function useOwnerPlan(): SubscriptionTier {
    return useContext(OwnerPlanContext).effectiveTier
}

export function useOwnerPlanAccess() {
    return useContext(OwnerPlanContext)
}
