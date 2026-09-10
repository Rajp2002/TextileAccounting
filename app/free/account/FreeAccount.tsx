'use client'

import React, { useState } from 'react'
import { PlanAwareSettingsView } from '@/components/settings/plan-aware/plan-aware-settings-view'

interface FreeAccountProps {
    name: string
    email: string
    emailVerified?: boolean
    phone?: string | null
    organizationName: string
    organizationId?: string
    userId?: string
}

export default function FreeAccount({
    name,
    email,
    emailVerified = false,
    phone = null,
    organizationName,
    organizationId = '',
    userId = '',
}: FreeAccountProps) {
    const [currentName, setCurrentName] = useState(name)
    const [currentOrgName, setCurrentOrgName] = useState(organizationName)

    return (
        <PlanAwareSettingsView
            profile={{
                userId,
                fullName: currentName,
                email,
                emailVerified,
                phone,
                role: 'owner',
            }}
            factory={{
                id: organizationId,
                name: currentOrgName,
                isAuthorizedEditor: true,
            }}
            tier="free"
            canEditDefaults={false}
            onProfileNameChange={setCurrentName}
            onFactoryNameChange={setCurrentOrgName}
        />
    )
}
