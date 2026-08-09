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
    join_code: string | null
    join_code_expires_at: string | null
    production_mode: ProductionMode | null
}

type SettingsBootstrapValue = {
    profile: SettingsBootstrapProfile
    organization: SettingsBootstrapOrganization
}

const SettingsBootstrapContext = createContext<SettingsBootstrapValue | null>(null)

export function SettingsBootstrapProvider({
    profile,
    organization,
    children,
}: SettingsBootstrapValue & { children: React.ReactNode }) {
    return (
        <SettingsBootstrapContext.Provider value={{ profile, organization }}>
            {children}
        </SettingsBootstrapContext.Provider>
    )
}

export function useSettingsBootstrap() {
    return useContext(SettingsBootstrapContext)
}
