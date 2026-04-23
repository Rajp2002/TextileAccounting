'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { 
    Truck, 
    CheckCircle2, 
    AlertTriangle, 
    Search, 
    ArrowRight, 
    Calendar,
    ExternalLink,
    Filter,
    ArrowUpDown,
    Hash,
    Layers,
    User
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Dispatch {
    id: string
    dispatch_number: number
    qty_meters_sent: number
    qty_meters_received: number | null
    status: 'in_transit' | 'delivered' | 'disputed'
    dispatched_at: string
    received_at: string | null
    notes: string | null
    orders: {
        id: string
        party_name: string
        quality_label: string | null
        tracking_token: string
    }
}

interface DispatchesClientProps {
    initialDispatches: Dispatch[]
}

export default function DispatchesClient({ initialDispatches }: DispatchesClientProps) {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'in_transit' | 'delivered' | 'disputed'>('all')

    const filteredDispatches = initialDispatches.filter(d => {
        const matchesSearch = 
            d.orders.party_name.toLowerCase().includes(search.toLowerCase()) ||
            (d.orders.quality_label || '').toLowerCase().includes(search.toLowerCase()) ||
            d.dispatch_number.toString().includes(search)
        
        const matchesStatus = statusFilter === 'all' || d.status === statusFilter
        
        return matchesSearch && matchesStatus
    })

    const totalSent = initialDispatches.reduce((acc, d) => acc + Number(d.qty_meters_sent), 0)
    const totalReceived = initialDispatches.reduce((acc, d) => acc + Number(d.qty_meters_received || 0), 0)
    const inTransitCount = initialDispatches.filter(d => d.status === 'in_transit').length
    const shortageCount = initialDispatches.reduce((acc, d) => {
        if (d.status === 'delivered' && d.qty_meters_received !== null) {
            const diff = Number(d.qty_meters_sent) - Number(d.qty_meters_received)
            if (diff > 0.01) return acc + diff
        }
        return acc
    }, 0)

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'delivered':
                return { 
                    label: 'Delivered', 
                    icon: CheckCircle2, 
                    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
                    dotColor: 'bg-emerald-500'
                }
            case 'disputed':
                return { 
                    label: 'Disputed', 
                    icon: AlertTriangle, 
                    className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
                    dotColor: 'bg-rose-500'
                }
            default:
                return { 
                    label: 'In Transit', 
                    icon: Truck, 
                    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
                    dotColor: 'bg-amber-500'
                }
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Dispatches</h1>
                <p className="text-muted-foreground font-medium">Monitor fabric shipments and verify trader confirmations.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <Layers className="h-5 w-5 text-primary" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Total Sent</p>
                            <h3 className="text-2xl font-black mt-1 tabular-nums">{totalSent.toLocaleString()} m</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Confirmed Received</p>
                            <h3 className="text-2xl font-black mt-1 tabular-nums">{totalReceived.toLocaleString()} m</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-amber-100 dark:bg-amber-500/20 rounded-xl">
                                <Truck className="h-5 w-5 text-amber-600" />
                            </div>
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Active</Badge>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">In Transit</p>
                            <h3 className="text-2xl font-black mt-1 tabular-nums">{inTransitCount} Batches</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-rose-100 dark:bg-rose-500/20 rounded-xl">
                                <AlertTriangle className="h-5 w-5 text-rose-600" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wider">Total Shortage</p>
                            <h3 className="text-2xl font-black mt-1 tabular-nums text-rose-600">-{shortageCount.toFixed(2)} m</h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by Party, Quality or Batch..." 
                        className="pl-10 h-11 bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm font-medium"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {(['all', 'in_transit', 'delivered', 'disputed'] as const).map((status) => (
                        <Button
                            key={status}
                            variant={statusFilter === status ? 'default' : 'outline'}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                                "h-11 px-5 rounded-xl font-bold capitalize transition-all",
                                statusFilter === status ? "shadow-md scale-105" : "bg-white dark:bg-zinc-900/50"
                            )}
                        >
                            {status.replace('_', ' ')}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Dispatch List */}
            <div className="grid gap-4">
                <AnimatePresence mode='popLayout'>
                    {filteredDispatches.length > 0 ? (
                        filteredDispatches.map((dispatch) => {
                            const status = getStatusConfig(dispatch.status)
                            const shortage = dispatch.qty_meters_received !== null 
                                ? Number(dispatch.qty_meters_sent) - Number(dispatch.qty_meters_received)
                                : 0
                            
                            return (
                                <motion.div
                                    key={dispatch.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Card className="group border-none shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 bg-white dark:bg-zinc-900/50 overflow-hidden relative">
                                        {/* Status Accent Bar */}
                                        <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", status.dotColor)} />
                                        
                                        <CardContent className="p-0">
                                            <div className="p-5 sm:p-6">
                                                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                                    
                                                    {/* Party & Batch Info */}
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                                                                <Hash className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                                                            </div>
                                                            <span className="text-sm font-black text-zinc-500 uppercase tracking-widest">Batch #{dispatch.dispatch_number}</span>
                                                            <Badge className={cn("ml-auto lg:ml-0 font-bold px-2.5 py-0.5 rounded-full", status.className)}>
                                                                <status.icon className="h-3 w-3 mr-1.5" />
                                                                {status.label}
                                                            </Badge>
                                                        </div>
                                                        <div>
                                                            <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                                                                <User className="h-5 w-5 text-primary/60" />
                                                                {dispatch.orders.party_name}
                                                            </h3>
                                                            <p className="text-sm font-bold text-muted-foreground flex items-center gap-2 mt-1">
                                                                <Layers className="h-4 w-4" />
                                                                {dispatch.orders.quality_label || 'Regular Quality'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Meters Comparison */}
                                                    <div className="grid grid-cols-2 lg:flex items-center gap-4 lg:gap-12 bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Sent</p>
                                                            <p className="text-lg font-black tabular-nums">{Number(dispatch.qty_meters_sent).toFixed(2)}<span className="text-xs ml-1 font-bold text-muted-foreground">m</span></p>
                                                        </div>
                                                        
                                                        <div className="hidden lg:block">
                                                            <ArrowRight className="h-5 w-5 text-muted-foreground/30" />
                                                        </div>

                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Received</p>
                                                            {dispatch.qty_meters_received !== null ? (
                                                                <p className={cn(
                                                                    "text-lg font-black tabular-nums",
                                                                    shortage > 0.01 ? "text-rose-600" : "text-emerald-600"
                                                                )}>
                                                                    {Number(dispatch.qty_meters_received).toFixed(2)}<span className="text-xs ml-1 font-bold opacity-60">m</span>
                                                                </p>
                                                            ) : (
                                                                <p className="text-lg font-black text-muted-foreground/40 italic">Pending</p>
                                                            )}
                                                        </div>

                                                        {shortage > 0.01 && (
                                                            <div className="col-span-2 lg:col-auto pt-2 lg:pt-0 lg:border-l lg:pl-8 border-zinc-200 dark:border-zinc-700">
                                                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-wider">Shortage</p>
                                                                <p className="text-lg font-black text-rose-600 tabular-nums">-{shortage.toFixed(2)}<span className="text-xs ml-1 font-bold opacity-70">m</span></p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Timeline & Actions */}
                                                    <div className="flex flex-col sm:flex-row lg:flex-col items-center sm:items-end justify-center gap-4 lg:min-w-[180px]">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                                                                <Calendar className="h-3.5 w-3.5 text-primary/50" />
                                                                Sent: {format(new Date(dispatch.dispatched_at), 'dd MMM yyyy')}
                                                            </div>
                                                            {dispatch.received_at && (
                                                                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600/80">
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                    Rcvd: {format(new Date(dispatch.received_at), 'dd MMM yyyy')}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="w-full sm:w-auto h-9 font-bold text-primary hover:bg-primary/5 hover:text-primary rounded-xl group-hover:bg-primary/5 transition-all"
                                                            onClick={() => window.open(`/track/${dispatch.orders.tracking_token}`, '_blank')}
                                                        >
                                                            <ExternalLink className="h-4 w-4 mr-2" />
                                                            Track Portal
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )
                        })
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-20 text-center space-y-4"
                        >
                            <div className="inline-flex p-6 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                                <Truck className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-foreground">No dispatches found</h3>
                                <p className="text-muted-foreground font-medium max-w-xs mx-auto">Try adjusting your search or filters to find what you're looking for.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
