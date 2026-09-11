import AccessGate from '@/components/billing/AccessGate'

export default function SetupLayout({ children }: { children: React.ReactNode }) {
    return <AccessGate requiredCapability="production_management" routeName="/owner/setup">{children}</AccessGate>
}
