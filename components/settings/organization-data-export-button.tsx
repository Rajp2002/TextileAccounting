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
import { formatDateTime } from '@/lib/format'
import { useTranslation } from '@/lib/i18n/context'

type ExportStatus = 'idle' | 'preparing' | 'ready' | 'download-started' | 'download-failed' | 'failed'

function formatExportDate(value: string) {
    return formatDateTime(value, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
    })
}

export function OrganizationDataExportButton({
    showHistory = false,
    testId = 'settings-data-export',
}: {
    showHistory?: boolean
    testId?: string
}) {
    const { t, tx } = useTranslation()
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
                setHistoryError(tx(result.error))
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
                setDownloadError(tx(userFacingError(error, 'The browser could not start the download.')))
                setStatus('download-failed')
                toast.info(tx('Export generated, but the browser could not start the download. Try again from this page.'))
                return
            }
            setStatus('download-started')
            toast.success(tx('Data export generated'), { description: tx(`Download requested: ${payload.filename}`) })
            if (showHistory) {
                loadHistory()
            }
        } catch (error) {
            setStatus('failed')
            toast.error(tx(userFacingError(error, 'Organization data could not be exported. Check your connection and try again.')))
        }
    })

    const isPending = pending || status === 'preparing'

    return (
        <div className="space-y-4">
            <p className="text-xs text-slate-500">{t('base_plan.export.timezone')}</p>
            <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                    data-testid={testId}
                    onClick={download}
                    disabled={isPending}
                    className="h-auto min-h-10 w-full max-w-full min-w-0 gap-2 whitespace-normal break-words text-center leading-snug sm:h-10 sm:w-auto sm:whitespace-nowrap"
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'failed' || status === 'download-failed' ? <RefreshCw className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                    <span className="min-w-0 break-words">
                        {isPending ? tx('Preparing export') : status === 'failed' || status === 'download-failed' ? tx('Retry export') : tx('Download organization data (complete export)')}
                    </span>
                </Button>
                {status === 'download-started' && (
                    <span role="status" className="flex min-w-0 max-w-full flex-wrap items-center gap-1 break-words text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> <span className="min-w-0 break-words">{tx('Export generated; download requested (complete organization export)')}</span>
                    </span>
                )}
                {status === 'download-failed' && (
                    <span role="alert" className="flex min-w-0 max-w-full flex-wrap items-center gap-1 break-words text-xs font-semibold text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> <span className="min-w-0 break-words">{tx('Export generated; browser download failed')}</span>
                    </span>
                )}
                {status === 'failed' && (
                    <span role="alert" className="flex min-w-0 max-w-full flex-wrap items-center gap-1 break-words text-xs font-semibold text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> <span className="min-w-0 break-words">{tx('No export was generated')}</span>
                    </span>
                )}
                {downloadError && <p role="alert" className="min-w-0 max-w-full break-words text-xs font-semibold text-amber-800">{downloadError}</p>}
            </div>

            {filename && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                    <span className="font-bold">{tx('File:')}</span> <span className="break-all font-mono">{filename}</span>
                    <p className="mt-1 text-emerald-800">{tx('Check the browser Downloads folder. The device save location cannot be verified automatically.')}</p>
                </div>
            )}

            {showHistory && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-black text-slate-950">{tx('Recent organization exports')}</h2>
                            <p className="mt-1 text-xs text-slate-500">{tx('Owner-only exports generated for this organization. The browser save location cannot be verified automatically.')}</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={loadHistory} disabled={pending} className="h-8 text-xs">
                            <RefreshCw className="h-3.5 w-3.5" /> {tx('Refresh')}
                        </Button>
                    </div>
                    {historyError ? (
                        <p className="mt-3 text-xs font-semibold text-red-700">{tx('History could not be loaded')}: {historyError}</p>
                    ) : history.length === 0 ? (
                        <p className="mt-3 text-xs text-slate-500">{tx('No completed exports recorded yet.')}</p>
                    ) : (
                        <div className="mt-3 divide-y divide-slate-200">
                            {history.map(item => (
                                <div key={`${item.changed_at}-${item.record_id}`} className="py-3 first:pt-0 last:pb-0">
                                    <p className="text-xs font-semibold text-slate-800">{formatExportDate(item.changed_at)}</p>
                                    <p className="mt-1 break-words font-mono text-[11px] text-slate-600">{item.description}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">{tx(`Generated by ${item.actor_name}${item.status === 'failed' ? ' · failed' : ''}`)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
