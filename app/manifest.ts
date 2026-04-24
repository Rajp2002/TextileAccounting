import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Weavly — Production Management',
        short_name: 'Weavly',
        description: 'Track production, manage workers, and automate daily briefs.',
        // Start directly at /login so cold PWA opens skip the middleware
        // auth-check → redirect chain (saves 3+ sequential server round-trips).
        start_url: '/login',
        scope: '/',
        display: 'standalone',
        // Warm brand color painted by the OS before JS loads — eliminates black flash.
        background_color: '#fdf6e9',
        orientation: 'portrait',
        theme_color: '#fdf6e9',
        icons: [
            {
                src: '/icon-192x192.png?v=2',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512x512.png?v=2',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}
