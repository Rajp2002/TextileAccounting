'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Badge } from '@/components/ui/badge'
import { Loader2, Users, Factory, Package, Shield, Calculator, Tags, CalendarDays, X, Search, Filter } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from '@/components/ui/button'
import { History, ArrowRight } from 'lucide-react'
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
        color: 'text-[var(--wv-neel-700)]',
        bgColor: 'bg-[var(--wv-neel-50)]',
        borderColor: 'border-[var(--wv-neel-200)]',
        icon: Users,
    },
    production: {
        label: 'Production & Orders',
        tables: ['production_logs', 'machines', 'machine_assignments', 'orders'],
        color: 'text-[var(--wv-status-info-fg)]',
        bgColor: 'bg-[var(--wv-status-info-bg)]',
        borderColor: 'border-[var(--wv-status-info-border)]',
        icon: Factory,
    },
    inventory: {
        label: 'Inventory & Qualities',
        tables: ['yarn_batches', 'yarn_lots', 'yarn_movements', 'beam_cards', 'beam_card_lots', 'order_yarn_requirements', 'qualities'],
        color: 'text-[var(--wv-status-warning-fg)]',
        bgColor: 'bg-[var(--wv-status-warning-bg)]',
        borderColor: 'border-[var(--wv-status-warning-border)]',
        icon: Package,
    },
    settings_security: {
        label: 'Settings & Profiles',
        tables: ['profiles', 'owner_data_export'],
        color: 'text-[var(--wv-status-danger-fg)]',
        bgColor: 'bg-[var(--wv-status-danger-bg)]',
        borderColor: 'border-[var(--wv-status-danger-border)]',
        icon: Shield,
    },
    estimator: {
        label: 'Estimator & Quotes',
        tables: ['factory_cost_profile', 'estimator_templates', 'estimator_quotes'],
        color: 'text-[var(--wv-status-success-fg)]',
        bgColor: 'bg-[var(--wv-status-success-bg)]',
        borderColor: 'border-[var(--wv-status-success-border)]',
        icon: Calculator,
    },
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
            <div className="flex flex-col gap-4 p-5 bg-[var(--wv-bg-surface)] rounded-2xl border border-[var(--wv-border-default)] shadow-[var(--shadow-card)] mb-8 top-4 z-20 sticky">
                <div className="flex flex-wrap items-center gap-6">
                    {/* ── Search Input ── */}
                    <div className="flex-1 min-w-[300px] relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--wv-text-secondary)] group-focus-within:text-[var(--wv-action-primary)] transition-all" />
                        <input
                            type="text"
                            placeholder="Search by ID, Name, or Action..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(0) }}
                            className="w-full h-11 pl-11 pr-4 rounded-xl border border-[var(--wv-border-control)] bg-[var(--wv-bg-surface)] text-sm text-[var(--wv-text-primary)] placeholder:text-[var(--wv-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--wv-border-focus)] focus:border-[var(--wv-border-focus)] transition-all font-medium"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => { setSearchTerm(''); setPage(0) }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--wv-text-secondary)] hover:text-[var(--wv-status-danger-fg)] transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* ── Actor Filter ── */}
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[var(--wv-text-secondary)] uppercase tracking-[0.2em] flex items-center gap-1.5 px-1">
                            <Users className="h-3 w-3" /> Actor
                        </span>
                        <Select value={actorId} onValueChange={(val) => { setActorId(val); setPage(0) }}>
                            <SelectTrigger className="w-[180px] h-11 text-sm bg-[var(--wv-bg-surface)] text-[var(--wv-text-primary)] rounded-xl border border-[var(--wv-border-control)] shadow-xs hover:border-[var(--wv-border-strong)] transition-all">
                                <SelectValue placeholder="All Users" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-[var(--wv-border-default)] shadow-xl bg-[var(--wv-bg-surface)]">
                                <SelectItem value="all">
                                   <div className="flex items-center gap-2 font-bold text-[var(--wv-text-secondary)]">
                                      <Users className="h-3.5 w-3.5" /> All Users
                                   </div>
                                </SelectItem>
                                {actors?.map((actor: { id: string; full_name: string; role: string }) => (
                                    <SelectItem key={actor.id} value={actor.id}>
                                        <div className="flex flex-col py-0.5">
                                            <span className="font-bold text-[13px] text-[var(--wv-text-primary)]">{actor.full_name}</span>
                                            <span className="text-[10px] text-[var(--wv-text-secondary)] uppercase font-semibold tracking-tight">{actor.role}</span>
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
                            className="h-10 px-4 rounded-xl text-xs font-bold text-[var(--wv-status-danger-fg)] hover:text-[var(--wv-status-danger-fg)] hover:bg-[var(--wv-status-danger-bg)] ml-auto gap-2 transition-all"
                            onClick={clearAllFilters}
                        >
                            <X className="h-4 w-4" />
                            Reset Filters
                        </Button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-8 pt-4 border-t border-[var(--wv-border-subtle)]">
                    {/* ── Category Filter ── */}
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[var(--wv-text-secondary)] uppercase tracking-[0.2em] flex items-center gap-1.5 px-1">
                            <Filter className="h-3 w-3" /> Type
                        </span>
                        <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                            <SelectTrigger className="w-[180px] h-11 text-sm bg-[var(--wv-bg-surface)] text-[var(--wv-text-primary)] rounded-xl border border-[var(--wv-border-control)] shadow-xs hover:border-[var(--wv-border-strong)] transition-all">
                                <SelectValue placeholder="All Activity" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-[var(--wv-border-default)] shadow-xl bg-[var(--wv-bg-surface)]">
                                <SelectItem value="all">
                                    <span className="flex items-center gap-2 font-bold text-[var(--wv-text-secondary)]">All Activity</span>
                                </SelectItem>
                                {Object.entries(CATEGORIES).map(([key, cat]) => {
                                    const Icon = cat.icon
                                    return (
                                        <SelectItem key={key} value={key}>
                                            <span className={`flex items-center gap-2 font-semibold ${cat.color}`}>
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
                        <span className="text-[10px] font-bold text-[var(--wv-text-secondary)] uppercase tracking-[0.2em] flex items-center gap-1.5 px-1">
                            <Tags className="h-3 w-3" /> Action
                        </span>
                        <Select value={actionFilter} onValueChange={handleActionChange}>
                            <SelectTrigger className="w-[140px] h-11 text-sm bg-[var(--wv-bg-surface)] text-[var(--wv-text-primary)] rounded-xl border border-[var(--wv-border-control)] shadow-xs hover:border-[var(--wv-border-strong)] transition-all">
                                <SelectValue placeholder="All Actions" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-[var(--wv-border-default)] shadow-xl bg-[var(--wv-bg-surface)]">
                                <SelectItem value="all"><span className="font-bold text-[var(--wv-text-secondary)]">No Filter</span></SelectItem>
                                <SelectItem value="INSERT"><span className="text-[var(--wv-status-success-fg)] font-bold">Created</span></SelectItem>
                                <SelectItem value="UPDATE"><span className="text-[var(--wv-status-warning-fg)] font-bold">Modified</span></SelectItem>
                                <SelectItem value="DELETE"><span className="text-[var(--wv-status-danger-fg)] font-bold">Removed</span></SelectItem>
                                <SelectItem value="EXPORT"><span className="text-[var(--wv-status-info-fg)] font-bold">Exported</span></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* ── Date Range ── */}
                    <div className="flex items-center gap-4 ml-auto">
                        <span className="text-[10px] font-bold text-[var(--wv-text-secondary)] uppercase tracking-[0.2em] flex items-center gap-1.5 px-1">
                            <CalendarDays className="h-3 w-3" /> Time Range
                        </span>
                        <div className="flex items-center gap-2 bg-[var(--wv-bg-subtle)] p-1.5 rounded-xl border border-[var(--wv-border-subtle)] shadow-xs">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleDateChange(e, 'start')}
                                max={endDate || new Date().toISOString().split('T')[0]}
                                className="h-8 bg-transparent text-xs font-semibold text-[var(--wv-text-primary)] focus:outline-none px-2 cursor-pointer"
                                title="Start Date"
                            />
                            <ArrowRight className="h-3 w-3 text-[var(--wv-text-secondary)]" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => handleDateChange(e, 'end')}
                                min={startDate}
                                max={new Date().toISOString().split('T')[0]}
                                className="h-8 bg-transparent text-xs font-semibold text-[var(--wv-text-primary)] focus:outline-none px-2 cursor-pointer"
                                title="End Date"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Activity Feed ── */}
            <div className="relative">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-[var(--wv-bg-surface)] rounded-2xl border border-[var(--wv-border-default)] shadow-xs overflow-hidden relative">
                        <Loader2 className="h-10 w-10 text-[var(--wv-action-primary)] animate-spin" />
                        <p className="text-sm font-medium text-[var(--wv-text-secondary)] animate-pulse tracking-wide">Retrieving Audit Logs...</p>
                    </div>
                ) : isError ? (
                    <div className="p-8 text-center bg-[var(--wv-status-danger-bg)] rounded-2xl border border-[var(--wv-status-danger-border)] shadow-xs">
                        <p className="text-[var(--wv-status-danger-fg)] font-bold">Failed to load audit logs.</p>
                        <Button variant="outline" className="mt-4 border-[var(--wv-status-danger-border)] text-[var(--wv-status-danger-fg)] hover:bg-[var(--wv-status-danger-bg)]" onClick={() => window.location.reload()}>Retry</Button>
                    </div>
                ) : data?.items?.length === 0 ? (
                    <div className="p-20 text-center bg-[var(--wv-bg-surface)] rounded-2xl border border-[var(--wv-border-subtle)] border-dashed">
                        <div className="mx-auto w-16 h-16 bg-[var(--wv-bg-subtle)] rounded-full flex items-center justify-center mb-4">
                           <History className="h-8 w-8 text-[var(--wv-text-secondary)]" />
                        </div>
                        <p className="text-[var(--wv-text-secondary)] font-medium">No audit entries found for the selected filters.</p>
                        <Button variant="link" className="text-[var(--wv-action-primary)] mt-2" onClick={clearAllFilters}>Reset all filters</Button>
                    </div>
                ) : (
                    <div className="space-y-4 pb-10">
                        <div className="flex items-center justify-between px-2 mb-6">
                           <div className="flex items-center gap-3">
                              <h2 className="text-xl font-bold text-[var(--wv-text-primary)] tracking-tight flex items-center gap-2">
                                 System Activity
                              </h2>
                              <Badge className="bg-[var(--wv-neel-100)] text-[var(--wv-neel-900)] hover:bg-[var(--wv-neel-100)] border-none font-bold text-[10px] px-2 py-0.5 rounded-full">
                                 {data?.count} TOTAL
                              </Badge>
                           </div>
                           <div className="flex items-center gap-2 text-[11px] text-[var(--wv-text-secondary)] font-semibold uppercase tracking-wider">
                              Showing {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, data?.count || 0)}
                           </div>
                        </div>

                        <div className="pl-2 pr-2">
                           {data?.items.map((log: {
                                id: string
                                table_name: string
                                action: string
                                new_data?: Record<string, unknown> | null
                                old_data?: Record<string, unknown> | null
                                record_id?: string
                                changed_at: string
                                profiles?: { full_name: string; role: string }
                           }, idx: number) => (
                                <AuditActivityItem 
                                  key={log.id} 
                                  log={log} 
                                  isLast={idx === data.items.length - 1} 
                                />
                           ))}
                        </div>

                        {/* ── Pagination ── */}
                        <div className="flex items-center justify-between gap-4 mt-12 bg-[var(--wv-bg-surface)] p-4 rounded-2xl border border-[var(--wv-border-default)] shadow-[var(--shadow-card)]">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="h-10 px-6 rounded-xl font-semibold bg-[var(--wv-bg-surface)] border-[var(--wv-border-control)] text-[var(--wv-text-body)] hover:bg-[var(--wv-bg-subtle)] disabled:opacity-30 transition-all text-xs shadow-xs"
                            >
                                Previous
                            </Button>
                            
                            <div className="hidden sm:flex items-center gap-2">
                               {Array.from({ length: Math.min(5, Math.ceil((data?.count || 0) / PAGE_SIZE)) }).map((_, i) => (
                                     <button
                                        key={i}
                                        onClick={() => setPage(i)}
                                        className={cn(
                                          "h-9 w-9 rounded-xl text-xs font-bold transition-all",
                                          page === i 
                                            ? "bg-[var(--wv-action-primary)] text-[var(--wv-text-on-action)] shadow-sm" 
                                            : "text-[var(--wv-text-secondary)] hover:text-[var(--wv-text-primary)] hover:bg-[var(--wv-bg-subtle)]"
                                        )}
                                     >
                                        {i + 1}
                                     </button>
                               ))}
                               {Math.ceil((data?.count || 0) / PAGE_SIZE) > 5 && <span className="text-[var(--wv-text-secondary)] font-bold">•••</span>}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => p + 1)}
                                disabled={(page + 1) * PAGE_SIZE >= (data?.count || 0)}
                                className="h-10 px-6 rounded-xl font-semibold bg-[var(--wv-bg-surface)] border-[var(--wv-border-control)] text-[var(--wv-text-body)] hover:bg-[var(--wv-bg-subtle)] disabled:opacity-30 transition-all text-xs shadow-xs flex items-center gap-2"
                            >
                                Next
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
