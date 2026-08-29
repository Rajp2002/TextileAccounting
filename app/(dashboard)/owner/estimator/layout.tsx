import AccessGate from '@/components/billing/AccessGate'

export default function EstimatorLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredCapability="estimator" routeName="/owner/estimator">{children}</AccessGate>
}
