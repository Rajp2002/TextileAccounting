'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Download, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast, userFacingError } from '@/lib/app-notifications'
import { Button } from '@/components/ui/button'
import {
    exportOrganizationData,
    getOrganizationExportHistory,
    type OrganizationExportHistoryItem,
} from '@/app/(dashboard)/owner/settings/data-export'
import { downloadJson } from '@/lib/browser-download'

type ExportStatus = 'idle' | 'preparing' | 'ready' | 'download-started' | 'download-failed' | 'failed'

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
    const [downloadError, setDownloadError] = useState<string | null>(null)
    const historyRequest = useRef(0)

    const loadHistory = () => {
        if (!showHistory) return
        const requestNumber = ++historyRequest.current
        startTransition(async () => {
            const result = await getOrganizationExportHistory()
            if (requestNumber !== historyRequest.current) return
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
        setDownloadError(null)
        try {
            const payload = await exportOrganizationData()
            setStatus('ready')
            setFilename(payload.filename)
            if (showHistory && payload.export_run) {
                setHistory(current => [{
                    changed_at: payload.export_run.exported_at,
                    record_id: payload.export_run.id,
                    actor_name: payload.export_run.actor_name,
                    status: 'generated' as const,
                    description: `Export generated; filename ${payload.filename}`,
                }, ...current.filter(item => item.record_id !== payload.export_run?.id)].slice(0, 10))
            }
            try {
                downloadJson(payload, payload.filename)
            } catch (error) {
                setDownloadError(userFacingError(error, 'The browser could not start the download.'))
                setStatus('download-failed')
                toast.info('Export generated, but the browser could not start the download. Try again from this page.')
                return
            }
            setStatus('download-started')
            toast.success('Data export generated', { description: `Download requested: ${payload.filename}` })
            if (showHistory) {
                loadHistory()
            }
        } catch (error) {
            setStatus('failed')
            toast.error(userFacingError(error, 'Organization data could not be exported. Check your connection and try again.'))
        }
    })

    const isPending = pending || status === 'preparing'

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Button data-testid={testId} onClick={download} disabled={isPending} className="gap-2">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'failed' || status === 'download-failed' ? <RefreshCw className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                    {isPending ? 'Preparing export' : status === 'failed' || status === 'download-failed' ? 'Retry export' : 'Download organization data (complete export)'}
                </Button>
                {status === 'download-started' && (
                    <span role="status" className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Export generated; download requested (complete organization export)
                    </span>
                )}
                {status === 'download-failed' && (
                    <span role="alert" className="flex items-center gap-1 text-xs font-semibold text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5" /> Export generated; browser download failed
                    </span>
                )}
                {status === 'failed' && (
                    <span role="alert" className="flex items-center gap-1 text-xs font-semibold text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5" /> No export was generated
                    </span>
                )}
                {downloadError && <p role="alert" className="text-xs font-semibold text-amber-800">{downloadError}</p>}
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
                            <p className="mt-1 text-xs text-slate-500">Owner-only exports generated for this organization. The browser save location cannot be verified automatically.</p>
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
                                    <p className="mt-1 text-[11px] text-slate-500">Generated by {item.actor_name}{item.status === 'failed' ? ' · failed' : ''}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
