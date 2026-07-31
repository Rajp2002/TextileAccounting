import AccessGate from '@/components/billing/AccessGate'

export default function MarketRunsLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="premium" routeName="/owner/market-runs">{children}</AccessGate>
}
