'use client'

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarDays, TrendingUp, Layers, Link2, Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { getSuratDate } from "@/lib/time"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { assignOrderToMachines } from "@/app/(dashboard)/owner/actions"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n/context"

interface OrderCardProps {
  order: {
    order_id: string
    party_name: string
    total_target_meters: number
    total_meters_produced: number
    progress_percent: number
    time_elapsed_percent: number
    pace_index: number
    deadline: string
    status: string
    quality_name: string
    assigned_machines_count: number
    org_id: string
  }
  forecast?: {
    predicted_finish_date: string | null
    is_theoretical: boolean
    remaining_meters: number
    avg_daily_production: number
  }
  layout?: 'compact' | 'wide'
}

export function OrderCard({ order, forecast, layout = 'compact' }: OrderCardProps) {
  const { t } = useTranslation()
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedMachines, setSelectedMachines] = useState<string[]>([])
  
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Logic to determine if we are behind schedule
  const suratNow = getSuratDate()
  const isOverdue = forecast?.predicted_finish_date 
    ? new Date(forecast.predicted_finish_date) > new Date(order.deadline) && order.progress_percent < 100
    : suratNow > new Date(order.deadline) && order.progress_percent < 100

  const isAtRisk = !isOverdue && (new Date(order.deadline).getTime() - suratNow.getTime()) < 48 * 60 * 60 * 1000 && order.progress_percent < 90
  
  const statusColor = isOverdue ? 'text-rose-600' : isAtRisk ? 'text-amber-600' : 'text-emerald-600'
  const statusBg = isOverdue ? 'bg-rose-50' : isAtRisk ? 'bg-amber-50' : 'bg-emerald-50'
  const borderColor = isOverdue ? 'border-rose-200' : isAtRisk ? 'border-amber-200' : 'border-emerald-200'

  // Query all machines for the org
  const { data: machines, isLoading: machinesLoading } = useQuery({
    queryKey: ['machines', order.org_id],
    enabled: assignDialogOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('id, name, current_order_id')
        .eq('org_id', order.org_id)
        .order('name')
      if (error) throw error
      
      const assigned = (data as any[]).filter(m => m.current_order_id === order.order_id).map(m => m.id)
      setSelectedMachines(assigned)
      
      return data as any[]
    }
  })

  // Mutation for assigning machines
  const assignMutation = useMutation({
    mutationFn: async (machineIds: string[]) => {
      const res = await assignOrderToMachines(order.order_id, machineIds)
      if (res.error) throw new Error(res.error)
      return res
    },
    onSuccess: () => {
      toast.success(t('analytics.orders.card.machines_assigned'))
      setAssignDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['order_progress_summary'] })
      queryClient.invalidateQueries({ queryKey: ['machines'] })
    },
    onError: (err: any) => {
      toast.error(err.message || t('analytics.orders.card.assign_failed'))
    }
  })

  const toggleMachine = (id: string) => {
    setSelectedMachines(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    )
  }

  if (layout === 'wide') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans p-8 w-full">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Left Side: Title, Subtitle, and large Progress Bar */}
          <div className="flex-1 space-y-8">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                    {order.party_name}
                  </h3>
                  <span className={cn(
                    "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                    isOverdue ? "bg-rose-50 text-rose-700 border-rose-100" : 
                    isAtRisk ? "bg-amber-50 text-amber-700 border-amber-100" :
                    order.progress_percent >= 100 ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                    "bg-emerald-50 text-emerald-700 border-emerald-100"
                  )}>
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full mr-2",
                      isOverdue ? "bg-rose-500" : isAtRisk ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                    )} />
                    {isOverdue ? t('analytics.orders.card.overdue') : isAtRisk ? t('analytics.orders.card.at_risk') : order.progress_percent >= 100 ? t('analytics.orders.card.finished') : t('analytics.orders.card.active')}
                  </span>
                </div>
                <p className="text-lg text-slate-500 flex items-center gap-2 font-medium">
                  <Layers className="h-5 w-5 text-slate-400" />
                  {order.quality_name}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('analytics.orders.card.progress')}</span>
                <span className="text-5xl font-black text-slate-900 tabular-nums tracking-tighter">
                  {Math.round(order.progress_percent)}<span className="text-2xl font-medium text-slate-400 ml-1">%</span>
                </span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-1000 ease-out",
                    isOverdue ? "bg-rose-500" : isAtRisk ? "bg-amber-500" : "bg-teal-600 shadow-[0_0_15px_-3px_rgba(20,184,166,0.3)]"
                  )} 
                  style={{ width: `${order.progress_percent}%` }} 
                />
              </div>
              <div className="flex justify-between items-center pt-2">
                <p className="text-base text-slate-400 font-medium">
                  <span className="text-slate-900 font-bold">{Math.round(order.total_meters_produced).toLocaleString()}</span>
                  <span className="mx-2">/</span>
                  {Math.round(order.total_target_meters).toLocaleString()}m {t('common.produced')}
                </p>
                <div className="flex items-center gap-4">
                  {order.progress_percent < 100 && (
                    <span className="text-slate-400 font-medium italic text-sm bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                      ~{Math.round(forecast?.remaining_meters || (order.total_target_meters - order.total_meters_produced)).toLocaleString()}{t('analytics.orders.card.left')}
                    </span>
                  )}
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssignDialogOpen(true);
                    }} 
                    className="rounded-xl border-slate-200 hover:bg-slate-50 text-indigo-600 font-bold"
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    {t('analytics.orders.card.view_details')}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Stats Grid and Forecast section */}
          <div className="lg:w-1/3 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm">
                    <TrendingUp className={cn("w-4 h-4", order.pace_index >= 1 ? "text-emerald-500" : "text-amber-500")} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('analytics.orders.card.health_index')}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 leading-none mb-1">{order.pace_index.toFixed(2)}</p>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight">{t('analytics.orders.card.pace')}</p>
                </div>
              </div>
              
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm">
                    <CalendarDays className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('analytics.orders.card.deadline')}</span>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 leading-none mb-1">{format(new Date(order.deadline), "MMM d")}</p>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight">{format(new Date(order.deadline), "yyyy")}</p>
                </div>
              </div>

              {forecast && forecast.predicted_finish_date && (
                <div className={cn(
                  "col-span-2 p-6 rounded-2xl border-2 flex flex-col justify-center gap-3",
                  statusBg, borderColor
                )}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {t('analytics.orders.card.estimated_finish')}
                      </span>
                    </div>
                    {forecast.is_theoretical && (
                      <span className="text-[9px] px-2 py-0.5 bg-white/80 border border-slate-200 rounded-full font-bold text-slate-500">
                        {t('analytics.orders.card.theoretical')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className={`text-4xl font-black ${statusColor} tracking-tighter`}>
                      {format(new Date(forecast.predicted_finish_date), "MMMM d")}
                    </p>
                    <div className="text-right">
                       <p className="text-xs font-medium text-slate-400 italic">{t('analytics.orders.card.warm_up')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden font-sans h-full flex flex-col">
      {/* Header Section */}
      <div className="p-5 pb-0 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 leading-tight">
            {order.party_name}
          </h3>
          <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5 font-medium">
             <Layers className="h-3.5 w-3.5 text-slate-400" />
            {order.quality_name}
          </p>
        </div>
        <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
            isOverdue ? "bg-rose-50 text-rose-700 border-rose-100" : 
            isAtRisk ? "bg-amber-50 text-amber-700 border-amber-100" :
            order.progress_percent >= 100 ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
            "bg-emerald-50 text-emerald-700 border-emerald-100"
        )}>
          <span className={cn(
              "w-1.5 h-1.5 rounded-full mr-1.5",
              isOverdue ? "bg-rose-500" : isAtRisk ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
          )} />
          {isOverdue ? t('analytics.orders.card.overdue') : isAtRisk ? t('analytics.orders.card.at_risk') : order.progress_percent >= 100 ? t('analytics.orders.card.finished') : t('analytics.orders.card.active')}
        </span>
      </div>

      {/* Progress Section */}
      <div className="px-5 py-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('analytics.orders.card.progress')}</span>
          <span className="text-2xl font-bold text-slate-900 tabular-nums">
            {Math.round(order.progress_percent)}<span className="text-sm font-medium text-slate-400 ml-0.5">%</span>
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                isOverdue ? "bg-rose-500" : isAtRisk ? "bg-amber-500" : "bg-teal-600"
            )} 
            style={{ width: `${order.progress_percent}%` }} 
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-2 font-medium">
          {Math.round(order.total_meters_produced).toLocaleString()} / {Math.round(order.total_target_meters).toLocaleString()}m
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 border-y border-slate-100 divide-x divide-slate-100 bg-slate-50/30">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className={cn("w-3.5 h-3.5", order.pace_index >= 1 ? "text-emerald-500" : "text-amber-500")} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('analytics.orders.card.health_index')}</span>
          </div>
          <p className="text-sm font-semibold text-slate-700">{order.pace_index.toFixed(2)}{t('analytics.orders.card.pace')}</p>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('analytics.orders.card.deadline')}</span>
          </div>
          <p className="text-sm font-semibold text-slate-700">{format(new Date(order.deadline), "MMM d, yyyy")}</p>
        </div>
      </div>

      {/* Forecast Section */}
      <div className="flex-1">
          {forecast && forecast.predicted_finish_date && (
            <div className={`m-4 p-4 rounded-lg border-l-4 ${statusBg} ${borderColor} relative`}>
                <div className="flex justify-between items-start">
                <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    {t('analytics.orders.card.estimated_finish')}
                    </span>
                    <p className={`text-lg font-bold ${statusColor}`}>
                    {format(new Date(forecast.predicted_finish_date), "MMMM d")}
                    </p>
                </div>
                {forecast.is_theoretical && (
                    <div className="text-right">
                        <span className="text-[10px] px-1.5 py-0.5 bg-white/60 border border-slate-200 rounded uppercase font-bold text-slate-400">
                        {t('analytics.orders.card.theoretical')}
                        </span>
                        <p className="text-[10px] italic text-slate-400 mt-1">{t('analytics.orders.card.warm_up')}</p>
                    </div>
                )}
                </div>
            </div>
          )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-white flex justify-between items-center text-xs border-t border-slate-50 mt-auto">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-500 font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            {order.assigned_machines_count} {t('analytics.orders.card.machines')}
          </span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setAssignDialogOpen(true);
            }}
            className="flex items-center gap-1 text-indigo-600 font-semibold hover:text-indigo-700 transition-colors uppercase tracking-tight text-[10px]"
          >
            <Link2 className="w-3.5 h-3.5" />
            {t('analytics.orders.card.link_machines')}
          </button>
        </div>
        {order.progress_percent < 100 && (
            <span className="text-slate-400 font-medium italic">
                ~{Math.round(forecast?.remaining_meters || (order.total_target_meters - order.total_meters_produced)).toLocaleString()}{t('analytics.orders.card.left')}
            </span>
        )}
      </div>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('analytics.orders.card.link_title')}</DialogTitle>
            <DialogDescription>
              {t('analytics.orders.card.link_desc')} <strong>{order.party_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {machinesLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                {machines?.map(machine => {
                  const isSelected = selectedMachines.includes(machine.id)
                  const isOtherOrder = machine.current_order_id && machine.current_order_id !== order.order_id
                  
                  return (
                    <button
                      key={machine.id}
                      onClick={() => toggleMachine(machine.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border text-left transition-all",
                        isSelected 
                          ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600" 
                          : "border-gray-200 hover:border-teal-300 hover:bg-gray-50"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{machine.name}</div>
                        {isOtherOrder && (
                          <div className="text-[9px] text-amber-600 font-bold uppercase truncate">{t('analytics.orders.card.switching')}</div>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-teal-600 shrink-0 ml-1" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setAssignDialogOpen(false)}
              disabled={assignMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => assignMutation.mutate(selectedMachines)}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('analytics.orders.card.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
