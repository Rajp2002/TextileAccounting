import AccessGate from '@/components/billing/AccessGate'

export default function CommercialsLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="premium">{children}</AccessGate>
}
