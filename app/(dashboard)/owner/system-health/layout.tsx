import AccessGate from '@/components/billing/AccessGate'
import QueryProvider from '@/components/query-provider'

export default function SystemHealthLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="premium" routeName="/owner/system-health"><QueryProvider>{children}</QueryProvider></AccessGate>
}
