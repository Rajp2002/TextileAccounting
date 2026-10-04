import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './scripts/qa/formal-browser', testMatch: '**/*.browser.ts', workers: 1,
    outputDir: './output/playwright/admin-console/formal-fixtures/results',
    reporter: [['list'], ['json', { outputFile: 'output/playwright/admin-console/formal-fixtures/results.json' }]],
    timeout: 60_000, expect: { timeout: 15_000 },
    use: { baseURL: 'http://127.0.0.1:4190', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    ],
    webServer: {
        command: 'node scripts/performance/isolated-command.mjs node scripts/qa/formal-browser/server.mjs',
        url: 'http://127.0.0.1:4190/__formal_fixture__/health', reuseExistingServer: false, timeout: 120_000,
    },
})
