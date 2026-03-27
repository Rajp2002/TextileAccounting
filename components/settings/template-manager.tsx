'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, Save, FileText, Layers, Weight, Hash } from 'lucide-react'
import { getEstimatorTemplates, upsertEstimatorTemplate, deleteEstimatorTemplate } from '@/app/(dashboard)/owner/estimator/actions'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/context'

export function TemplateManager() {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [templates, setTemplates] = useState<any[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState({
        name: '',
        ppi: 60,
        yarn_denier: 75,
        gsm: 80,
        default_yarn_rate: 140
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
        const res = await upsertEstimatorTemplate({
            id: editingId === 'new' ? undefined : editingId || undefined,
            ...form
        })
        if (res.success) {
            toast.success(t('common.updated'))
            setEditingId(null)
            setForm({ name: '', ppi: 60, yarn_denier: 75, gsm: 80, default_yarn_rate: 140 })
            load()
        } else {
            toast.error(res.error || 'Failed to save template')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return
        const res = await deleteEstimatorTemplate(id)
        if (res.success) {
            toast.success(t('common.removed'))
            load()
        }
    }

    const startEdit = (tpl: any) => {
        setEditingId(tpl.id)
        setForm({
            name: tpl.name,
            ppi: tpl.ppi,
            yarn_denier: tpl.yarn_denier,
            gsm: tpl.gsm,
            default_yarn_rate: tpl.default_yarn_rate
        })
    }

    if (loading && templates.length === 0) return <div className="p-8 text-center text-gray-400">Loading...</div>

    return (
        <Card className="shadow-sm border-gray-200">
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
                            <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setForm({ name: '', ppi: 60, yarn_denier: 75, gsm: 80, default_yarn_rate: 140 }) }}>{t('common.cancel')}</Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label>{t('estimator.settings.fabric_name')}</Label>
                                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Japan Satin, Georgette 60g" />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Hash className="h-3 w-3" /> {t('estimator.core.ppi')}</Label>
                                <Input type="number" value={form.ppi} onChange={e => setForm({...form, ppi: Number(e.target.value)})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Layers className="h-3 w-3" /> {t('estimator.core.denier')}</Label>
                                <Input type="number" value={form.yarn_denier} onChange={e => setForm({...form, yarn_denier: Number(e.target.value)})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Weight className="h-3 w-3" /> {t('estimator.core.gsm')}</Label>
                                <Input type="number" value={form.gsm} onChange={e => setForm({...form, gsm: Number(e.target.value)})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">₹ {t('estimator.process.yarn_rate')}</Label>
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
                                <span>PPI: <b>{tplt.ppi}</b></span>
                                <span>Denier: <b>{tplt.yarn_denier}</b></span>
                                <span>GSM: <b>{tplt.gsm}</b></span>
                                <span>Rate: <b>₹{tplt.default_yarn_rate}</b></span>
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
