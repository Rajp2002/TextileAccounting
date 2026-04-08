import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Loomi — Production Management',
        short_name: 'Loomi',
        description: 'Track production, manage workers, and automate daily briefs.',
        start_url: '/',
        display: 'standalone',
        background_color: '#fafaf9', // bg-stone-50 tone
        orientation: 'portrait',
        theme_color: '#b45309', // amber-700 / terracotta primary
        icons: [
            {
                src: '/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}
