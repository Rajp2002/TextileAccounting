import AccessGate from '@/components/billing/AccessGate'

export default function StockLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="premium">{children}</AccessGate>
}
