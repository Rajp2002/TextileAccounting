import AccessGate from '@/components/billing/AccessGate'

export default function EstimatorLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredTier="base">{children}</AccessGate>
}
