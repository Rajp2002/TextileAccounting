'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { KpiStrip } from './KpiStrip'
import { OrderHealthSummary } from './OrderHealthSummary'
import { MachineUtilization } from './MachineUtilization'
import { ProductionTrend } from './ProductionTrend'
import { WorkerBreakdown } from './WorkerBreakdown'
import { refreshLiveDashboard, fetchHistoricalData } from '../../actions/dashboard'
import type { DashboardData } from '../../actions/dashboard'
import { getSuratTodayString } from '@/lib/time'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n/context'
import { CalendarDays, ClipboardList, DollarSign, Store, Wifi, WifiOff } from 'lucide-react'

export function DashboardClient({ initialData, orgId }: { initialData: DashboardData, orgId: string }) {
  const [data, setData] = useState(initialData)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'error' | 'offline' | 'historical'>('connecting')
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
      setConnectionStatus('historical')
      return
    }

    if (typeof window !== 'undefined' && !navigator.onLine) {
      setConnectionStatus('offline')
    } else {
      setConnectionStatus('connecting')
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
          setConnectionStatus((prev) => {
            if (prev === 'reconnecting' || prev === 'error' || prev === 'offline') {
              handleRealtimeUpdate()
            }
            return 'connected'
          })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnectionStatus(typeof window !== 'undefined' && !navigator.onLine ? 'offline' : 'reconnecting')
        }
      })

    channelRef.current = channel

    const handleOnline = () => {
      setConnectionStatus('reconnecting')
      handleRealtimeUpdate()
    }
    const handleOffline = () => {
      setConnectionStatus('offline')
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
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
    <div className="flex flex-col gap-5 pb-24 md:pb-0">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Production Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isToday ? 'Orders, market runs, machines, and payroll signals' : 'Historical production view'}
          </p>
        </div>

        {/* Date + connection status */}
        <div className="flex items-center gap-3">
          {isToday && connectionStatus !== 'historical' && (
            <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors duration-300 ${
              connectionStatus === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 
              connectionStatus === 'offline' || connectionStatus === 'error' ? 'text-destructive' : 
              'text-muted-foreground'
            }`}>
              {connectionStatus === 'connected' && (
                <><span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span> Live</>
              )}
              {connectionStatus === 'connecting' && (
                <><span className="inline-block animate-pulse">●</span> {t('dashboard.connecting')}</>
              )}
              {connectionStatus === 'reconnecting' && (
                <><Wifi className="h-3.5 w-3.5 animate-pulse opacity-70" /> <span className="hidden sm:inline">{t('dashboard.reconnecting')}</span></>
              )}
              {connectionStatus === 'offline' && (
                <><WifiOff className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Offline</span></>
              )}
              {connectionStatus === 'error' && (
                <><WifiOff className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Connection Error</span></>
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

      {isToday && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/owner/orders" className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Client Orders</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">Check pace and assign production</p>
          </Link>
          <Link href="/owner/market-runs" className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Market Runs</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">Track speculative loom output</p>
          </Link>
          <Link href="/owner/payroll" className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Payroll</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">Review wage liability from logs</p>
          </Link>
        </div>
      )}

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
