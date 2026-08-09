'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Archive, ArchiveRestore, FileText, Layers, Hash, AlertCircle, RefreshCw } from 'lucide-react'
import { getEstimatorTemplates, archiveTemplate, restoreTemplate } from '@/app/(dashboard)/owner/estimator/actions'
import { toast, userFacingError } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import type { WarpRow, WeftRow } from '@/lib/estimator'
import { cn } from '@/lib/utils'

interface TemplateV3 {
    id:         string
    name:       string
    warp_rows:  WarpRow[] | null
    weft_rows:  WeftRow[] | null
    // Legacy display fields (still present on V1 templates)
    yarn_denier?:       number
    beam_ends?:         number
    ppi?:               number
    weft_denier?:       number
    per_pick_cost_paise?: number
    tape_length_m?:     number
    updated_at:         string
    is_active?:         boolean
}

export function TemplateManager({ className }: { className?: string }) {
    const { t } = useTranslation()
    const [loading,   setLoading]   = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [qualities, setQualities] = useState<TemplateV3[]>([])
    const [qualityToArchive, setQualityToArchive] = useState<TemplateV3 | null>(null)
    const [archivingQualityId, setArchivingQualityId] = useState<string | null>(null)

    const load = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
        if (showLoading) setLoading(true)
        setLoadError(null)
        try {
            const res = await getEstimatorTemplates({ includeArchived: true })
            if (!res.data) {
                setLoadError(userFacingError(res.error, 'Saved fabric qualities could not be loaded. Refresh and try again.'))
                return
            }
            setQualities(res.data as TemplateV3[])
        } catch (error) {
            setLoadError(userFacingError(error, 'Saved fabric qualities could not be loaded. Refresh and try again.'))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            void load({ showLoading: false })
        }, 0)
        return () => clearTimeout(timer)
    }, [load])

    const handleArchive = async (quality: TemplateV3) => {
        const archived = quality.is_active === false
        setArchivingQualityId(quality.id)
        try {
            const res = archived
                ? await restoreTemplate(quality.id, quality.updated_at)
                : await archiveTemplate(quality.id, quality.updated_at)
            if (res.success) {
                toast.success(archived ? 'Quality restored' : 'Quality archived')
                await load()
            } else {
                toast.error(userFacingError(res.error, `Fabric Quality could not be ${archived ? 'restored' : 'archived'}. Try again.`))
            }
        } catch (error) {
            toast.error(userFacingError(error, `Fabric Quality could not be ${archived ? 'restored' : 'archived'}. Try again.`))
        } finally {
            setArchivingQualityId(null)
        }
    }

    const confirmArchive = async () => {
        if (!qualityToArchive) return
        const target = qualityToArchive
        await handleArchive(target)
        setQualityToArchive(null)
    }

    // Derive display summary from V3 or V1 quality
    function qualitySummary(quality: TemplateV3): { totalEnds: number; firstPicks: number; warpLayers: number; weftLayers: number } {
        if (quality.warp_rows && quality.warp_rows.length > 0) {
            return {
                totalEnds:  quality.warp_rows.reduce((s, r) => s + r.beamEnds, 0),
                firstPicks: quality.weft_rows?.[0]?.picks ?? 0,
                warpLayers: quality.warp_rows.length,
                weftLayers: quality.weft_rows?.length ?? 1,
            }
        }
        // Legacy V1 display
        return {
            totalEnds:  quality.beam_ends ?? 0,
            firstPicks: quality.ppi ?? 0,
            warpLayers: 1,
            weftLayers: 1,
        }
    }

    if (loading && qualities.length === 0) {
        return (
            <Card className={cn("rounded-lg border-hairline bg-surface/95 shadow-[var(--shadow-card)]", className)}>
                <CardContent className="flex items-center justify-center h-24">
                    <Loader2 className="h-5 w-5 animate-spin text-saffron" />
                </CardContent>
            </Card>
        )
    }

    if (loadError && qualities.length === 0) {
        return (
            <Card role="alert" className={cn("rounded-lg border-hairline bg-surface/95 shadow-[var(--shadow-card)]", className)}>
                <CardContent className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-ink">Saved Fabric Qualities are unavailable</p>
                            <p className="text-sm leading-relaxed text-muted-foreground">{loadError}</p>
                        </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
        <Card className={cn("rounded-lg border-hairline bg-surface/95 shadow-[var(--shadow-card)]", className)}>
            <CardHeader className="gap-2 border-b border-hairline/70 pb-4">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-info" />
                    <CardTitle className="text-base">{t('estimator.quality.settingsTitle')}</CardTitle>
                </div>
                <CardDescription>
                    {t('estimator.quality.settingsDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
                {loadError && (
                    <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-warning/25 bg-warning-soft/60 p-3 text-sm text-warning-foreground">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{loadError}</span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 gap-1.5 px-2" onClick={() => void load()}>
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry
                        </Button>
                    </div>
                )}
                {qualities.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-hairline bg-canvas/55 py-10 text-center">
                        <p className="text-sm italic text-muted-foreground">
                            {t('estimator.quality.settingsEmpty')}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {qualities.map(quality => {
                            const summary = qualitySummary(quality)
                            const isV3 = !!(quality.warp_rows && quality.warp_rows.length > 0)
                            return (
                                <div
                                    key={quality.id}
                                    className={cn("group rounded-lg border border-hairline bg-canvas/55 p-3 transition-all duration-200 hover:border-hairline-strong hover:bg-surface hover:shadow-sm", quality.is_active === false && 'opacity-75')}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h5 className="text-sm font-bold text-ink group-hover:text-saffron-deep">{quality.name}</h5>
                                            {quality.is_active === false && <span className="text-[10px] font-semibold text-muted-foreground">Archived · read-only</span>}
                                            {isV3 && (
                                                <span className="rounded-full bg-info-soft px-1.5 py-0.5 text-[10px] font-semibold text-info">
                                                    V3 · {summary.warpLayers}W + {summary.weftLayers}F
                                                </span>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-subtle transition-colors hover:bg-surface-soft"
                                            onClick={() => quality.is_active === false ? void handleArchive(quality) : setQualityToArchive(quality)}
                                            disabled={Boolean(archivingQualityId)}
                                            aria-label={quality.is_active === false ? `Restore ${quality.name}` : `Archive ${quality.name}`}
                                        >
                                            {quality.is_active === false ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1 text-[11px] font-medium text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Hash className="h-2.5 w-2.5" />
                                            Ends: <b className="text-body">{summary.totalEnds}</b>
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Layers className="h-2.5 w-2.5" />
                                            Picks: <b className="text-body">{summary.firstPicks} PPI</b>
                                        </span>
                                        {isV3 && quality.warp_rows && (
                                            <span className="col-span-2 truncate text-subtle">
                                                {quality.warp_rows.map(r => `${r.beamEnds}×${r.calcDenier}D`).join(' + ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
        <ConfirmActionDialog
            open={Boolean(qualityToArchive)}
            onOpenChange={open => { if (!open) setQualityToArchive(null) }}
            title={t('estimator.quality.archiveTitle')}
            description={qualityToArchive ? t('estimator.quality.archiveDescription', { name: qualityToArchive.name }) : ''}
            confirmLabel={t('estimator.quality.archiveConfirm')}
            isDestructive
            isLoading={Boolean(qualityToArchive && archivingQualityId === qualityToArchive.id)}
            onConfirm={confirmArchive}
        />
        </>
    )
}
