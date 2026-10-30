'use client'

import { createContext, useContext } from 'react'
import type { ProductionMode } from '@/lib/production-mode'

export type SettingsBootstrapProfile = {
    userId: string
    org_id: string
    role: string
    full_name?: string | null
    phone?: string | null
    whatsapp_number?: string | null
    whatsapp_opted_in?: boolean
}

export type SettingsBootstrapOrganization = {
    org_id: string
    name: string
    production_mode: ProductionMode | null
}

/** The factory cost profile columns Settings shows as costing defaults. */
export type SettingsBootstrapCostProfile = {
    yarn_shortage_pct: number | string | null
    default_margin_pct: number | string | null
    overhead_mode: string | null
    warping_mode: string | null
    default_warping_mode: string | null
    sizing_mode: string | null
    default_sizing_mode: string | null
    updated_at: string | null
}

export type SettingsBootstrapAccount = {
    email: string
    emailVerified: boolean
}

type SettingsBootstrapValue = {
    profile: SettingsBootstrapProfile
    organization: SettingsBootstrapOrganization
    /** null when no profile row exists; absent when the read failed. */
    costProfile?: SettingsBootstrapCostProfile | null
    account?: SettingsBootstrapAccount
}

const SettingsBootstrapContext = createContext<SettingsBootstrapValue | null>(null)

export function SettingsBootstrapProvider({
    profile,
    organization,
    costProfile,
    account,
    children,
}: SettingsBootstrapValue & { children: React.ReactNode }) {
    return (
        <SettingsBootstrapContext.Provider value={{ profile, organization, costProfile, account }}>
            {children}
        </SettingsBootstrapContext.Provider>
    )
}

export function useSettingsBootstrap() {
    return useContext(SettingsBootstrapContext)
}
