'use client'

import { useMemo } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { dispatchSampleChallans, dispatchSampleQualities } from '@/lib/tours/sample-data/dispatch'
import ChallansClient from '@/app/(dashboard)/owner/dispatches/ChallansClient'

/** The real Dispatch page fed sample dispatches. Its editor, detail and dialogs follow the tour step. */
export default function DispatchSampleWorkspace() {
    const { language } = useTranslation()
    const challans = useMemo(() => dispatchSampleChallans(language), [language])
    const qualities = useMemo(() => dispatchSampleQualities(language), [language])
    return <ChallansClient initialData={challans} qualities={qualities} />
}
