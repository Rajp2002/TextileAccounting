import AccessGate from '@/components/billing/AccessGate'

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredCapability="production_management" routeName="/owner/assignments">{children}</AccessGate>
}
