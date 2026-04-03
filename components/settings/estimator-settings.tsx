'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, Zap, Home, Calculator, Percent } from 'lucide-react'
import { getEstimatorSettings, updateEstimatorSettings } from '@/app/(dashboard)/owner/estimator/actions'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/context'

export function EstimatorSettings() {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [settings, setSettings] = useState({
        machine_rate_per_m: 1.5,
        daily_overhead: 0,
        total_active_machines: 24,
        gst_rate: 5.0,
        is_gst_inclusive: false
    })

    useEffect(() => {
        async function load() {
            setLoading(true)
            const res = await getEstimatorSettings()
            if (res.data) {
                setSettings({
                    machine_rate_per_m: res.data.machine_rate_per_m ?? 1.5,
                    daily_overhead: res.data.daily_overhead ?? 0,
                    total_active_machines: res.data.total_active_machines ?? 24,
                    gst_rate: res.data.gst_rate ?? 5.0,
                    is_gst_inclusive: res.data.is_gst_inclusive ?? false,
                })
            }
            setLoading(false)
        }
        load()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        const res = await updateEstimatorSettings(settings)
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
                    <Calculator className="h-5 w-5 text-indigo-500" />
                    <CardTitle>Estimator Master Configuration</CardTitle>
                </div>
                <CardDescription>Global variables used in the Instant Quote calculator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Machine Rate */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-gray-400" />
                            Target Machine Rate (₹/m)
                        </Label>
                        <Input 
                            type="number" 
                            step="0.05"
                            value={settings.machine_rate_per_m}
                            onChange={e => setSettings({...settings, machine_rate_per_m: Number(e.target.value)})}
                        />
                        <p className="text-[10px] text-muted-foreground">The default weaving gross margin for overheads+profit.</p>
                    </div>

                    {/* Daily Overhead */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-gray-400" />
                            Daily Fixed Overhead (₹)
                        </Label>
                        <Input 
                            type="number" 
                            value={settings.daily_overhead}
                            onChange={e => setSettings({...settings, daily_overhead: Number(e.target.value)})}
                        />
                        <p className="text-[10px] text-muted-foreground">Rent, Admin, Fixed salaries per day.</p>
                    </div>

                    {/* Active Machines */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-gray-400" />
                            Active Machines Setup
                        </Label>
                        <Input 
                            type="number" 
                            value={settings.total_active_machines}
                            onChange={e => setSettings({...settings, total_active_machines: Number(e.target.value)})}
                        />
                        <p className="text-[10px] text-muted-foreground">Used to divide fixed daily overheads.</p>
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
