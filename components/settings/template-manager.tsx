'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2, FileText, Layers, Hash } from 'lucide-react'
import { getEstimatorTemplates, deleteTemplate } from '@/app/(dashboard)/owner/estimator/actions'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/context'
import type { WarpRow, WeftRow } from '@/lib/estimator'

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
}

export function TemplateManager() {
    const { t } = useTranslation()
    const [loading,   setLoading]   = useState(true)
    const [templates, setTemplates] = useState<TemplateV3[]>([])

    const load = async () => {
        setLoading(true)
        const res = await getEstimatorTemplates()
        if (res.data) setTemplates(res.data as TemplateV3[])
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this fabric template?')) return
        const res = await deleteTemplate(id)
        if (res.success) {
            toast.success(t('common.removed'))
            load()
        } else {
            toast.error(res.error ?? 'Failed to delete')
        }
    }

    // Derive display summary from V3 or V1 template
    function templateSummary(tpl: TemplateV3): { totalEnds: number; firstPicks: number; warpLayers: number; weftLayers: number } {
        if (tpl.warp_rows && tpl.warp_rows.length > 0) {
            return {
                totalEnds:  tpl.warp_rows.reduce((s, r) => s + r.beamEnds, 0),
                firstPicks: tpl.weft_rows?.[0]?.picks ?? 0,
                warpLayers: tpl.warp_rows.length,
                weftLayers: tpl.weft_rows?.length ?? 1,
            }
        }
        // Legacy V1 display
        return {
            totalEnds:  tpl.beam_ends ?? 0,
            firstPicks: tpl.ppi ?? 0,
            warpLayers: 1,
            weftLayers: 1,
        }
    }

    if (loading && templates.length === 0) {
        return (
            <Card className="shadow-sm border-gray-200 mt-6">
                <CardContent className="flex items-center justify-center h-24">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="shadow-sm border-gray-200 mt-6">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <CardTitle>Saved Fabric Templates</CardTitle>
                </div>
                <CardDescription>
                    Manage your frequently used fabric configurations. Templates are saved from the estimator page using "Save as Fabric".
                </CardDescription>
            </CardHeader>
            <CardContent>
                {templates.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed rounded-2xl bg-gray-50/50">
                        <p className="text-sm text-gray-400 italic">
                            No fabric templates saved yet. Open the estimator and use "Save as Fabric" to create your first one.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {templates.map(tpl => {
                            const summary = templateSummary(tpl)
                            const isV3 = !!(tpl.warp_rows && tpl.warp_rows.length > 0)
                            return (
                                <div
                                    key={tpl.id}
                                    className="group p-3 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all duration-200"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h5 className="font-bold text-gray-900 group-hover:text-indigo-700 text-sm">{tpl.name}</h5>
                                            {isV3 && (
                                                <span className="text-[10px] bg-indigo-100 text-indigo-600 rounded-full px-1.5 py-0.5 font-semibold">
                                                    V3 · {summary.warpLayers}W + {summary.weftLayers}F
                                                </span>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDelete(tpl.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1 text-[11px] text-gray-500 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Hash className="h-2.5 w-2.5" />
                                            Ends: <b className="text-gray-700">{summary.totalEnds}</b>
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Layers className="h-2.5 w-2.5" />
                                            Picks: <b className="text-gray-700">{summary.firstPicks} PPI</b>
                                        </span>
                                        {isV3 && tpl.warp_rows && (
                                            <span className="col-span-2 text-gray-400 truncate">
                                                {tpl.warp_rows.map(r => `${r.beamEnds}×${r.calcDenier}D`).join(' + ')}
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
    )
}
