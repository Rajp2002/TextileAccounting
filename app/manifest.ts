import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: '/',
        name: 'Weavly — Production Management',
        short_name: 'Weavly',
        description: 'Track production, manage workers, and automate daily briefs.',
        // Base owners reopen directly on their product home. Unauthenticated
        // launches still redirect to /login, while other roles retain the
        // middleware's role-aware redirect.
        start_url: '/owner/estimator',
        scope: '/',
        lang: 'en',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        // Warm brand color painted by the OS before JS loads — eliminates black flash.
        background_color: '#FFF8EA',
        orientation: 'portrait',
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
                name: 'Factory Today',
                short_name: 'Today',
                description: 'Open the owner daily factory view.',
                url: '/owner/today',
                icons: [{ src: '/icon-192x192.png?v=3', sizes: '192x192', type: 'image/png' }],
            },
            {
                name: 'Production Log',
                short_name: 'Log',
                description: 'Open supervisor production entry.',
                url: '/supervisor/dashboard',
                icons: [{ src: '/icon-192x192.png?v=3', sizes: '192x192', type: 'image/png' }],
            },
        ],
    }
}
