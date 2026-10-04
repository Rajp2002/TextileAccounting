import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
    testDir: './scripts/qa/admin-browser', testMatch: '**/*.browser.ts',
    outputDir: './output/playwright/admin-console/read-fixtures/results',
    reporter: [['list'], ['json', { outputFile: 'output/playwright/admin-console/read-fixtures/results.json' }]],
    // Functional component checks allow cold Vite compilation on a busy QA
    // host; this is not a production latency budget or an auth retry window.
    timeout: 60_000, expect: { timeout: 15_000 }, workers: 1,
    use: { baseURL: 'http://127.0.0.1:4185', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    ],
    webServer: {
        command: 'node scripts/performance/isolated-command.mjs node scripts/qa/admin-browser/server.mjs',
        url: 'http://127.0.0.1:4185/admin/factories', reuseExistingServer: false, timeout: 120_000,
    },
})
