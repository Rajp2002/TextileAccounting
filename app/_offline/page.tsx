import { WifiOff, RefreshCw } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Offline | Weavly',
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-background px-4 py-8 pt-[calc(2rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <section className="w-full max-w-md rounded-lg border border-hairline bg-surface p-5 text-center shadow-[var(--shadow-panel)] sm:p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
          <WifiOff className="h-6 w-6" aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-2xl font-semibold leading-tight text-ink">You are offline</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Weavly will keep cached screens available where possible. Reconnect to load fresh factory data and sync pending changes.
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/login">Open sign in</Link>
          </Button>
          <Button asChild className="min-h-11">
            <Link href="/">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
