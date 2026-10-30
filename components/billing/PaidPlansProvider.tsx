'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

const PaidPlansContext = createContext<{ checkoutOpen: boolean }>({ checkoutOpen: false })

/** Carries whether this factory may check out. Without a provider, checkout is closed. */
export function PaidPlansProvider({ checkoutOpen, children }: { checkoutOpen: boolean; children: ReactNode }) {
    const value = useMemo(() => ({ checkoutOpen }), [checkoutOpen])
    return <PaidPlansContext.Provider value={value}>{children}</PaidPlansContext.Provider>
}

export function usePaidPlans(): { checkoutOpen: boolean } {
    return useContext(PaidPlansContext)
}
