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
import { Info } from 'lucide-react'

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
            <div className="flex flex-col gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    {/* ── Search Input ── */}
                    <div className="flex-1 min-w-[280px] relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by ID or Name (Worker, Order, User)..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(0) }}
                            className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => { setSearchTerm(''); setPage(0) }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* ── Actor Filter ── */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Users className="h-3 w-3" /> Actor
                        </span>
                        <Select value={actorId} onValueChange={(val) => { setActorId(val); setPage(0) }}>
                            <SelectTrigger className="w-[160px] h-9 text-sm bg-white rounded-lg shadow-sm">
                                <SelectValue placeholder="All Users" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {actors?.map((actor: { id: string; full_name: string; role: string }) => (
                                    <SelectItem key={actor.id} value={actor.id}>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-xs">{actor.full_name}</span>
                                            <span className="text-[10px] text-gray-400 capitalize">{actor.role}</span>
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
                            className="h-8 text-xs text-gray-500 hover:text-rose-600 hover:bg-rose-50 ml-auto gap-1.5"
                            onClick={clearAllFilters}
                        >
                            <X className="h-3.5 w-3.5" />
                            Clear
                        </Button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-1 border-t border-gray-200/50">
                    {/* ── Category Filter ── */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Filter className="h-3 w-3" /> Category
                        </span>
                        <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                            <SelectTrigger className="w-[160px] h-9 text-sm bg-white rounded-lg shadow-sm border-gray-200">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    <span className="flex items-center gap-2">All Categories</span>
                                </SelectItem>
                                {Object.entries(CATEGORIES).map(([key, cat]) => {
                                    const Icon = cat.icon
                                    return (
                                        <SelectItem key={key} value={key}>
                                            <span className={`flex items-center gap-2 ${cat.color}`}>
                                                <Icon className="h-3.5 w-3.5" />
                                                {cat.label}
                                            </span>
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* ── Action Filter ── */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Tags className="h-3 w-3" /> Action
                        </span>
                        <Select value={actionFilter} onValueChange={handleActionChange}>
                            <SelectTrigger className="w-[120px] h-9 text-sm bg-white rounded-lg shadow-sm border-gray-200">
                                <SelectValue placeholder="All Actions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Actions</SelectItem>
                                <SelectItem value="INSERT"><span className="text-emerald-700 font-medium">Insert</span></SelectItem>
                                <SelectItem value="UPDATE"><span className="text-amber-700 font-medium">Update</span></SelectItem>
                                <SelectItem value="DELETE"><span className="text-rose-700 font-medium">Delete</span></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* ── Date Range ── */}
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 whitespace-nowrap">
                            <CalendarDays className="h-3 w-3" /> Date Range
                        </span>
                        <div className="flex items-center gap-2 bg-white px-2 py-0.5 rounded-lg border border-gray-200 shadow-sm">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleDateChange(e, 'start')}
                                max={endDate || new Date().toISOString().split('T')[0]}
                                className="h-7 bg-transparent text-xs text-gray-700 focus:outline-none"
                                title="Start Date"
                            />
                            <span className="text-gray-300">→</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => handleDateChange(e, 'end')}
                                min={startDate}
                                max={new Date().toISOString().split('T')[0]}
                                className="h-7 bg-transparent text-xs text-gray-700 focus:outline-none"
                                title="End Date"
                            />
                            {(startDate || endDate) && (
                                <button
                                    onClick={() => { setStartDate(''); setEndDate(''); setPage(0) }}
                                    className="ml-1 text-gray-300 hover:text-rose-500"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="rounded-md border border-gray-200 shadow-sm overflow-hidden bg-white">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="w-[170px]">Timestamp</TableHead>
                            <TableHead className="w-[90px]">Action</TableHead>
                            <TableHead className="w-[220px]">Summary (TLDR)</TableHead>
                            <TableHead className="w-[130px]">Category</TableHead>
                            <TableHead className="w-[150px]">Entity</TableHead>
                            <TableHead className="w-[160px]">Actor</TableHead>
                            <TableHead className="w-[80px]">Auth</TableHead>
                            <TableHead>Changes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-gray-500 gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        <p className="text-sm">Loading audit logs...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center text-red-500 bg-red-50/30">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <p className="font-semibold">Failed to load audit logs</p>
                                        <p className="text-xs text-red-400">Please check your permissions or try refreshing the page.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : data?.items?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center text-gray-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Factory className="h-8 w-8 text-gray-300" />
                                        <p className="text-sm">No audit logs found for the selected filters.</p>
                                        {hasActiveFilters && (
                                            <button
                                                className="text-xs text-indigo-600 hover:underline"
                                                onClick={clearAllFilters}
                                            >
                                                Clear filters to see all entries
                                            </button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.items?.map((log: any) => (
                                <TableRow key={log.id} className="text-sm border-gray-100 hover:bg-gray-50/50">
                                    <TableCell className="align-top whitespace-nowrap text-gray-600 text-xs py-3">
                                        {format(new Date(log.changed_at), "dd MMM yyyy")}
                                        <div className="text-gray-400 text-[11px]">{format(new Date(log.changed_at), "HH:mm:ss")}</div>
                                    </TableCell>
                                    <TableCell className="align-top py-3">
                                        <ActionBadge action={log.action} />
                                    </TableCell>
                                    <TableCell className="align-top py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] flex-shrink-0" />
                                            <span className="font-bold text-gray-900 text-[13px] tracking-tight leading-tight">
                                                {getAuditSummary(log)}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top py-3">
                                        <CategoryBadge tableName={log.table_name} />
                                    </TableCell>
                                    <TableCell className="align-top py-3">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-900 text-xs">
                                                {TABLE_LABELS[log.table_name] ?? log.table_name}
                                            </span>
                                            <span className="text-[11px] text-gray-400 truncate max-w-[130px] font-mono" title={log.record_id}>
                                                #{String(log.record_id).slice(0, 8)}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top py-3">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-800 text-xs">
                                                {/* @ts-ignore */}
                                                {log.profiles?.full_name || <span className="text-gray-400 italic">Unknown</span>}
                                            </span>
                                            {/* @ts-ignore */}
                                            {log.profiles?.role && (
                                                <span className="text-[11px] text-gray-500 capitalize">
                                                    {/* @ts-ignore */}
                                                    {log.profiles.role}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top py-3">
                                        {log.is_access_code_used ? (
                                            <Badge variant="outline" className="text-[10px] font-bold border-primary/20 bg-primary/5 text-primary gap-1 whitespace-nowrap">
                                                <span className="text-[12px]">🛡️</span> Auth
                                            </Badge>
                                        ) : (
                                            <span className="text-[11px] text-gray-300">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="align-top py-3">
                                        <AuditDiff oldData={log.old_data} newData={log.new_data} />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ── Summary + Pagination ── */}
            {data && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-gray-400">
                        {data.count
                            ? `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, data.count)} of ${data.count} entries`
                            : 'No entries'}
                    </p>
                    {data.count && data.count > PAGE_SIZE ? (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="h-8 text-xs"
                            >
                                ← Previous
                            </Button>
                            <span className="flex items-center text-xs text-gray-500 px-2">
                                Page {page + 1} of {Math.ceil(data.count / PAGE_SIZE)}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => p + 1)}
                                disabled={(page + 1) * PAGE_SIZE >= data.count}
                                className="h-8 text-xs"
                            >
                                Next →
                            </Button>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}
