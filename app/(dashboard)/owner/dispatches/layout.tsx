import AccessGate from '@/components/billing/AccessGate'

export default function DispatchesLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="premium">{children}</AccessGate>
}
