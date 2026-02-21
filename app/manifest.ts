import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Textile SaaS',
        short_name: 'TextileApp',
        description: 'Textile production management system for India.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        orientation: 'portrait',
        theme_color: '#000000',
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
