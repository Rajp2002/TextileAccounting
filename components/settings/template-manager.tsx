'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, Save, FileText, Layers, Hash } from 'lucide-react'
import { getEstimatorTemplates, saveAsFabricTemplate, deleteTemplate } from '@/app/(dashboard)/owner/estimator/actions'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/context'

export function TemplateManager() {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [templates, setTemplates] = useState<any[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState({
        name: '',
        yarn_denier: 75,
        calculated_yarn_denier: 75,
        beam_ends: 3200,
        picks_per_cm: 23,
        reed_space_cm: 110,
        weft_denier: 75,
        tape_length_m: 100,
        shrinkage_pct: 5,
        machine_rate_per_m: 1.5,
        default_yarn_rate: 180,
    })

    const load = async () => {
        setLoading(true)
        const res = await getEstimatorTemplates()
        if (res.data) setTemplates(res.data)
        setLoading(false)
    }

    useEffect(() => {
        load()
    }, [])

    const handleSave = async () => {
        if (!form.name) return toast.error(t('common.fill_all'))
        
        // Note: Currently we only save new templates, not edit existing ones
        // If editing an existing one, we are technically creating a new one right now.
        const res = await saveAsFabricTemplate(form)
        
        if (res.success) {
            toast.success(t('common.updated'))
            if (editingId && editingId !== 'new') {
                // If we edited an old one and saved a new one, delete the old one
                await deleteTemplate(editingId)
            }
            setEditingId(null)
            setForm({
               name: '',
               yarn_denier: 75,
               calculated_yarn_denier: 75,
               beam_ends: 3200,
               picks_per_cm: 23,
               reed_space_cm: 110,
               weft_denier: 75,
               tape_length_m: 100,
               shrinkage_pct: 5,
               machine_rate_per_m: 1.5,
               default_yarn_rate: 180,
            })
            load()
        } else {
            toast.error(res.error || 'Failed to save template')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return
        const res = await deleteTemplate(id)
        if (res.success) {
            toast.success(t('common.removed'))
            load()
        }
    }

    const startEdit = (tpl: any) => {
        setEditingId(tpl.id)
        setForm({
            name: tpl.name,
            yarn_denier: tpl.yarn_denier,
            calculated_yarn_denier: tpl.calculated_yarn_denier ?? tpl.yarn_denier,
            beam_ends: tpl.beam_ends,
            picks_per_cm: tpl.ppi, // Note db uses ppi
            reed_space_cm: tpl.reed_space, // Note db uses reed_space
            weft_denier: tpl.weft_denier,
            tape_length_m: tpl.tape_length_m,
            shrinkage_pct: tpl.shrinkage_pct,
            machine_rate_per_m: tpl.machine_rate_per_m,
            default_yarn_rate: tpl.default_yarn_rate,
        })
    }

    if (loading && templates.length === 0) return <div className="p-8 text-center text-gray-400">Loading...</div>

    return (
        <Card className="shadow-sm border-gray-200 mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <CardTitle>{t('estimator.settings.templates_title')}</CardTitle>
                    </div>
                    <CardDescription>{t('estimator.settings.templates_desc')}</CardDescription>
                </div>
                {!editingId && (
                    <Button size="sm" onClick={() => setEditingId('new')} className="rounded-full">
                        <Plus className="h-4 w-4 mr-1" /> {t('estimator.settings.new_style')}
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                {editingId && (
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4 mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-blue-900">
                                {editingId === 'new' ? t('estimator.settings.new_style') : t('estimator.settings.edit_style')}
                            </h4>
                            <Button variant="ghost" size="sm" onClick={() => { 
                                setEditingId(null); 
                                setForm({
                                    name: '',
                                    yarn_denier: 75,
                                    calculated_yarn_denier: 75,
                                    beam_ends: 3200,
                                    picks_per_cm: 23,
                                    reed_space_cm: 110,
                                    weft_denier: 75,
                                    tape_length_m: 100,
                                    shrinkage_pct: 5,
                                    machine_rate_per_m: 1.5,
                                    default_yarn_rate: 180,
                                }) 
                            }}>{t('common.cancel')}</Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2 md:col-span-3">
                                <Label>{t('estimator.settings.fabric_name')}</Label>
                                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Japan Satin, Georgette 60g" />
                            </div>
                            
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Layers className="h-3 w-3" /> Warp Denier</Label>
                                <Input type="number" value={form.yarn_denier} onChange={e => setForm({...form, yarn_denier: Number(e.target.value), calculated_yarn_denier: Number(e.target.value)})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Hash className="h-3 w-3" /> Beam Ends</Label>
                                <Input type="number" value={form.beam_ends} onChange={e => setForm({...form, beam_ends: Number(e.target.value)})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Layers className="h-3 w-3" /> Weft Denier</Label>
                                <Input type="number" value={form.weft_denier} onChange={e => setForm({...form, weft_denier: Number(e.target.value)})} />
                            </div>
                            
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Hash className="h-3 w-3" /> Picks/CM</Label>
                                <Input type="number" value={form.picks_per_cm} onChange={e => setForm({...form, picks_per_cm: Number(e.target.value)})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">Reed Space (cm)</Label>
                                <Input type="number" value={form.reed_space_cm} onChange={e => setForm({...form, reed_space_cm: Number(e.target.value)})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">₹ Default Yarn Rate</Label>
                                <Input type="number" value={form.default_yarn_rate} onChange={e => setForm({...form, default_yarn_rate: Number(e.target.value)})} />
                            </div>
                        </div>
                        <Button className="w-full mt-2" onClick={handleSave}>
                            <Save className="h-4 w-4 mr-2" /> {t('estimator.settings.save_template')}
                        </Button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {templates.map(tplt => (
                        <div key={tplt.id} className="group p-3 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-sidebar-border hover:shadow-sm transition-all duration-200">
                            <div className="flex items-start justify-between mb-2">
                                <h5 className="font-bold text-gray-900 group-hover:text-primary">{tplt.name}</h5>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-primary" onClick={() => startEdit(tplt)}>
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => handleDelete(tplt.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-y-1 text-[11px] text-gray-500 font-medium">
                                <span>Picks: <b>{tplt.ppi}/cm</b></span>
                                <span>Warp: <b>{tplt.yarn_denier}d</b></span>
                                <span>Ends: <b>{tplt.beam_ends}</b></span>
                                <span>Weft: <b>{tplt.weft_denier}d</b></span>
                            </div>
                        </div>
                    ))}
                    {templates.length === 0 && !editingId && (
                        <div className="md:col-span-2 lg:col-span-3 py-10 text-center border-2 border-dashed rounded-2xl bg-gray-50/50">
                            <p className="text-sm text-gray-400 italic">No templates defined yet. Add your first fabric style!</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
