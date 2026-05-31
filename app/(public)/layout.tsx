import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Order Tracking · Weavly',
    description: 'Track your fabric order in real time — production progress, dispatch status, and receipt confirmation.',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
