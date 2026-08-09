import QueryProvider from '@/components/query-provider'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
    return <QueryProvider>{children}</QueryProvider>
}
