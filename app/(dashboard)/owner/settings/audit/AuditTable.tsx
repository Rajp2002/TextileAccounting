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
import { Loader2, Users, Factory, Package, Shield, Calculator, Tags, CalendarDays, X } from 'lucide-react'
import AuditDiff from '@/components/ui/audit-diff'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from '@/components/ui/button'

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
        tables: ['profiles', 'incidents'],
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
    incidents: 'Incident',
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
        case 'INSERT': return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-semibold text-[11px]">INSERT</Badge>
        case 'UPDATE': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 font-semibold text-[11px]">UPDATE</Badge>
        case 'DELETE': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 font-semibold text-[11px]">DELETE</Badge>
        default: return <Badge className="text-[11px]">{action}</Badge>
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
    const [dateFilter, setDateFilter] = useState<string>('') // 'YYYY-MM-DD'

    const { data, isLoading, isError } = useQuery({
        queryKey: ['auditLogs', userProfile?.org_id, page, actionFilter, categoryFilter, dateFilter],
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
            if (dateFilter) {
                // Filter the full calendar day in ISO (UTC) — the DB stores UTC timestamps
                const dayStart = new Date(dateFilter)
                dayStart.setHours(0, 0, 0, 0)
                const dayEnd = new Date(dateFilter)
                dayEnd.setHours(23, 59, 59, 999)
                query = query
                    .gte('changed_at', dayStart.toISOString())
                    .lte('changed_at', dayEnd.toISOString())
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

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDateFilter(e.target.value)
        setPage(0)
    }

    const clearAllFilters = () => {
        setCategoryFilter('all')
        setActionFilter('all')
        setDateFilter('')
        setPage(0)
    }

    const hasActiveFilters = categoryFilter !== 'all' || actionFilter !== 'all' || dateFilter !== ''

    return (
        <div className="space-y-4">
            {/* ── Filters ── */}
            <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100 mb-6">
                {/* ── Category Filter ── */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</span>
                    <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="w-[180px] h-8 text-sm bg-white">
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

                <div className="h-4 w-px bg-gray-300 hidden sm:block" />

                {/* ── Action Filter ── */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</span>
                    <Select value={actionFilter} onValueChange={handleActionChange}>
                        <SelectTrigger className="w-[130px] h-8 text-sm bg-white">
                            <SelectValue placeholder="All Actions" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Actions</SelectItem>
                            <SelectItem value="INSERT"><span className="text-emerald-700 font-medium">Insert</span></SelectItem>
                            <SelectItem value="UPDATE"><span className="text-amber-700 font-medium">Update</span></SelectItem>
                            <SelectItem value="DELETE"><span className="text-red-700 font-medium">Delete</span></SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="h-4 w-px bg-gray-300 hidden sm:block" />

                {/* ── Date Filter ── */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Date
                    </span>
                    <div className="relative flex items-center">
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={handleDateChange}
                            max={new Date().toISOString().split('T')[0]}
                            className="h-8 rounded-md border border-input bg-white px-2 pr-7 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 transition-colors"
                        />
                        {dateFilter && (
                            <button
                                onClick={() => { setDateFilter(''); setPage(0) }}
                                className="absolute right-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                                title="Clear date"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-gray-500 hover:text-gray-900 ml-auto"
                        onClick={clearAllFilters}
                    >
                        Clear filters
                    </Button>
                )}
            </div>

            {/* ── Table ── */}
            <div className="rounded-md border border-gray-200 shadow-sm overflow-hidden bg-white">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="w-[170px]">Timestamp</TableHead>
                            <TableHead className="w-[90px]">Action</TableHead>
                            <TableHead className="w-[160px]">Category</TableHead>
                            <TableHead className="w-[150px]">Entity</TableHead>
                            <TableHead className="w-[170px]">Actor</TableHead>
                            <TableHead className="w-[90px]">Auth</TableHead>
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
