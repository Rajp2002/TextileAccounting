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
        // Match the opening intro stage while an installed app's document loads.
        background_color: '#000000',
        orientation: 'any',
        theme_color: '#F4F2EC',
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
            // Every paid plan has these, so no install opens onto an upgrade wall.
            {
                name: 'Saved Costings',
                short_name: 'Costings',
                description: 'Open your saved costings.',
                url: '/owner/quotes',
                icons: [{ src: '/icon-192x192.png?v=3', sizes: '192x192', type: 'image/png' }],
            },
            {
                name: 'Yarn Rates',
                short_name: 'Rates',
                description: 'Update yarn rates.',
                url: '/owner/rates',
                icons: [{ src: '/icon-192x192.png?v=3', sizes: '192x192', type: 'image/png' }],
            },
        ],
    }
}
