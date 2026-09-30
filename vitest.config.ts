import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
            // next/font only works inside Next's compiler; tests render with a stub.
            'next/font/google': path.resolve(__dirname, './__tests__/stubs/next-font-google.ts'),
        },
    },
})
