import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Factory Setup Onboarding | Weavly',
    description: 'Initialize your factory machines, workforce, and costing defaults on the Weavly Base Plan.',
}

export default function BaseOnboardingLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-[var(--wv-cotton-100)] antialiased">
            {children}
        </div>
    )
}
