import AccessGate from '@/components/billing/AccessGate'
import QueryProvider from '@/components/query-provider'

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="premium" routeName="/owner/fixed-workers"><QueryProvider>{children}</QueryProvider></AccessGate>
}
