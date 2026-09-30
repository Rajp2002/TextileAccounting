import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        // `npm run build` runs `prebuild` (npm test) with NODE_ENV=production on Vercel. React ships no `act` in its
        // production build, so tests that mount roots through `act` fail there while passing locally. Pin the test
        // environment so a deploy build runs the same tests the same way as `npx vitest run`.
        env: { NODE_ENV: 'test' },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
            // next/font only works inside Next's compiler; tests render with a stub.
            'next/font/google': path.resolve(__dirname, './__tests__/stubs/next-font-google.ts'),
        },
    },
})
