'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { formatToSurat } from '@/lib/time'
import { 
  Wallet, 
  TrendingUp, 
  Layers, 
  Shield, 
  Calculator, 
  ChevronRight, 
  ChevronDown,
  History,
  Info
} from 'lucide-react'
import { type AuditLogEntry } from '@/lib/audit-summaries'
import { getAuditSummary } from '@/lib/audit-summaries'
import AuditDiff from '@/components/ui/audit-diff'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface AuditActivityItemProps {
  log: AuditLogEntry & { 
    changed_at: string;
    profiles?: { full_name: string; role: string };
  }
  isLast?: boolean
}

const CATEGORY_CONFIG = {
  hr_payroll: { icon: Wallet, color: 'text-[var(--wv-neel-700)]', bg: 'bg-[var(--wv-neel-50)]', border: 'border-[var(--wv-neel-200)]', glow: 'shadow-[0_2px_8px_rgba(22,33,62,0.06)]' },
  production: { icon: TrendingUp, color: 'text-[var(--wv-status-info-fg)]', bg: 'bg-[var(--wv-status-info-bg)]', border: 'border-[var(--wv-status-info-border)]', glow: 'shadow-[0_2px_8px_rgba(49,92,120,0.08)]' },
  inventory: { icon: Layers, color: 'text-[var(--wv-status-warning-fg)]', bg: 'bg-[var(--wv-status-warning-bg)]', border: 'border-[var(--wv-status-warning-border)]', glow: 'shadow-[0_2px_8px_rgba(117,89,0,0.08)]' },
  settings_security: { icon: Shield, color: 'text-[var(--wv-status-danger-fg)]', bg: 'bg-[var(--wv-status-danger-bg)]', border: 'border-[var(--wv-status-danger-border)]', glow: 'shadow-[0_2px_8px_rgba(172,22,55,0.08)]' },
  estimator: { icon: Calculator, color: 'text-[var(--wv-status-success-fg)]', bg: 'bg-[var(--wv-status-success-bg)]', border: 'border-[var(--wv-status-success-border)]', glow: 'shadow-[0_2px_8px_rgba(47,107,67,0.08)]' },
}

export default function AuditActivityItem({ log, isLast }: AuditActivityItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Resolve category from table name (simplified mapping)
  const category = ((): keyof typeof CATEGORY_CONFIG => {
    const t = log.table_name
    if (['attendance', 'workers', 'fixed_workers', 'payroll_settlements', 'worker_advances', 'payroll_configs'].includes(t)) return 'hr_payroll'
    if (['production_logs', 'machines', 'machine_assignments', 'orders'].includes(t)) return 'production'
    if (['yarn_batches', 'yarn_lots', 'yarn_movements', 'beam_cards', 'beam_card_lots', 'order_yarn_requirements', 'qualities'].includes(t)) return 'inventory'
    if (['factory_cost_profile', 'estimator_templates', 'estimator_quotes'].includes(t)) return 'estimator'
    return 'settings_security'
  })()

  const config = CATEGORY_CONFIG[category]
  const Icon = config.icon
  const summary = getAuditSummary(log)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const timeAgo = mounted ? formatDistanceToNow(new Date(log.changed_at), { addSuffix: true }) : 'Calculating...'
  const actorName = log.profiles?.full_name || 'System'
  const actorInitial = actorName.charAt(0).toUpperCase()
  const statusValue = typeof log.new_data?.status === 'string' ? log.new_data.status : null

  return (
    <div className="flex gap-4">
      {/* ── Timeline Rail ── */}
      <div className="flex flex-col items-center">
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center border-2 z-10 transition-all duration-300",
          config.bg,
          config.border,
          config.color,
          isExpanded ? "scale-110 shadow-lg" : "shadow-sm",
          config.glow
        )}>
          <Icon className="h-5 w-5" />
        </div>
        {!isLast && <div className="flex-1 w-0.5 bg-[var(--wv-border-subtle)] my-2" />}
      </div>

      {/* ── Narrative Card ── */}
      <div className="flex-1 pb-8">
        <div 
          className={cn(
            "group bg-[var(--wv-bg-surface)] rounded-2xl border transition-all duration-300 overflow-hidden",
            isExpanded ? "border-[var(--wv-neel-700)] shadow-[var(--shadow-card)] ring-1 ring-[var(--wv-neel-700)]/10" : "border-[var(--wv-border-default)] shadow-xs hover:border-[var(--wv-border-strong)]"
          )}
        >
          {/* Header Area */}
          <button
            type="button"
            className="w-full p-4 cursor-pointer select-none text-left"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-label={`${summary}. ${isExpanded ? 'Collapse' : 'Expand'} audit details`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--wv-text-primary)] tracking-tight">
                    {summary}
                  </h3>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 border-[var(--wv-border-subtle)] text-[var(--wv-text-secondary)] bg-[var(--wv-bg-subtle)]">
                    {log.action}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-[var(--wv-text-secondary)]">
                  <div className="flex items-center gap-1.5 py-0.5 px-2 bg-[var(--wv-bg-subtle)] rounded-full border border-[var(--wv-border-subtle)]">
                    <div className="h-4 w-4 rounded-full bg-[var(--wv-neel-100)] text-[var(--wv-neel-900)] flex items-center justify-center font-bold text-[10px]">
                      {actorInitial}
                    </div>
                    <span className="font-semibold text-[var(--wv-text-body)]">{actorName}</span>
                  </div>
                  <span className="h-1 w-1 rounded-full bg-[var(--wv-border-subtle)]" />
                  <div className="flex items-center gap-1">
                    <History className="h-3 w-3" />
                    {timeAgo}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                 <div className="text-right hidden sm:block">
                    <div className="text-[10px] font-bold text-[var(--wv-text-secondary)] uppercase tracking-wider">Entity ID</div>
                    <div className="text-xs font-mono font-bold text-[var(--wv-text-body)]">#{log.record_id}</div>
                 </div>
                 <div className={cn(
                   "h-8 w-8 rounded-full flex items-center justify-center bg-[var(--wv-bg-subtle)] text-[var(--wv-text-secondary)] group-hover:bg-[var(--wv-neel-50)] group-hover:text-[var(--wv-neel-900)] transition-colors",
                   isExpanded && "bg-[var(--wv-neel-100)] text-[var(--wv-neel-900)] rotate-180"
                 )}>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                 </div>
              </div>
            </div>

            {/* Smart Preview (Grid of key changes) */}
            {!isExpanded && (
               <div className="mt-4 pt-4 border-t border-[var(--wv-border-subtle)] flex flex-wrap gap-4">
                  {/* We show a very simplified preview if collapsed */}
                  <div className="flex items-center gap-2 text-[11px]">
                     <span className="text-[var(--wv-text-secondary)] font-medium tracking-wide uppercase">Entity:</span>
                     <span className="font-semibold text-[var(--wv-text-primary)] capitalize">
                        {log.table_name.replace(/_/g, ' ')}
                     </span>
                  </div>
                  {statusValue && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-[var(--wv-text-secondary)] font-medium tracking-wide uppercase">Status:</span>
                      <span className={cn(
                        "font-bold uppercase",
                        statusValue === 'paid' ? "text-[var(--wv-status-success-fg)]" : "text-[var(--wv-status-warning-fg)]"
                      )}>
                        {statusValue}
                      </span>
                    </div>
                  )}
               </div>
            )}
          </button>

          {/* Expanded Content (Technical Diff) */}
          {isExpanded && (
            <div className="bg-[var(--wv-bg-subtle)]/50 border-t border-[var(--wv-border-subtle)] p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--wv-text-secondary)] uppercase tracking-widest mb-2">
                 <Info className="h-3.5 w-3.5" /> Technical Data Log
              </div>
              <AuditDiff oldData={log.old_data} newData={log.new_data} />
              
              <div className="grid grid-cols-2 gap-4 text-[11px] bg-[var(--wv-bg-surface)] p-3 rounded-xl border border-[var(--wv-border-subtle)] shadow-xs">
                <div>
                   <span className="text-[var(--wv-text-secondary)] block mb-1">Database Table</span>
                   <code className="text-[var(--wv-action-primary)] font-bold">{log.table_name}</code>
                </div>
                <div>
                   <span className="text-[var(--wv-text-secondary)] block mb-1">Precise Timestamp</span>
                   <span className="text-[var(--wv-text-primary)] font-semibold">{formatToSurat(new Date(log.changed_at), 'PPP pp')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
