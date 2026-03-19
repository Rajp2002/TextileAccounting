'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, TrendingUp, TrendingDown, Clock, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

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
  }
  forecast?: {
    predicted_finish_date: string | null
    is_theoretical: boolean
    remaining_meters: number
    avg_daily_production: number
  }
}

export function OrderCard({ order, forecast }: OrderCardProps) {
  const isOverdue = new Date() > new Date(order.deadline) && order.progress_percent < 100
  const isAtRisk = !isOverdue && (new Date(order.deadline).getTime() - new Date().getTime()) < 48 * 60 * 60 * 1000 && order.progress_percent < 90
  
  const statusColorText = isOverdue 
    ? "text-red-600" 
    : isAtRisk 
      ? "text-amber-600" 
      : order.progress_percent >= 100 
        ? "text-green-600"
        : order.pace_index >= 1 
          ? "text-green-600" 
          : "text-amber-500"

  const progressColorBg = isOverdue 
    ? "bg-red-500" 
    : isAtRisk 
      ? "bg-amber-500" 
      : order.progress_percent >= 100 
        ? "bg-green-500" 
        : "bg-teal-500"

  const paceColorText = order.pace_index >= 1 ? "text-green-700" : "text-amber-700"
  const paceBg = order.pace_index >= 1 ? "bg-green-50" : "bg-amber-50"

  return (
    <Card className={cn(
        "overflow-hidden border-l-4 transition-all hover:shadow-md",
        isOverdue ? "border-l-red-500" : isAtRisk ? "border-l-amber-500" : "border-l-teal-500"
    )}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-1">
            <h3 className="font-bold text-lg text-gray-900 leading-none">{order.party_name}</h3>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                <Layers className="h-3 w-3" />
                {order.quality_name}
            </div>
          </div>
          <Badge variant={isOverdue ? "destructive" : isAtRisk ? "warning" : "default"} className={cn(
            "capitalize px-2.5 py-0.5 text-[10px] font-bold tracking-wide",
            !isOverdue && !isAtRisk && "bg-teal-100 text-teal-800 hover:bg-teal-100"
          )}>
            {isOverdue ? "Overdue" : isAtRisk ? "At Risk" : order.progress_percent >= 100 ? "Finished" : "Active"}
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm mb-1 items-baseline">
              <span className="text-xs font-semibold text-gray-500">
                {Math.round(order.total_meters_produced).toLocaleString()} / {Math.round(order.total_target_meters).toLocaleString()}m
              </span>
              <span className={cn("text-lg font-black tabular-nums", statusColorText)}>
                {Math.round(order.progress_percent)}%
              </span>
            </div>
            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-700 ease-out", progressColorBg)} 
                style={{ width: `${order.progress_percent}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2">
              <div className={cn("p-2 rounded-lg", paceBg)}>
                {order.pace_index >= 1 
                  ? <TrendingUp className="h-4 w-4 text-green-600" /> 
                  : <TrendingDown className="h-4 w-4 text-amber-600" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-gray-400 uppercase font-black tracking-tighter">Health Index</p>
                <p className={cn("text-xs font-bold truncate", paceColorText)}>
                  {order.pace_index.toFixed(2)}x Pace
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50">
                <CalendarDays className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[9px] text-gray-400 uppercase font-black tracking-tighter">Deadline</p>
                <p className="text-xs font-bold text-gray-800">
                  {format(new Date(order.deadline), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Forecast Section */}
          {forecast && forecast.predicted_finish_date && (
            <div className={cn(
                "mt-4 p-3 rounded-xl border flex items-center justify-between transition-colors",
                new Date(forecast.predicted_finish_date) > new Date(order.deadline) 
                    ? "bg-red-50 border-red-100" 
                    : "bg-teal-50/50 border-teal-100"
            )}>
              <div className="flex items-center gap-2">
                <div className={cn(
                    "p-1.5 rounded-full",
                    new Date(forecast.predicted_finish_date) > new Date(order.deadline) ? "bg-red-100" : "bg-teal-100"
                )}>
                    <Clock className={cn(
                        "h-3.5 w-3.5",
                        new Date(forecast.predicted_finish_date) > new Date(order.deadline) ? "text-red-600" : "text-teal-600"
                    )} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-bold uppercase leading-none mb-1">Estimated Finish</span>
                    <span className={cn(
                        "text-sm font-black tracking-tight",
                        new Date(forecast.predicted_finish_date) > new Date(order.deadline) ? "text-red-700" : "text-teal-800"
                    )}>
                        {format(new Date(forecast.predicted_finish_date), "MMMM d")}
                    </span>
                </div>
              </div>
              
              {forecast.is_theoretical && (
                <div className="flex flex-col items-end">
                    <Badge variant="outline" className="text-[8px] h-4 bg-white/80 text-gray-400 border-gray-200 font-bold uppercase tracking-widest px-1">
                        Theoretical
                    </Badge>
                    <span className="text-[8px] text-gray-400 mt-1 italic">Warm-up</span>
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium pt-1">
             <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                {order.assigned_machines_count} Machines Assigned
             </div>
             {order.progress_percent < 100 && (
                 <div className="italic">
                    ~{Math.round(forecast?.remaining_meters || (order.total_target_meters - order.total_meters_produced)).toLocaleString()}m left
                 </div>
             )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
