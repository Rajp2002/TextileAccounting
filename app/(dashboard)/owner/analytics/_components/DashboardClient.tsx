'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { RealtimeChannel } from '@supabase/supabase-js'
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
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { CalendarDays, ClipboardList, DollarSign, Store, Wifi, WifiOff } from 'lucide-react'

const quickActions = [
  {
    href: '/owner/orders',
    label: 'Client Orders',
    description: 'Check pace and assign production',
    icon: ClipboardList,
  },
  {
    href: '/owner/market-runs',
    label: 'Market Runs',
    description: 'Track speculative loom output',
    icon: Store,
  },
  {
    href: '/owner/payroll',
    label: 'Payroll',
    description: 'Review wage liability from logs',
    icon: DollarSign,
  },
]

function QuickActions({ className = '' }: { className?: string }) {
  return (
    <section className={className} aria-label="Quick actions">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Quick actions</h2>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
        {quickActions.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-border bg-card/95 p-3 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">{label}</span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug text-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function DashboardClient({ initialData, orgId }: { initialData: DashboardData, orgId: string }) {
  const [data, setData] = useState(initialData)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'error' | 'offline' | 'historical'>('connecting')
  const [selectedDate, setSelectedDate] = useState<string>(getSuratTodayString())
  const supabase = createClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
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
          trend:           liveData.trend,
        }))
      } catch (err) {
        console.error('Failed to sync live dashboard data', err)
      }
    }, 2000)
  }, [])

  useEffect(() => {
    const isToday = selectedDate === getSuratTodayString()
    
    if (!isToday) return

    let disposed = false
    queueMicrotask(() => {
      if (disposed) return
      setConnectionStatus(typeof window !== 'undefined' && !navigator.onLine ? 'offline' : 'connecting')
    })

    const channelName = `org-${orgId || 'no-org'}-production-logs`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'production_logs', filter: `org_id=eq.${orgId}` },
        handleRealtimeUpdate
      )
      .subscribe((status: string) => {
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
      disposed = true
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

  const loadSelectedDate = async (newDate: string) => {
    if (!newDate) return
    if (newDate > getSuratTodayString()) return
    setSelectedDate(newDate)

    const isToday = newDate === getSuratTodayString()
    if (isToday) {
      setConnectionStatus(typeof window !== 'undefined' && !navigator.onLine ? 'offline' : 'connecting')
      const liveData = await refreshLiveDashboard()
      setData({
        yesterday: initialData.yesterday,
        today: liveData.today,
        orders: liveData.orders,
        workerBreakdown: liveData.workerBreakdown,
        machines: liveData.machines,
        trend: liveData.trend,
      })
    } else {
      setConnectionStatus('historical')
      const history = await fetchHistoricalData(newDate)
      setData(history)
    }
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void loadSelectedDate(e.target.value)
  }

  const applyRenderedDate = () => {
    const renderedDate = document.querySelector<HTMLInputElement>('[data-testid="dashboard-date-picker"]')?.value
      || dateInputRef.current?.value
    if (renderedDate) void loadSelectedDate(renderedDate)
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
              ref={dateInputRef}
              data-testid="dashboard-date-picker"
              id="date-picker"
              type="date"
              max={getSuratTodayString()}
              value={selectedDate}
              onChange={handleDateChange}
              className="border-0 shadow-none p-0 h-auto text-sm bg-transparent focus-visible:ring-0 w-[120px] text-foreground"
            />
            <Button type="button" size="sm" variant="ghost" onClick={applyRenderedDate} className="h-7 px-2 text-xs">
              View date
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip yesterday={data.yesterday} today={data.today} isConnected={connectionStatus === 'connected'} selectedDate={selectedDate} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {isToday && <QuickActions className="xl:hidden" />}

          {isToday && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <OrderHealthSummary orders={data.orders} />
              <MachineUtilization machines={data.machines} />
            </div>
          )}

          {/* 7-day trend — full width */}
          <ProductionTrend data={data.trend} selectedDate={selectedDate} />

          {/* Worker breakdown */}
          <WorkerBreakdown entries={data.workerBreakdown} selectedDate={selectedDate} />
        </div>

        {isToday && <QuickActions className="sticky top-6 hidden xl:block" />}
      </div>
    </div>
  )
}
