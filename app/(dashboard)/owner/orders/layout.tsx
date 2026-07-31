import AccessGate from '@/components/billing/AccessGate'

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="premium" routeName="/owner/orders">{children}</AccessGate>
}
