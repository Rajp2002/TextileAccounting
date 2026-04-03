'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { KpiStrip } from './KpiStrip'
import { YieldAlertBanner } from './YieldAlertBanner'
import { OrdersSection } from './OrdersSection'
import { WorkerBreakdown } from './WorkerBreakdown'
import { refreshLiveDashboard } from '../../actions/dashboard'
import type { DashboardData } from '../../actions/dashboard'

export function DashboardClient({ initialData, orgId }: { initialData: DashboardData, orgId: string }) {
  const [data, setData] = useState(initialData)
  const [isConnected, setIsConnected] = useState(true)
  const supabase = createClient()
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

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
        }))
      } catch (err) {
        console.error('Failed to sync live dashboard data', err)
      }
    }, 2000)
  }, [])

  useEffect(() => {
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
  }, [supabase, handleRealtimeUpdate, orgId])

  return (
    <div className="flex flex-col gap-6 p-6">
      {!isConnected && (
        <div className="text-sm text-warning flex items-center justify-end w-full">
          <span className="w-2 h-2 bg-background-warning rounded-full mr-2"></span>
          Attempting to reconnect live data...
        </div>
      )}
      <KpiStrip yesterday={data.yesterday} today={data.today} isConnected={isConnected} />
      {data.yieldAlert && <YieldAlertBanner alert={data.yieldAlert} />}
      <OrdersSection orders={data.orders} />
      <WorkerBreakdown entries={data.workerBreakdown} />
    </div>
  )
}
