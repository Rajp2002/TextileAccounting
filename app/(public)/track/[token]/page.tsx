import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

// ─── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: 'Tracking Unavailable · Weavly',
        description: 'Public dispatch receipt confirmation is currently disabled.',
        robots: { index: false, follow: false },
    }
}

export default async function TrackingPage() {
    notFound()
}
