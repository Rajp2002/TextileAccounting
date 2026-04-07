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
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/lib/i18n/context'

export function DashboardClient({ initialData, orgId }: { initialData: DashboardData, orgId: string }) {
  const [data, setData] = useState(initialData)
  const [isConnected, setIsConnected] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string>(getSuratTodayString())
  const supabase = createClient()
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

    const channel = supabase
      .channel(`org-${orgId}-production-logs`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'production_logs' },
        handleRealtimeUpdate
      )
      .subscribe((status: string) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [supabase, handleRealtimeUpdate, orgId, selectedDate])

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    if (newDate > getSuratTodayString()) return // Rule 1: No future dates allowed
    setSelectedDate(newDate)

    const isToday = newDate === getSuratTodayString()
    if (isToday) {
      // Revert to pure today structure
      const liveData = await refreshLiveDashboard()
      setData((prev) => ({
        ...prev,
        today: liveData.today,
        workerBreakdown: liveData.workerBreakdown,
        yesterday: initialData.yesterday // safely assume initial bounds
      }))
    } else {
      // Fetch explicitly historical view mappings
      const history = await fetchHistoricalData(newDate)
      setData((prev) => ({
        ...prev,
        yesterday: history.yesterday, // actually mapped to the targetDate precisely inside the RPC
        today: null, // Rule 3: explicitly skip today metrics visually
        workerBreakdown: history.workerBreakdown
      }))
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Date picker row */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-2 w-full justify-end">
          {!isConnected && selectedDate === getSuratTodayString() && (
            <div className="text-sm text-warning flex items-center mr-4">
              <span className="w-2 h-2 bg-background-warning rounded-full mr-2"></span>
              {t('dashboard.reconnecting')}
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Label htmlFor="date-picker">{t('dashboard.date')}</Label>
            <Input 
              id="date-picker"
              type="date"
              max={getSuratTodayString()}
              value={selectedDate}
              onChange={handleDateChange}
              className="w-auto h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip yesterday={data.yesterday} today={data.today} isConnected={isConnected} selectedDate={selectedDate} />

      {/* Yield Alert */}
      {data.yieldAlert && <YieldAlertBanner alert={data.yieldAlert} />}

      {/* Analytics widgets — 2-col on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
