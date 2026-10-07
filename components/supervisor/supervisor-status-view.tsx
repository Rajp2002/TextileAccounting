'use client'

import { useRouter } from 'next/navigation'
import { AlertTriangle, Clock3, Factory, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { supervisorText, type SupervisorTextKey } from '@/lib/i18n/supervisor-access'

export type SupervisorStatusState = 'pending' | 'unavailable' | 'none'

const COPY: Record<SupervisorStatusState, { title: SupervisorTextKey; body: SupervisorTextKey }> = {
    pending: { title: 'pendingTitle', body: 'pendingBody' },
    unavailable: { title: 'unavailableTitle', body: 'unavailableBody' },
    none: { title: 'notLinkedTitle', body: 'notLinkedBody' },
}

function StatusPanel({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
    return (
        <section className="mx-auto w-full max-w-md space-y-4 rounded-2xl border border-hairline bg-surface p-6 text-center shadow-xs">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-soft text-ink">{icon}</span>
            <div className="space-y-2">
                <h1 className="text-xl font-bold text-ink">{title}</h1>
                <p className="text-sm leading-relaxed text-body">{body}</p>
            </div>
            {action}
        </section>
    )
}

/** Pending approval, an unavailable sheet, or no factory link. */
export function SupervisorStatusView({ state, factoryName }: { state: SupervisorStatusState; factoryName: string | null }) {
    const { language } = useTranslation()
    const router = useRouter()
    const values = { factory: factoryName ?? '' }
    const Icon = state === 'pending' ? Clock3 : state === 'unavailable' ? Lock : Factory
    return (
        <StatusPanel
            icon={<Icon className="h-6 w-6" aria-hidden="true" />}
            title={supervisorText(language, COPY[state].title)}
            body={supervisorText(language, COPY[state].body, values)}
            action={state === 'none' ? undefined : (
                <Button type="button" className="h-11 w-full" onClick={() => router.refresh()}>
                    {supervisorText(language, 'checkAgain')}
                </Button>
            )}
        />
    )
}

export function SupervisorSheetLoadError() {
    const { language } = useTranslation()
    const router = useRouter()
    return (
        <StatusPanel
            icon={<AlertTriangle className="h-6 w-6" aria-hidden="true" />}
            title={supervisorText(language, 'loadError')}
            body={supervisorText(language, 'errorAccess')}
            action={<Button type="button" className="h-11 w-full" onClick={() => router.refresh()}>{supervisorText(language, 'retry')}</Button>}
        />
    )
}
