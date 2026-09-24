import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: '/',
        name: 'Weavly — Production Management',
        short_name: 'Weavly',
        description: 'Track production, manage workers, and automate daily briefs.',
        // Start directly at /login so cold PWA opens skip the middleware
        // auth-check → redirect chain (saves 3+ sequential server round-trips).
        start_url: '/login',
        scope: '/',
        lang: 'en',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        // Warm brand color painted by the OS before JS loads — eliminates black flash.
        background_color: '#FFF8EA',
        orientation: 'any',
        theme_color: '#FFF8EA',
        categories: ['business', 'productivity', 'finance'],
        icons: [
            {
                src: '/icon-192x192.png?v=3',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icon-512x512.png?v=3',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icon-192x192.png?v=3',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/icon-512x512.png?v=3',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
        shortcuts: [
            {
                name: 'Cost Estimate',
                short_name: 'Estimate',
                description: 'Open the costing workspace.',
                url: '/owner/estimator',
                icons: [{ src: '/icon-192x192.png?v=3', sizes: '192x192', type: 'image/png' }],
            },
            {
                name: 'Production',
                short_name: 'Production',
                description: 'Open Base production management.',
                url: '/owner/production',
                icons: [{ src: '/icon-192x192.png?v=3', sizes: '192x192', type: 'image/png' }],
            },
        ],
    }
}
