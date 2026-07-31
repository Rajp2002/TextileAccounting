'use client'

import { useEffect, useState, useTransition } from 'react'
import { Download, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
    exportOrganizationData,
    getOrganizationExportHistory,
    type OrganizationExportHistoryItem,
} from '@/app/(dashboard)/owner/settings/data-export'
import { downloadJson } from '@/lib/browser-download'

type ExportStatus = 'idle' | 'preparing' | 'ready' | 'download-started' | 'failed'

function formatExportDate(value: string) {
    return new Date(value).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
    })
}

export function OrganizationDataExportButton({
    showHistory = false,
    testId = 'settings-data-export',
}: {
    showHistory?: boolean
    testId?: string
}) {
    const [pending, startTransition] = useTransition()
    const [status, setStatus] = useState<ExportStatus>('idle')
    const [filename, setFilename] = useState('')
    const [history, setHistory] = useState<OrganizationExportHistoryItem[]>([])
    const [historyError, setHistoryError] = useState<string | null>(null)

    const loadHistory = () => {
        if (!showHistory) return
        startTransition(async () => {
            const result = await getOrganizationExportHistory()
            if (result.error) {
                setHistoryError(result.error)
                return
            }
            setHistoryError(null)
            setHistory(result.data ?? [])
        })
    }

    useEffect(() => {
        loadHistory()
        // The history is intentionally loaded once when the dedicated page opens.
        // A successful export refreshes it explicitly below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showHistory])

    const download = () => startTransition(async () => {
        setStatus('preparing')
        setFilename('')
        try {
            const payload = await exportOrganizationData()
            setStatus('ready')
            setFilename(payload.filename)
            downloadJson(payload, payload.filename)
            setStatus('download-started')
            toast.success('Data export ready', { description: `Download started: ${payload.filename}` })
            if (showHistory) {
                const historyResult = await getOrganizationExportHistory()
                if (!historyResult.error) setHistory(historyResult.data ?? [])
            }
        } catch (error) {
            setStatus('failed')
            toast.error(error instanceof Error ? error.message : 'Failed to export organization data')
        }
    })

    const isPending = pending || status === 'preparing'

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Button data-testid={testId} onClick={download} disabled={isPending} className="gap-2">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'failed' ? <RefreshCw className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                    {isPending ? 'Preparing export' : status === 'failed' ? 'Retry export' : 'Download organization data'}
                </Button>
                {status === 'download-started' && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Download started
                    </span>
                )}
                {status === 'failed' && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5" /> No export was generated
                    </span>
                )}
            </div>

            {filename && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                    <span className="font-bold">File:</span> <span className="break-all font-mono">{filename}</span>
                    <p className="mt-1 text-emerald-800">Check the browser Downloads folder. The device save location cannot be verified automatically.</p>
                </div>
            )}

            {showHistory && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-black text-slate-950">Recent organization exports</h2>
                            <p className="mt-1 text-xs text-slate-500">Owner-only export attempts recorded for this organization.</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={loadHistory} disabled={pending} className="h-8 text-xs">
                            <RefreshCw className="h-3.5 w-3.5" /> Refresh
                        </Button>
                    </div>
                    {historyError ? (
                        <p className="mt-3 text-xs font-semibold text-red-700">History could not be loaded: {historyError}</p>
                    ) : history.length === 0 ? (
                        <p className="mt-3 text-xs text-slate-500">No completed exports recorded yet.</p>
                    ) : (
                        <div className="mt-3 divide-y divide-slate-200">
                            {history.map(item => (
                                <div key={`${item.changed_at}-${item.record_id}`} className="py-3 first:pt-0 last:pb-0">
                                    <p className="text-xs font-semibold text-slate-800">{formatExportDate(item.changed_at)}</p>
                                    <p className="mt-1 break-words font-mono text-[11px] text-slate-600">{item.description}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">Started by {item.actor_name}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
