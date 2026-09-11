import AccessGate from '@/components/billing/AccessGate'

export default function Layout({ children }: { children: React.ReactNode }) {
 return <AccessGate requiredCapability="production_management" routeName="/owner/workers">{children}</AccessGate>
}
