'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, Zap, Home, Briefcase, Percent } from 'lucide-react'
import { getEstimatorSettings, upsertEstimatorSettings } from '@/app/(dashboard)/owner/estimator/actions'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/context'

export function EstimatorSettings() {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [settings, setSettings] = useState({
        electricity_rate: 7.5,
        factory_rent_per_day: 0,
        admin_overhead_per_day: 0,
        avg_machine_efficiency: 0.85,
        standard_wastage_percent: 2.0,
        standard_shrinkage_percent: 3.0,
        gst_rate: 5.0,
        is_gst_inclusive: false
    })

    useEffect(() => {
        async function load() {
            setLoading(true)
            const res = await getEstimatorSettings()
            if (res.data) {
                setSettings(res.data)
            }
            setLoading(false)
        }
        load()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        const res = await upsertEstimatorSettings(settings)
        if (res.success) {
            toast.success(t('common.updated'))
        } else {
            toast.error(res.error || 'Failed to update settings')
        }
        setSaving(false)
    }

    if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>

    return (
        <Card className="shadow-sm border-gray-200">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-orange-500" />
                    <CardTitle>{t('estimator.settings.master_title')}</CardTitle>
                </div>
                <CardDescription>{t('estimator.settings.master_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Electricity */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-gray-400" />
                            {t('estimator.settings.elec_rate')}
                        </Label>
                        <Input 
                            type="number" 
                            step="0.1"
                            value={settings.electricity_rate}
                            onChange={e => setSettings({...settings, electricity_rate: Number(e.target.value)})}
                        />
                    </div>

                    {/* Rent */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-gray-400" />
                            {t('estimator.settings.rent')}
                        </Label>
                        <Input 
                            type="number" 
                            value={settings.factory_rent_per_day}
                            onChange={e => setSettings({...settings, factory_rent_per_day: Number(e.target.value)})}
                        />
                    </div>

                    {/* Admin Overhead */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-gray-400" />
                            {t('estimator.settings.admin')}
                        </Label>
                        <Input 
                            type="number" 
                            value={settings.admin_overhead_per_day}
                            onChange={e => setSettings({...settings, admin_overhead_per_day: Number(e.target.value)})}
                        />
                    </div>

                    {/* Efficiency */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Percent className="h-4 w-4 text-gray-400" />
                            {t('estimator.settings.efficiency')}
                        </Label>
                        <Input 
                            type="number" 
                            step="0.01"
                            min="0"
                            max="1"
                            value={settings.avg_machine_efficiency}
                            onChange={e => setSettings({...settings, avg_machine_efficiency: Number(e.target.value)})}
                        />
                    </div>
                </div>

                <div className="pt-4 border-t space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>{t('estimator.settings.gst_rate')}</Label>
                            <Input 
                                type="number" 
                                value={settings.gst_rate}
                                onChange={e => setSettings({...settings, gst_rate: Number(e.target.value)})}
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                            <div className="space-y-0.5">
                                <Label>{t('estimator.settings.gst_inclusive')}</Label>
                                <p className="text-[10px] text-gray-500">{t('estimator.settings.gst_helper')}</p>
                            </div>
                            <Switch 
                                checked={settings.is_gst_inclusive}
                                onCheckedChange={checked => setSettings({...settings, is_gst_inclusive: checked})}
                            />
                        </div>
                    </div>
                </div>

                <Button className="w-full h-11" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {t('common.save')}
                </Button>
            </CardContent>
        </Card>
    )
}
