import AccessGate from '@/components/billing/AccessGate'

export default function DispatchesLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredCapability="production" routeName="/owner/dispatches">{children}</AccessGate>
}
