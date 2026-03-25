'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, AlertTriangle, ShieldAlert, Calendar, User, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTranslation } from '@/lib/i18n/context'

interface Incident {
    id: string
    date: string
    title: string
    description: string
    severity: 'minor' | 'major' | 'critical'
    reported_by: string
    worker_id: string | null
    reporter?: { full_name: string }
    worker?: { name: string }
}

export function IncidentsClient({ role }: { role: 'owner' | 'supervisor' }) {
    const { t } = useTranslation()
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { data: userProfile } = useUserProfile()
    const [search, setSearch] = useState('')
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [formData, setFormData] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        title: '',
        description: '',
        severity: 'minor',
        worker_id: 'none'
    })

    const { data: incidents, isLoading } = useQuery({
        queryKey: ['incidents', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('incidents')
                .select(`
                    id, date, title, description, severity, reported_by, worker_id,
                    reporter:profiles!reported_by(full_name),
                    worker:workers(id, name)
                `)
                .eq('org_id', userProfile!.org_id)
                .order('date', { ascending: false })
            
            if (error) throw error
            return data as any[]
        }
    })

    const { data: workers } = useQuery({
        queryKey: ['workers_list', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data } = await supabase
                .from('workers')
                .select('id, name')
                .eq('org_id', userProfile!.org_id)
                .order('name')
            return data || []
        }
    })

    const addMutation = useMutation({
        mutationFn: async (payload: any) => {
            const { error } = await supabase.from('incidents').insert([payload])
            if (error) throw error
        },
        onSuccess: () => {
            toast.success('Incident reported successfully')
            queryClient.invalidateQueries({ queryKey: ['incidents', userProfile?.org_id] })
            setIsAddOpen(false)
            setFormData({
                date: format(new Date(), 'yyyy-MM-dd'),
                title: '',
                description: '',
                severity: 'minor',
                worker_id: 'none'
            })
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to report incident')
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title) {
            toast.error('Title is required')
            return
        }
        
        const payload: any = {
            org_id: userProfile?.org_id,
            date: formData.date,
            title: formData.title,
            description: formData.description || null,
            severity: formData.severity,
            reported_by: userProfile?.id,
        }
        
        if (formData.worker_id !== 'none') {
            payload.worker_id = formData.worker_id
        }
        
        addMutation.mutate(payload)
    }

    const filteredIncidents = incidents?.filter(i => 
        i.title.toLowerCase().includes(search.toLowerCase()) || 
        (i.worker?.name || '').toLowerCase().includes(search.toLowerCase())
    ) || []

    const severityColors = {
        minor: 'bg-blue-100 text-blue-800 border-blue-200',
        major: 'bg-amber-100 text-amber-800 border-amber-200',
        critical: 'bg-red-100 text-red-800 border-red-200'
    }

    return (
        <div className="space-y-6 pb-10 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-red-500" />
                        Safety & Incidents
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">OSHWC Code compliant incident tracking</p>
                </div>
                
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Report Incident
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle>Report Safety Incident</DialogTitle>
                                <DialogDescription>
                                    Log workplace accidents or dangerous occurrences. This is a mandatory compliance record.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Date <span className="text-red-500">*</span></Label>
                                        <Input 
                                            type="date" 
                                            required
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                            max={format(new Date(), 'yyyy-MM-dd')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Severity <span className="text-red-500">*</span></Label>
                                        <Select 
                                            value={formData.severity} 
                                            onValueChange={(val: any) => setFormData({ ...formData, severity: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="minor">Minor Incident / First Aid</SelectItem>
                                                <SelectItem value="major">Major Accident / Lost Time</SelectItem>
                                                <SelectItem value="critical">Critical / Life Threatening</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Incident Title <span className="text-red-500">*</span></Label>
                                    <Input 
                                        placeholder="e.g. Hand injury at Loom #4"
                                        required
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Involved Worker (Optional)</Label>
                                    <Select 
                                        value={formData.worker_id} 
                                        onValueChange={(val) => setFormData({ ...formData, worker_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select worker if applicable" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">-- Not applicable / No specific worker --</SelectItem>
                                            {workers?.map((w: any) => (
                                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Description & Action Taken</Label>
                                    <Textarea 
                                        placeholder="Describe what happened, injuries sustained, and immediate actions taken..."
                                        className="min-h-[100px]"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={addMutation.isPending}>
                                    {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Submit Report
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="shadow-sm border-gray-200">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search incidents or workers..."
                            className="pl-9 bg-gray-50/50"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="divide-y divide-gray-100">
                    {isLoading ? (
                        <div className="p-8 text-center text-gray-500">
                            <Loader2 className="h-8 w-8 mx-auto animate-spin text-gray-300 mb-2" />
                            Loading records...
                        </div>
                    ) : filteredIncidents.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <ShieldAlert className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                            <p className="text-lg font-medium text-gray-600">No incidents to display</p>
                            <p className="text-sm">Workplace safety records will appear here.</p>
                        </div>
                    ) : (
                        filteredIncidents.map((incident) => (
                            <div key={incident.id} className="p-4 sm:p-5 hover:bg-gray-50/50 transition-colors">
                                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                                    <div className="space-y-1 sm:max-w-[70%] text-left">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-gray-900">{incident.title}</h3>
                                            <Badge variant="outline" className={severityColors[incident.severity as keyof typeof severityColors] + " font-bold uppercase tracking-wider text-[10px]"}>
                                                {incident.severity}
                                            </Badge>
                                        </div>
                                        {incident.description && (
                                            <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                                                {incident.description}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {format(new Date(incident.date), 'dd MMM yyyy')}
                                            </div>
                                            {incident.worker && (
                                                <div className="flex items-center gap-1.5 font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                                                    <User className="h-3 w-3" />
                                                    {incident.worker.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <div className="text-xs text-gray-400">Reported by</div>
                                        <div className="text-sm font-medium text-gray-700">{incident.reporter?.full_name || 'System'}</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    )
}
