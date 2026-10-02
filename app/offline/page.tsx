import { OfflineRecovery } from '@/components/offline-recovery'

export const metadata = {
  title: 'Offline | Weavly',
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-background px-4 py-8 pt-[calc(2rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <OfflineRecovery />
    </main>
  )
}
