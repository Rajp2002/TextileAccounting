import { defineConfig, devices } from '@playwright/test'

// This harness cannot navigate to a hosted/customer environment. Positive
// identity cases require separately approved loopback Supabase fixture states.
export default defineConfig({
    testDir: './__tests__/browser-admin',
    outputDir: './output/playwright/admin-console/results',
    reporter: [['list'], ['json', { outputFile: 'output/playwright/admin-console/results.json' }]],
    timeout: 30_000,
    expect: { timeout: 10_000 },
    workers: 1,
    use: {
        baseURL: 'http://127.0.0.1:3100',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    ],
    webServer: {
        command: 'node scripts/performance/isolated-command.mjs node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',
        url: 'http://127.0.0.1:3100/admin/login',
        reuseExistingServer: false,
        timeout: 120_000,
    },
})
