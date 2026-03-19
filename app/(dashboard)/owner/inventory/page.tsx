'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, PackageSearch, BookmarkCheck, FileText, Settings2, Trash2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from 'sonner'
import { formatINR } from '@/lib/finance'
import { addQuality, addYarnBatch, loadSuratQualityTemplates, closeYarnBatch } from '@/app/(dashboard)/owner/actions'
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign } from 'lucide-react'

export default function InventoryPage() {
    const { data: userProfile } = useUserProfile()
    const supabase = createClient()
    const queryClient = useQueryClient()

    const [isSubmitting, setIsSubmitting] = useState(false)

    // Quality Form State
    const [qualityModalOpen, setQualityModalOpen] = useState(false)
    const [qualityForm, setQualityForm] = useState({ 
        name: '', 
        target_yield: '', 
        avg_sale_price_per_m: '',
        default_worker_rate_per_m: '' 
    })

    // Batch Form State
    const [batchModalOpen, setBatchModalOpen] = useState(false)
    const [batchForm, setBatchForm] = useState({ name: '', quality_id: '', total_weight_kg: '' })

    const [auditBatchId, setAuditBatchId] = useState<string | null>(null)
    const [auditModalOpen, setAuditModalOpen] = useState(false)
    const [leftoverWeightKg, setLeftoverWeightKg] = useState<string>('0')

    // Real-time listener for production updates
    useEffect(() => {
        if (!userProfile?.org_id) return

        const channel = supabase
            .channel('inventory_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'production_logs', filter: `org_id=eq.${userProfile.org_id}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['yarn_batches'] })
                    queryClient.invalidateQueries({ queryKey: ['batch_yield_report'] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userProfile?.org_id, queryClient, supabase])

    // Qualities Query
    const { data: qualities, isLoading: qualitiesLoading } = useQuery({
        queryKey: ['qualities', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('qualities')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .order('name')
            if (error) throw error
            return data
        }
    })

    // Batches Query
    const { data: batches, isLoading: batchesLoading } = useQuery({
        queryKey: ['yarn_batches', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('yarn_batches')
                .select(`
                    *,
                    qualities(name, target_yield, avg_sale_price_per_m),
                    machines(name)
                `)
                .eq('org_id', userProfile!.org_id)
                .order('created_at', { ascending: false })
            if (error) throw error
            return data
        }
    })

    // Audit Report Query (RPC)
    const { data: auditReport, isLoading: auditLoading } = useQuery({
        queryKey: ['batch_yield_report', userProfile?.org_id, auditBatchId],
        enabled: !!userProfile?.org_id && !!auditBatchId && auditModalOpen,
        queryFn: async () => {
            const { data, error } = await supabase
                .rpc('get_batch_yield_report', { p_org_id: userProfile!.org_id })
            if (error) throw error
            return data.find((r: any) => r.batch_id === auditBatchId)
        }
    })

    return (
        <div className="space-y-6 pb-24">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Yarn & Qualities</h1>
                <p className="text-gray-500 mt-1">Manage fabric qualities and active yarn batches.</p>
            </div>

            <Tabs defaultValue="batches" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-sm">
                    <TabsTrigger value="batches" className="flex items-center gap-2">
                        <PackageSearch className="w-4 h-4" /> Batches (Beams)
                    </TabsTrigger>
                    <TabsTrigger value="qualities" className="flex items-center gap-2">
                        <BookmarkCheck className="w-4 h-4" /> Qualities
                    </TabsTrigger>
                </TabsList>

                {/* YARN BATCHES TAB */}
                <TabsContent value="batches" className="mt-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Active & Consumed Batches</h2>
                        <Button 
                            className="bg-teal-600 hover:bg-teal-700"
                            onClick={() => setBatchModalOpen(true)}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Batch
                        </Button>
                    </div>

                    {batchesLoading ? (
                        <div className="flex justify-center p-8"><span className="animate-pulse">Loading batches...</span></div>
                    ) : batches?.length === 0 ? (
                        <Card className="border-dashed bg-gray-50/50">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                                <div className="p-4 bg-teal-50 rounded-full mb-4">
                                    <PackageSearch className="w-8 h-8 text-teal-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">No Yarn Batches</h3>
                                <p className="text-gray-500 max-w-sm mt-1 mb-4">
                                    Start tracking your yarn by adding a new batch (or beam).
                                </p>
                                <Button 
                                    variant="outline" 
                                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
                                    onClick={() => setBatchModalOpen(true)}
                                >
                                    Create First Batch
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {batches?.map((batch: any) => (
                                <Card key={batch.id} className="relative overflow-hidden hover:border-teal-200 transition-colors">
                                    {/* Status Tab */}
                                    <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-bl-lg ${batch.status === 'active' ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-600'}`}>
                                        {batch.status}
                                    </div>

                                    <CardContent className="p-5 pt-6 space-y-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">{batch.name}</h3>
                                            <p className="text-sm font-medium text-indigo-600 truncate">{batch.qualities?.name}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg text-sm">
                                            <div>
                                                <div className="text-gray-500 mb-1">Weight</div>
                                                <div className="font-semibold">{batch.total_weight_kg} kg</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-500 mb-1">Expected Prod.</div>
                                                <div className="font-semibold text-teal-700">
                                                    {Number(batch.total_weight_kg) * Number(batch.qualities?.target_yield)} m
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs text-gray-500 mb-1 mt-2">Current Machine Location</div>
                                            <div className="text-sm font-medium h-6">
                                                {batch.machines ? (
                                                    <span className="bg-gray-900 text-white px-2 py-1 rounded text-xs">{batch.machines.name}</span>
                                                ) : (
                                                    <span className="text-gray-400 italic">Storage / Unassigned</span>
                                                )}
                                            </div>
                                        </div>

                                        {batch.status === 'active' && (
                                            <Button 
                                                variant="outline" 
                                                className="w-full mt-2 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 font-semibold"
                                                onClick={() => {
                                                    setAuditBatchId(batch.id)
                                                    setAuditModalOpen(true)
                                                }}
                                            >
                                                <FileText className="w-4 h-4 mr-2" /> Mark Consumed (Audit)
                                            </Button>
                                        )}
                                        {batch.status === 'consumed' && (
                                            <Button 
                                                variant="outline" 
                                                className="w-full mt-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-medium"
                                                onClick={() => {
                                                    setAuditBatchId(batch.id)
                                                    setAuditModalOpen(true)
                                                }}
                                            >
                                                <FileText className="w-4 h-4 mr-2" /> View Final Audit
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* QUALITIES TAB */}
                <TabsContent value="qualities" className="mt-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Fabric Qualities</h2>
                        <Button 
                            className="bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => setQualityModalOpen(true)}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Quality
                        </Button>
                    </div>

                    {qualitiesLoading ? (
                        <div className="flex justify-center p-8"><span className="animate-pulse">Loading qualities...</span></div>
                    ) : qualities?.length === 0 ? (
                        <Card className="border-dashed bg-gray-50/50">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                                <div className="p-4 bg-indigo-50 rounded-full mb-4">
                                    <BookmarkCheck className="w-8 h-8 text-indigo-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">No Qualities Defined</h3>
                                <p className="text-gray-500 max-w-sm mt-1 mb-4">
                                    Define the fabrics you manufacture (e.g. 60g Georgette, Cotton 40s) along with their target yields.
                                </p>
                                <Button 
                                    variant="outline" 
                                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-medium"
                                    onClick={async () => {
                                        setIsSubmitting(true)
                                        const res = await loadSuratQualityTemplates()
                                        setIsSubmitting(false)
                                        if (res.error) toast.error(res.error)
                                        else {
                                            toast.success('Surat templates loaded!')
                                            queryClient.invalidateQueries({ queryKey: ['qualities', userProfile?.org_id] })
                                        }
                                    }}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? "Loading..." : "Load Surat Presets (Templates)"}
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {qualities?.map((quality: any) => (
                                <Card key={quality.id} className="hover:border-indigo-200 transition-colors">
                                    <CardContent className="p-5 flex justify-between items-start">
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-gray-900">{quality.name}</h3>
                                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                                                <span className="flex items-center bg-gray-100 px-2 py-1 rounded">
                                                    Target: <strong className="ml-1 text-gray-900">{quality.target_yield} m/kg</strong>
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Est. Sale Value: <strong className="text-green-700">{formatINR(quality.avg_sale_price_per_m)}/m</strong>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Worker Rate: <strong className="text-teal-700">₹{quality.default_worker_rate_per_m || 0}/m</strong>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 text-gray-400">
                                            <button className="hover:text-indigo-600"><Settings2 className="w-4 h-4" /></button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Quality Modal */}
            <Dialog open={qualityModalOpen} onOpenChange={setQualityModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Fabric Quality</DialogTitle>
                        <DialogDescription>Define a fabric target yield to track machine efficiency.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Fabric Name</Label>
                            <Input 
                                placeholder="e.g., 60g Georgette" 
                                value={qualityForm.name}
                                onChange={e => setQualityForm({ ...qualityForm, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Target Yield (m/kg)</Label>
                                <Input 
                                    type="number" step="0.1" placeholder="e.g., 9.5" 
                                    value={qualityForm.target_yield}
                                    onChange={e => setQualityForm({ ...qualityForm, target_yield: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Avg Sale Price (₹/m)</Label>
                                <Input 
                                    type="number" placeholder="e.g., 25" 
                                    value={qualityForm.avg_sale_price_per_m}
                                    onChange={e => setQualityForm({ ...qualityForm, avg_sale_price_per_m: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Worker Rate (₹/m)</Label>
                                <Input 
                                    type="number" step="0.01" placeholder="e.g., 4.50" 
                                    value={qualityForm.default_worker_rate_per_m}
                                    onChange={e => setQualityForm({ ...qualityForm, default_worker_rate_per_m: e.target.value })}
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-400">Worker rate is auto-applied to machines using this quality.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQualityModalOpen(false)}>Cancel</Button>
                        <Button 
                            className="bg-indigo-600 hover:bg-indigo-700"
                            disabled={isSubmitting || !qualityForm.name || !qualityForm.target_yield}
                            onClick={async () => {
                                setIsSubmitting(true)
                                const res = await addQuality({
                                    name: qualityForm.name,
                                    target_yield: Number(qualityForm.target_yield),
                                    avg_sale_price_per_m: Number(qualityForm.avg_sale_price_per_m || 0),
                                    default_worker_rate_per_m: Number(qualityForm.default_worker_rate_per_m || 0)
                                })
                                setIsSubmitting(false)
                                if (res.error) toast.error(res.error)
                                else {
                                    toast.success("Quality added successfully")
                                    setQualityModalOpen(false)
                                    setQualityForm({ name: '', target_yield: '', avg_sale_price_per_m: '', default_worker_rate_per_m: '' })
                                    queryClient.invalidateQueries({ queryKey: ['qualities', userProfile?.org_id] })
                                }
                            }}
                        >
                            {isSubmitting ? "Saving..." : "Save Quality"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Batch Modal */}
            <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Yarn Batch (Beam)</DialogTitle>
                        <DialogDescription>Register a new physical yarn beam or bag into inventory.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Batch Name / Identification</Label>
                            <Input 
                                placeholder="e.g., Batch #205" 
                                value={batchForm.name}
                                onChange={e => setBatchForm({ ...batchForm, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Fabric Quality</Label>
                            <Select 
                                value={batchForm.quality_id} 
                                onValueChange={v => setBatchForm({ ...batchForm, quality_id: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a quality" />
                                </SelectTrigger>
                                <SelectContent>
                                    {qualities?.map((q: any) => (
                                        <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {(!qualities || qualities.length === 0) && (
                                <p className="text-xs text-rose-500">Please add Qualities first.</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Total Weight (kg)</Label>
                            <Input 
                                type="number" step="0.1" placeholder="e.g., 100.5" 
                                value={batchForm.total_weight_kg}
                                onChange={e => setBatchForm({ ...batchForm, total_weight_kg: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBatchModalOpen(false)}>Cancel</Button>
                        <Button 
                            className="bg-teal-600 hover:bg-teal-700"
                            disabled={isSubmitting || !batchForm.name || !batchForm.quality_id || !batchForm.total_weight_kg}
                            onClick={async () => {
                                setIsSubmitting(true)
                                const res = await addYarnBatch({
                                    name: batchForm.name,
                                    quality_id: batchForm.quality_id,
                                    total_weight_kg: Number(batchForm.total_weight_kg)
                                })
                                setIsSubmitting(false)
                                if (res.error) toast.error(res.error)
                                else {
                                    toast.success("Batch added successfully")
                                    setBatchModalOpen(false)
                                    setBatchForm({ name: '', quality_id: '', total_weight_kg: '' })
                                    queryClient.invalidateQueries({ queryKey: ['yarn_batches', userProfile?.org_id] })
                                }
                            }}
                        >
                            {isSubmitting ? "Saving..." : "Save Batch"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Final Audit Report Modal */}
            <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Batch Audit Report</DialogTitle>
                        <DialogDescription>
                            Efficiency and leakage analysis for {auditReport?.batch_name || 'this batch'}.
                        </DialogDescription>
                    </DialogHeader>

                    {auditLoading ? (
                        <div className="py-12 text-center animate-pulse text-gray-500">Generating report...</div>
                    ) : auditReport ? (
                        <div className="space-y-6 py-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card className="bg-gray-50/50">
                                    <CardContent className="p-4">
                                        <div className="text-xs text-gray-500 font-medium">Quality</div>
                                        <div className="font-bold text-gray-900 mt-1 truncate">{auditReport.quality_name}</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-gray-50/50">
                                    <CardContent className="p-4">
                                        <div className="text-xs text-gray-500 font-medium">Input Weight</div>
                                        <div className="font-bold text-gray-900 mt-1">{auditReport.total_weight_kg} kg</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-gray-50/50">
                                    <CardContent className="p-4">
                                        <div className="text-xs text-gray-500 font-medium">Target Yield</div>
                                        <div className="font-bold text-gray-900 mt-1">{auditReport.target_yield} m/kg</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-gray-50/50">
                                    <CardContent className="p-4">
                                        <div className="text-xs text-gray-500 font-medium">Actual Yield</div>
                                        <div className={`font-bold mt-1 ${auditReport.actual_yield < auditReport.target_yield ? 'text-rose-600' : 'text-teal-600'}`}>
                                            {Number(auditReport.actual_yield).toFixed(2)} m/kg
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Meters Comparison */}
                            <div className="bg-white border rounded-xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <PackageSearch className="w-32 h-32" />
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-indigo-500" /> Production vs Expected
                                </h3>
                                
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-gray-600">Expected Meters (Weight × Target)</span>
                                            <span className="font-bold text-gray-900">
                                                {(Number(auditReport.total_weight_kg) * Number(auditReport.target_yield)).toFixed(1)} m
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3">
                                            <div className="bg-gray-400 h-3 rounded-full" style={{ width: '100%' }}></div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-gray-600">Actual Produced Meters</span>
                                            <span className="font-bold text-indigo-700">
                                                {Number(auditReport.total_meters_produced).toFixed(1)} m
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3">
                                            <div 
                                                className={`h-3 rounded-full transition-all ${
                                                    Number(auditReport.efficiency_variance) < 0 ? 'bg-rose-500' : 'bg-teal-500'
                                                }`} 
                                                style={{ 
                                                    width: `${Math.min(100, (Number(auditReport.total_meters_produced) / (Number(auditReport.total_weight_kg) * Number(auditReport.target_yield))) * 100)}%` 
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t flex items-center justify-between">
                                    <div className="text-sm font-medium text-gray-600">Efficiency Variance ($V$)</div>
                                    <div className={`text-lg font-bold flex items-center gap-1 ${
                                        Number(auditReport.efficiency_variance) < -5 ? 'text-rose-600' 
                                        : Number(auditReport.efficiency_variance) > 10 ? 'text-amber-600'
                                        : 'text-teal-600'
                                    }`}>
                                        {Number(auditReport.efficiency_variance) > 0 ? '+' : ''}{Number(auditReport.efficiency_variance).toFixed(2)}%
                                    </div>
                                </div>
                            </div>

                            {/* "Shet" Alert (Monetary Loss) */}
                            {Number(auditReport.efficiency_variance) < -5 && (
                                <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 flex items-start gap-4 shadow-sm">
                                    <div className="bg-rose-100 p-3 rounded-full shrink-0">
                                        <AlertTriangle className="w-6 h-6 text-rose-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-rose-900 text-lg">Significant Leakage Detected</h4>
                                        <p className="text-rose-700 text-sm mt-1">
                                            This beam underperformed its target yield by over 5%, indicating potential waste or theft.
                                        </p>
                                        <div className="mt-3 bg-white/60 rounded-lg p-3 inline-block">
                                            <div className="text-xs text-rose-800 font-semibold uppercase tracking-wider mb-1">Estimated Monetary Loss</div>
                                            <div className="text-2xl font-black text-rose-600">
                                                {formatINR(auditReport.monetary_loss)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Padding Alert */}
                            {Number(auditReport.efficiency_variance) > 10 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-amber-900">Abnormal Over-Production</h4>
                                        <p className="text-amber-800 text-sm mt-1">
                                            Yield is more than 10% above target. Verify if supervisors are padding production numbers or if the target yield is misconfigured.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Leftover Yarn Entry (Tali Gap) */}
                            {auditReport?.batch_status === 'active' && (
                                <div className="mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                                    <div className="flex items-center gap-2 mb-3">
                                        <TrendingDown className="w-4 h-4 text-indigo-600" />
                                        <Label className="text-sm font-bold text-indigo-900">Leftover Yarn? (Tali)</Label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <Input 
                                                type="number" 
                                                step="0.1" 
                                                value={leftoverWeightKg}
                                                onChange={e => setLeftoverWeightKg(e.target.value)}
                                                className="pr-8 bg-white"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">kg</span>
                                        </div>
                                        <p className="text-[10px] text-indigo-700 leading-tight flex-1">
                                            If any yarn remains on the beam, enter it here to exclude it from the audit.
                                        </p>
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div className="py-12 text-center text-gray-500">No data found for this batch.</div>
                    )}
                    
                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setAuditModalOpen(false)}>Close Summary</Button>
                        
                        {auditReport?.batch_status === 'active' && (
                            <Button 
                                className="bg-rose-600 hover:bg-rose-700 shadow-sm"
                                disabled={isSubmitting}
                                onClick={async () => {
                                    if(!auditReport.batch_id) return
                                    setIsSubmitting(true)
                                    const res = await closeYarnBatch(auditReport.batch_id, Number(leftoverWeightKg || 0))
                                    setIsSubmitting(false)
                                    if (res.error) toast.error(res.error)
                                    else {
                                        toast.success("Batch successfully closed and audited.")
                                        setAuditModalOpen(false)
                                        setLeftoverWeightKg('0')
                                        queryClient.invalidateQueries({ queryKey: ['yarn_batches', userProfile?.org_id] })
                                    }
                                }}
                            >
                                {isSubmitting ? "Closing..." : "Mark as Consumed (Close Batch)"}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
