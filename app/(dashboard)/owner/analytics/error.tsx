'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AnalyticsError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error('[analytics] route failed', error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center px-4">
      <div role="alert" className="w-full rounded-2xl border border-destructive/30 bg-card p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-7 w-7 text-destructive" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Dashboard could not load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No totals were replaced. Retry to load the latest production, order pace, machine, and wage data.
        </p>
        <Button type="button" className="mt-5" onClick={reset}>Retry dashboard</Button>
      </div>
    </div>
  )
}
