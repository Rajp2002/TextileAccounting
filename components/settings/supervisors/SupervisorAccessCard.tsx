'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Loader2, MessageCircle, RefreshCw, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { SwitchField } from '@/components/ui/switch-field'
import { toast } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'
import { supervisorText, type SupervisorTextKey } from '@/lib/i18n/supervisor-access'
import { formatJoinCode, SUPERVISOR_JOIN_PATH } from '@/lib/supervisor-access'
import {
    approveSupervisorAction,
    declineSupervisorAction,
    getSupervisorAccessAction,
    regenerateSupervisorCodeAction,
    removeSupervisorAction,
    setSupervisorJoiningAction,
    type SupervisorAccessState,
    type SupervisorPerson,
} from '@/app/(dashboard)/owner/settings/supervisor-actions'

type Confirm = { kind: 'regenerate' } | { kind: 'decline' | 'remove'; person: SupervisorPerson } | null

function formatDate(value: string) {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(value))
}

export const supervisorAccessQueryKey = (orgId: string) => ['supervisor_access', orgId] as const

/** Owner Settings (Base): the factory code, waiting requests and active supervisors. */
export function SupervisorAccessCard({ orgId, factoryName }: { orgId: string; factoryName: string }) {
    const { language } = useTranslation()
    const text = (key: SupervisorTextKey, values?: Record<string, string | number>) => supervisorText(language, key, values)
    const queryClient = useQueryClient()
    const queryKey = supervisorAccessQueryKey(orgId)
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey,
        // Holds the join code and supervisors' contact details: never persisted on the device.
        meta: { sensitive: true },
        queryFn: async () => {
            const result = await getSupervisorAccessAction()
            if ('error' in result) throw new Error(result.error)
            return result.data
        },
        staleTime: 30_000,
    })
    const [busy, setBusy] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [confirm, setConfirm] = useState<Confirm>(null)

    async function act(id: string, run: () => Promise<{ data: SupervisorAccessState } | { error: SupervisorTextKey }>) {
        setBusy(id)
        try {
            const result = await run()
            if ('error' in result) toast.error(text(result.error))
            else queryClient.setQueryData(queryKey, result.data)
        } catch {
            toast.error(text('actionFailed'))
        } finally {
            setBusy(null)
            setConfirm(null)
        }
    }

    async function copyCode(code: string) {
        try {
            await navigator.clipboard.writeText(formatJoinCode(code))
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error(text('actionFailed'))
        }
    }

    const shareHref = (code: string) => {
        const origin = typeof window === 'undefined' ? '' : window.location.origin
        const message = text('shareMessage', { factory: factoryName, link: `${origin}${SUPERVISOR_JOIN_PATH}?code=${code}`, code: formatJoinCode(code) })
        return `https://wa.me/?text=${encodeURIComponent(message)}`
    }

    return (
        <section aria-labelledby="supervisor-access-heading" className="space-y-5 rounded-2xl border border-hairline bg-surface p-6 shadow-xs sm:p-8">
            <div className="space-y-1">
                <h2 id="supervisor-access-heading" className="text-lg font-bold text-ink">{text('cardTitle')}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{text('cardDescription')}</p>
            </div>

            {isLoading && <div className="space-y-3"><Skeleton className="h-11 rounded-lg" /><Skeleton className="h-24 rounded-lg" /></div>}

            {isError && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
                    <span>{text('loadFailed')}</span>
                    <Button variant="outline" className="min-h-11" onClick={() => refetch()}>{text('retry')}</Button>
                </div>
            )}

            {data && (
                <>
                    <SwitchField variant="pill" checked={data.joiningEnabled} disabled={busy !== null}
                        onCheckedChange={checked => act('joining', () => setSupervisorJoiningAction(checked))}>
                        {text('joiningLabel')}
                    </SwitchField>

                    {data.joiningEnabled && data.code ? (
                        <div className="space-y-3 rounded-xl border border-hairline bg-surface-soft/50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{text('codeHeading')}</p>
                            <p className="font-mono text-3xl font-bold tracking-[0.18em] text-ink" data-i18n-skip="true">{formatJoinCode(data.code)}</p>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" className="min-h-11" onClick={() => copyCode(data.code!)}>
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? text('copied') : text('copyCode')}
                                </Button>
                                <Button asChild variant="outline" className="min-h-11">
                                    <a href={shareHref(data.code)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /> {text('shareWhatsapp')}</a>
                                </Button>
                                <Button variant="ghost" className="min-h-11" disabled={busy !== null} onClick={() => setConfirm({ kind: 'regenerate' })}>
                                    <RefreshCw className="h-4 w-4" /> {text('regenerate')}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">{text('joiningOffHint')}</p>
                    )}

                    <div className="space-y-2">
                        <h3 className="text-sm font-bold text-ink">{text('waitingHeading')}</h3>
                        {data.pending.length === 0 ? <p className="text-sm text-muted-foreground">{text('noWaiting')}</p> : (
                            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                                {data.pending.map(person => (
                                    <li key={person.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-ink" data-i18n-skip="true">{person.fullName}</p>
                                            <p className="truncate text-xs text-muted-foreground" data-i18n-skip="true">{[person.email, person.phone].filter(Boolean).join(' · ')}</p>
                                            <p className="text-xs text-muted-foreground">{text('requestedOn', { date: formatDate(person.requestedAt) })}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button className="min-h-11" disabled={busy !== null} onClick={() => act(person.userId, () => approveSupervisorAction(person.userId))}>
                                                {busy === person.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} {text('approve')}
                                            </Button>
                                            <Button variant="outline" className="min-h-11" disabled={busy !== null} onClick={() => setConfirm({ kind: 'decline', person })}>{text('decline')}</Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-bold text-ink">{text('activeHeading')}</h3>
                        {data.approved.length === 0 ? <p className="text-sm text-muted-foreground">{text('noActive')}</p> : (
                            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                                {data.approved.map(person => (
                                    <li key={person.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-ink" data-i18n-skip="true">{person.fullName}</p>
                                            <p className="truncate text-xs text-muted-foreground" data-i18n-skip="true">{[person.email, person.phone].filter(Boolean).join(' · ')}</p>
                                            {person.decidedAt && <p className="text-xs text-muted-foreground">{text('approvedOn', { date: formatDate(person.decidedAt) })}</p>}
                                        </div>
                                        <Button variant="outline" className="min-h-11" disabled={busy !== null} onClick={() => setConfirm({ kind: 'remove', person })}>{text('remove')}</Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}

            <Dialog open={confirm !== null} onOpenChange={open => { if (!open && busy === null) setConfirm(null) }}>
                <DialogContent className="max-w-md">
                    {confirm && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{confirm.kind === 'regenerate' ? text('regenerateTitle')
                                    : confirm.kind === 'decline' ? text('declineTitle', { name: confirm.person.fullName }) : text('removeTitle', { name: confirm.person.fullName })}</DialogTitle>
                                <DialogDescription>{confirm.kind === 'regenerate' ? text('regenerateBody') : confirm.kind === 'decline' ? text('declineBody') : text('removeBody')}</DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="gap-2">
                                <Button variant="outline" className="min-h-11" disabled={busy !== null} onClick={() => setConfirm(null)}>{text('cancel')}</Button>
                                <Button className="min-h-11" disabled={busy !== null} onClick={() => {
                                    if (confirm.kind === 'regenerate') void act('regenerate', regenerateSupervisorCodeAction)
                                    else if (confirm.kind === 'decline') void act(confirm.person.userId, () => declineSupervisorAction(confirm.person.userId))
                                    else void act(confirm.person.userId, () => removeSupervisorAction(confirm.person.userId))
                                }}>
                                    {busy !== null && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {confirm.kind === 'regenerate' ? text('regenerateConfirm') : confirm.kind === 'decline' ? text('decline') : text('remove')}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    )
}
