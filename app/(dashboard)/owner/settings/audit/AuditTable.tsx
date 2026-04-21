'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Badge } from '@/components/ui/badge'
import { Loader2, Users, Factory, Package, Shield, Calculator, Tags, CalendarDays, X, Search, Filter } from 'lucide-react'
import AuditDiff from '@/components/ui/audit-diff'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from '@/components/ui/button'
import { getAuditSummary } from '@/lib/audit-summaries'
import { Info, History, ArrowRight } from 'lucide-react'
import AuditActivityItem from './AuditActivityItem'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

// ── Category Definitions ──────────────────────────────────────────────────────

type CategoryKey = 'hr_payroll' | 'production' | 'inventory' | 'settings_security' | 'estimator'

interface CategoryConfig {
    label: string
    tables: string[]
    color: string
    bgColor: string
    borderColor: string
    icon: React.ComponentType<{ className?: string }>
}

const CATEGORIES: Record<CategoryKey, CategoryConfig> = {
    hr_payroll: {
        label: 'HR & Payroll',
        tables: ['attendance', 'workers', 'fixed_workers', 'payroll_settlements', 'worker_advances', 'payroll_configs'],
        color: 'text-violet-700',
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-200',
        icon: Users,
    },
    production: {
        label: 'Production & Orders',
        tables: ['production_logs', 'machines', 'machine_assignments', 'orders'],
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: Factory,
    },
    inventory: {
        label: 'Inventory & Qualities',
        tables: ['yarn_batches', 'qualities'],
        color: 'text-teal-700',
        bgColor: 'bg-teal-50',
        borderColor: 'border-teal-200',
        icon: Package,
    },
    settings_security: {
        label: 'Settings & Profiles',
        tables: ['profiles'],
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        icon: Shield,
    },
    estimator: {
        label: 'Estimator & Quotes',
        tables: ['factory_cost_profile', 'estimator_templates', 'estimator_quotes'],
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        icon: Calculator,
    },
}

// Human-readable table name mapping
const TABLE_LABELS: Record<string, string> = {
    attendance: 'Attendance',
    workers: 'Worker',
    fixed_workers: 'Fixed Worker',
    payroll_settlements: 'Payroll Settlement',
    payroll_payments: 'Payroll Payment',
    worker_advances: 'Advance (Upaad)',
    payroll_configs: 'Payroll Config',
    production_logs: 'Production Log',
    machines: 'Machine',
    machine_assignments: 'Machine Assignment',
    orders: 'Order',
    yarn_batches: 'Yarn Batch',
    qualities: 'Quality',
    profiles: 'User Profile',
    factory_cost_profile: 'Factory Cost Profile',
    estimator_templates: 'Estimator Template',
    estimator_quotes: 'Quote',
}

function getCategoryForTable(tableName: string): CategoryKey | null {
    for (const [key, config] of Object.entries(CATEGORIES)) {
        if (config.tables.includes(tableName)) {
            return key as CategoryKey
        }
    }
    return null
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ActionBadge = ({ action }: { action: string }) => {
    switch (action) {
        case 'INSERT': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-100 font-bold text-[10px] px-1.5 shadow-sm">INSERT</Badge>
        case 'UPDATE': return <Badge className="bg-amber-50 text-amber-700 border-amber-200/50 hover:bg-amber-100 font-bold text-[10px] px-1.5 shadow-sm">UPDATE</Badge>
        case 'DELETE': return <Badge className="bg-rose-50 text-rose-700 border-rose-200/50 hover:bg-rose-100 font-bold text-[10px] px-1.5 shadow-sm">DELETE</Badge>
        default: if (action.includes('.')) return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200/50 font-bold text-[10px] px-1.5 shadow-sm uppercase">{action.split('.').pop()}</Badge>
                 return <Badge className="text-[10px] px-1.5 shadow-sm">{action}</Badge>
    }
}

const CategoryBadge = ({ tableName }: { tableName: string }) => {
    const catKey = getCategoryForTable(tableName)
    if (!catKey) return null
    const cat = CATEGORIES[catKey]
    const Icon = cat.icon
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${cat.color} ${cat.bgColor} ${cat.borderColor}`}>
            <Icon className="h-3 w-3" />
            {cat.label}
        </span>
    )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AuditTable() {
    const supabase = createClient()
    const { data: userProfile } = useUserProfile()

    const [page, setPage] = useState(0)
    const [actionFilter, setActionFilter] = useState<string>('all')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [actorId, setActorId] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState<string>('')
    const [startDate, setStartDate] = useState<string>('') // 'YYYY-MM-DD'
    const [endDate, setEndDate] = useState<string>('') // 'YYYY-MM-DD'

    // ── Fetch Actors (Profiles) ──
    const { data: actors } = useQuery({
        queryKey: ['auditActors', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .eq('org_id', userProfile!.org_id)
                .order('full_name')
            if (error) throw error
            return data
        }
    })

    const { data, isLoading, isError } = useQuery({
        queryKey: ['auditLogs', userProfile?.org_id, page, actionFilter, categoryFilter, actorId, searchTerm, startDate, endDate],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            let query = supabase
                .from('audit_log')
                .select('*, profiles!audit_log_changed_by_fkey(full_name, role)', { count: 'exact' })
                .eq('org_id', userProfile!.org_id)
                .order('changed_at', { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

            if (actionFilter !== 'all') {
                query = query.eq('action', actionFilter)
            }
            if (categoryFilter !== 'all') {
                const tables = CATEGORIES[categoryFilter as CategoryKey]?.tables ?? []
                if (tables.length > 0) {
                    query = query.in('table_name', tables)
                }
            }
            if (actorId !== 'all') {
                query = query.eq('changed_by', actorId)
            }
            if (searchTerm) {
                // Smart Search: record_id OR name OR party_name OR full_name in JSON
                query = query.or(`record_id.ilike.%${searchTerm}%,new_data->>name.ilike.%${searchTerm}%,new_data->>party_name.ilike.%${searchTerm}%,new_data->>full_name.ilike.%${searchTerm}%`)
            }
            if (startDate) {
                const start = new Date(startDate)
                start.setHours(0, 0, 0, 0)
                query = query.gte('changed_at', start.toISOString())
            }
            if (endDate) {
                const end = new Date(endDate)
                end.setHours(23, 59, 59, 999)
                query = query.lte('changed_at', end.toISOString())
            }

            const { data, error, count } = await query
            if (error) throw error
            return { items: data, count }
        }
    })

    const handleCategoryChange = (val: string) => {
        setCategoryFilter(val)
        setPage(0)
    }

    const handleActionChange = (val: string) => {
        setActionFilter(val)
        setPage(0)
    }

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
        if (type === 'start') setStartDate(e.target.value)
        else setEndDate(e.target.value)
        setPage(0)
    }

    const clearAllFilters = () => {
        setCategoryFilter('all')
        setActionFilter('all')
        setActorId('all')
        setSearchTerm('')
        setStartDate('')
        setEndDate('')
        setPage(0)
    }

    const hasActiveFilters = categoryFilter !== 'all' || actionFilter !== 'all' || actorId !== 'all' || searchTerm !== '' || startDate !== '' || endDate !== ''

    return (
        <div className="space-y-4">
            {/* ── Filters ── */}
            <div className="flex flex-col gap-4 p-5 bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.05)] mb-8 top-4 z-20 sticky">
                <div className="flex flex-wrap items-center gap-6">
                    {/* ── Search Input ── */}
                    <div className="flex-1 min-w-[300px] relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-all" />
                        <input
                            type="text"
                            placeholder="Search by ID, Name, or Action..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(0) }}
                            className="w-full h-11 pl-11 pr-4 rounded-2xl border border-gray-100 bg-white/50 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 transition-all font-medium"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => { setSearchTerm(''); setPage(0) }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-rose-500 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* ── Actor Filter ── */}
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5 px-1">
                            <Users className="h-3 w-3" /> Actor
                        </span>
                        <Select value={actorId} onValueChange={(val) => { setActorId(val); setPage(0) }}>
                            <SelectTrigger className="w-[180px] h-11 text-sm bg-white/80 rounded-2xl border-white shadow-sm hover:shadow-md transition-all">
                                <SelectValue placeholder="All Users" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-white/50 shadow-2xl backdrop-blur-lg">
                                <SelectItem value="all">
                                   <div className="flex items-center gap-2 font-bold text-gray-400">
                                      <Users className="h-3.5 w-3.5" /> All Users
                                   </div>
                                </SelectItem>
                                {actors?.map((actor: any) => (
                                    <SelectItem key={actor.id} value={actor.id}>
                                        <div className="flex flex-col py-0.5">
                                            <span className="font-bold text-[13px]">{actor.full_name}</span>
                                            <span className="text-[10px] text-gray-400 uppercase font-black tracking-tight">{actor.role}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-10 px-4 rounded-2xl text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 ml-auto gap-2 transition-all"
                            onClick={clearAllFilters}
                        >
                            <X className="h-4 w-4" />
                            Reset Filters
                        </Button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-8 pt-4 border-t border-gray-100/50">
                    {/* ── Category Filter ── */}
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5 px-1">
                            <Filter className="h-3 w-3" /> Type
                        </span>
                        <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                            <SelectTrigger className="w-[180px] h-11 text-sm bg-white/80 rounded-2xl border-white shadow-sm hover:shadow-md transition-all">
                                <SelectValue placeholder="All Activity" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-white/50 shadow-2xl backdrop-blur-lg">
                                <SelectItem value="all">
                                    <span className="flex items-center gap-2 font-bold text-gray-400">All Activity</span>
                                </SelectItem>
                                {Object.entries(CATEGORIES).map(([key, cat]) => {
                                    const Icon = cat.icon
                                    return (
                                        <SelectItem key={key} value={key}>
                                            <span className={`flex items-center gap-2 font-bold ${cat.color}`}>
                                                <Icon className="h-4 w-4" />
                                                {cat.label}
                                            </span>
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* ── Action Filter ── */}
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5 px-1">
                            <Tags className="h-3 w-3" /> Action
                        </span>
                        <Select value={actionFilter} onValueChange={handleActionChange}>
                            <SelectTrigger className="w-[140px] h-11 text-sm bg-white/80 rounded-2xl border-white shadow-sm hover:shadow-md transition-all">
                                <SelectValue placeholder="All Actions" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-white/50 shadow-2xl backdrop-blur-lg">
                                <SelectItem value="all"><span className="font-bold text-gray-400">No Filter</span></SelectItem>
                                <SelectItem value="INSERT"><span className="text-emerald-600 font-black">Created</span></SelectItem>
                                <SelectItem value="UPDATE"><span className="text-amber-600 font-black">Modified</span></SelectItem>
                                <SelectItem value="DELETE"><span className="text-rose-600 font-black">Removed</span></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* ── Date Range ── */}
                    <div className="flex items-center gap-4 ml-auto">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5 px-1">
                            <CalendarDays className="h-3 w-3" /> Time Range
                        </span>
                        <div className="flex items-center gap-2 bg-white/80 p-1.5 rounded-2xl border-white shadow-sm hover:shadow-md transition-all">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleDateChange(e, 'start')}
                                max={endDate || new Date().toISOString().split('T')[0]}
                                className="h-8 bg-transparent text-xs font-bold text-gray-600 focus:outline-none px-2 cursor-pointer"
                                title="Start Date"
                            />
                            <ArrowRight className="h-3 w-3 text-gray-300" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => handleDateChange(e, 'end')}
                                min={startDate}
                                max={new Date().toISOString().split('T')[0]}
                                className="h-8 bg-transparent text-xs font-bold text-gray-600 focus:outline-none px-2 cursor-pointer"
                                title="End Date"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Activity Feed ── */}
            <div className="relative">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white/50 rounded-3xl border border-gray-100 backdrop-blur-sm shadow-inner overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <div className="relative">
                            <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse rounded-full" />
                        </div>
                        <p className="text-sm font-medium text-gray-500 animate-pulse tracking-wide">Retrieving Audit Logs...</p>
                    </div>
                ) : isError ? (
                    <div className="p-8 text-center bg-rose-50 rounded-3xl border border-rose-100 shadow-sm animate-in zoom-in-95 duration-300">
                        <p className="text-rose-600 font-bold">Failed to load audit logs.</p>
                        <Button variant="outline" className="mt-4 border-rose-200 text-rose-700 hover:bg-rose-100" onClick={() => window.location.reload()}>Retry</Button>
                    </div>
                ) : data?.items?.length === 0 ? (
                    <div className="p-20 text-center bg-white rounded-3xl border border-gray-100 border-dashed animate-in fade-in duration-500 shadow-inner">
                        <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                           <History className="h-8 w-8 text-gray-300" />
                        </div>
                        <p className="text-gray-500 font-medium">No audit entries found for the selected filters.</p>
                        <Button variant="link" className="text-primary mt-2" onClick={clearAllFilters}>Reset all filters</Button>
                    </div>
                ) : (
                    <div className="space-y-4 pb-10">
                        <div className="flex items-center justify-between px-2 mb-6">
                           <div className="flex items-center gap-3">
                              <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                 System Activity
                              </h2>
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none font-bold text-[10px] px-2 py-0.5 rounded-full">
                                 {data.count} TOTAL
                              </Badge>
                           </div>
                           <div className="flex items-center gap-2 text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                              Showing {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, data.count || 0)}
                           </div>
                        </div>

                        <div className="pl-2 pr-2">
                           {data.items.map((log: any, idx: number) => (
                               <AuditActivityItem 
                                 key={log.id} 
                                 log={log} 
                                 isLast={idx === data.items.length - 1} 
                               />
                           ))}
                        </div>

                        {/* ── Premium Pagination ── */}
                        <div className="flex items-center justify-between gap-4 mt-12 bg-white/50 backdrop-blur-md p-4 rounded-3xl border border-gray-100 shadow-sm">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="h-10 px-6 rounded-2xl font-bold bg-white border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all text-xs shadow-sm hover:shadow-md"
                            >
                                Previous
                            </Button>
                            
                            <div className="hidden sm:flex items-center gap-2">
                               {Array.from({ length: Math.min(5, Math.ceil((data.count || 0) / PAGE_SIZE)) }).map((_, i) => (
                                     <button
                                        key={i}
                                        onClick={() => setPage(i)}
                                        className={cn(
                                          "h-9 w-9 rounded-xl text-xs font-black transition-all",
                                          page === i 
                                            ? "bg-primary text-white shadow-lg shadow-primary/25 scale-110" 
                                            : "text-gray-400 hover:text-gray-900 hover:bg-white hover:shadow-sm"
                                        )}
                                     >
                                        {i + 1}
                                     </button>
                               ))}
                               {Math.ceil((data.count || 0) / PAGE_SIZE) > 5 && <span className="text-gray-300 font-bold">•••</span>}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => p + 1)}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}
