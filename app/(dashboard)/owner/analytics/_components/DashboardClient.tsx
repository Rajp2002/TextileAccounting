'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { KpiStrip } from './KpiStrip'
import { YieldAlertBanner } from './YieldAlertBanner'
import { OrderHealthSummary } from './OrderHealthSummary'
import { MachineUtilization } from './MachineUtilization'
import { ProductionTrend } from './ProductionTrend'
import { WorkerBreakdown } from './WorkerBreakdown'
import { refreshLiveDashboard, fetchHistoricalData } from '../../actions/dashboard'
import type { DashboardData } from '../../actions/dashboard'
import { getSuratTodayString } from '@/lib/time'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n/context'
import { CalendarDays, Wifi, WifiOff } from 'lucide-react'

export function DashboardClient({ initialData, orgId }: { initialData: DashboardData, orgId: string }) {
  const [data, setData] = useState(initialData)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [selectedDate, setSelectedDate] = useState<string>(getSuratTodayString())
  const supabase = createClient()
  const channelRef = useRef<any>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const { t } = useTranslation()

  const handleRealtimeUpdate = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      try {
        const liveData = await refreshLiveDashboard()
        setData((prev: DashboardData) => ({
          ...prev,
          today:           liveData.today,
          orders:          liveData.orders,
          workerBreakdown: liveData.workerBreakdown,
          machines:        liveData.machines,
        }))
      } catch (err) {
        console.error('Failed to sync live dashboard data', err)
      }
    }, 2000)
  }, [])

  useEffect(() => {
    const isToday = selectedDate === getSuratTodayString()
    
    if (!isToday) {
      setIsConnected(false)
      return
    }

    const channelName = `org-${orgId || 'no-org'}-production-logs`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'production_logs' },
        handleRealtimeUpdate
      )
      .subscribe((status: string) => {
        console.log(`[Dashboard] Realtime status for ${channelName}:`, status)
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error')
        } else {
          setConnectionStatus('connecting')
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [supabase, handleRealtimeUpdate, orgId, selectedDate])

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    if (newDate > getSuratTodayString()) return
    setSelectedDate(newDate)

    const isToday = newDate === getSuratTodayString()
    if (isToday) {
      const liveData = await refreshLiveDashboard()
      setData((prev) => ({
        ...prev,
        today: liveData.today,
        workerBreakdown: liveData.workerBreakdown,
        yesterday: initialData.yesterday
      }))
    } else {
      const history = await fetchHistoricalData(newDate)
      setData((prev) => ({
        ...prev,
        yesterday: history.yesterday,
        today: null,
        workerBreakdown: history.workerBreakdown
      }))
    }
  }

  const isToday = selectedDate === getSuratTodayString()

  return (
    <div className="flex flex-col gap-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isToday ? 'Live factory overview' : 'Historical view'}
          </p>
        </div>

        {/* Date + connection status */}
        <div className="flex items-center gap-3">
          {isToday && (
            <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors duration-300 ${
              connectionStatus === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 
              connectionStatus === 'error' ? 'text-amber-600 dark:text-amber-400' :
              'text-muted-foreground'
            }`}>
              {connectionStatus === 'connected' && (
                <><span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span> Live</>
              )}
              {connectionStatus === 'connecting' && (
                <><span className="inline-block animate-pulse">●</span> {t('dashboard.connecting')}</>
              )}
              {connectionStatus === 'error' && (
                <><WifiOff className="h-3 w-3" /> {t('dashboard.sync_error')}</>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              id="date-picker"
              type="date"
              max={getSuratTodayString()}
              value={selectedDate}
              onChange={handleDateChange}
              className="border-0 shadow-none p-0 h-auto text-sm bg-transparent focus-visible:ring-0 w-[120px] text-foreground"
            />
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip yesterday={data.yesterday} today={data.today} isConnected={connectionStatus === 'connected'} selectedDate={selectedDate} />

      {/* Yield Alert */}
      {data.yieldAlert && <YieldAlertBanner alert={data.yieldAlert} />}

      {/* Analytics widgets — 2-col on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <OrderHealthSummary orders={data.orders} />
        <MachineUtilization machines={data.machines} />
      </div>

      {/* 7-day trend — full width */}
      <ProductionTrend data={data.trend} />

      {/* Worker breakdown */}
      <WorkerBreakdown entries={data.workerBreakdown} />
    </div>
  )
}
