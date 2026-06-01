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
  hr_payroll: { icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', glow: 'shadow-indigo-100' },
  production: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', glow: 'shadow-emerald-100' },
  inventory: { icon: Layers, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', glow: 'shadow-amber-100' },
  settings_security: { icon: Shield, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', glow: 'shadow-rose-100' },
  estimator: { icon: Calculator, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', glow: 'shadow-blue-100' },
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
        {!isLast && <div className="flex-1 w-0.5 bg-gray-100 my-2" />}
      </div>

      {/* ── Narrative Card ── */}
      <div className="flex-1 pb-8">
        <div 
          className={cn(
            "group bg-white rounded-2xl border transition-all duration-300 overflow-hidden",
            isExpanded ? "border-gray-300 shadow-xl ring-1 ring-gray-900/5" : "border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"
          )}
        >
          {/* Header Area */}
          <div 
            className="p-4 cursor-pointer select-none"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                    {summary}
                  </h3>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0 border-gray-200 text-gray-400 bg-gray-50">
                    {log.action}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5 py-0.5 px-2 bg-gray-50 rounded-full border border-gray-100">
                    <div className="h-4 w-4 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                      {actorInitial}
                    </div>
                    <span className="font-semibold text-gray-700">{actorName}</span>
                  </div>
                  <span className="h-1 w-1 rounded-full bg-gray-300" />
                  <div className="flex items-center gap-1">
                    <History className="h-3 w-3" />
                    {timeAgo}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                 <div className="text-right hidden sm:block">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Entity ID</div>
                    <div className="text-xs font-mono font-bold text-gray-600">#{log.record_id}</div>
                 </div>
                 <div className={cn(
                   "h-8 w-8 rounded-full flex items-center justify-center bg-gray-50 text-gray-400 group-hover:bg-primary/5 group-hover:text-primary transition-colors",
                   isExpanded && "bg-primary/10 text-primary rotate-180"
                 )}>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                 </div>
              </div>
            </div>

            {/* Smart Preview (Grid of key changes) */}
            {!isExpanded && (
               <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-4">
                  {/* We show a very simplified preview if collapsed */}
                  <div className="flex items-center gap-2 text-[11px]">
                     <span className="text-gray-400 font-medium tracking-wide uppercase">Entity:</span>
                     <span className="font-bold text-gray-700 capitalize">
                        {log.table_name.replace(/_/g, ' ')}
                     </span>
                  </div>
                  {statusValue && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-gray-400 font-medium tracking-wide uppercase">Status:</span>
                      <span className={cn(
                        "font-bold uppercase",
                        statusValue === 'paid' ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {statusValue}
                      </span>
                    </div>
                  )}
               </div>
            )}
          </div>

          {/* Expanded Content (Technical Diff) */}
          {isExpanded && (
            <div className="bg-gray-50/50 border-t border-gray-100 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                 <Info className="h-3.5 w-3.5" /> Technical Data Log
              </div>
              <AuditDiff oldData={log.old_data} newData={log.new_data} />
              
              <div className="grid grid-cols-2 gap-4 text-[11px] bg-white p-3 rounded-xl border border-gray-200/50 shadow-inner">
                <div>
                   <span className="text-gray-400 block mb-1">Database Table</span>
                   <code className="text-primary font-bold">{log.table_name}</code>
                </div>
                <div>
                   <span className="text-gray-400 block mb-1">Precise Timestamp</span>
                   <span className="text-gray-700 font-semibold">{formatToSurat(new Date(log.changed_at), 'PPP pp')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
