import AccessGate from '@/components/billing/AccessGate'
import QueryProvider from '@/components/query-provider'
export default function Layout({ children }: { children: React.ReactNode }) {
 return <AccessGate requiredCapability="production_management" routeName="/owner/machines"><QueryProvider>{children}</QueryProvider></AccessGate>
}
