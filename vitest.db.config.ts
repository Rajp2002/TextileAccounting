import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Database behavior tests (`npm run test:db`). They start a disposable local
// PostgreSQL cluster, so they are kept out of the default `npm test` run.
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['__tests__/db/**/*.dbtest.ts'],
        globalSetup: ['__tests__/db/global-setup.ts'],
        testTimeout: 30_000,
        hookTimeout: 180_000,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
})
