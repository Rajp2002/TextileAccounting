import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.route('**/*', route => {
        const host = new URL(route.request().url()).hostname
        return ['127.0.0.1', 'localhost', '::1'].includes(host) ? route.continue() : route.abort()
    })
})

async function noMobileOverflow(page: Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

test('partial collections disclose missing coverage and withhold net', async ({ page }, testInfo) => {
    await page.goto('/admin/payments?scenario=partial', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible()
    await expect(page.getByText('Known confirmed captures', { exact: true })).toBeVisible()
    await expect(page.getByText('₹12,998.00', { exact: true })).toBeVisible()
    await expect(page.getByText('₹1,000.00', { exact: true }).first()).toBeVisible()
    const net = page.locator('dl > div').filter({ has: page.getByText('Net collections', { exact: true }) })
    await expect(net).toContainText('Unavailable')
    await expect(page.getByText(/Complete period totals and net collections are unavailable/).first()).toBeVisible()
    await expect(page.getByText(/Unmapped source amounts across all retained history/)).toBeVisible()
    await expect(page.getByText(/Local “issued” means a refund creation response/)).toBeVisible()
    await expect(page.getByRole('button', { name: /refund|mark paid|capture payment|export/i })).toHaveCount(0)
    await noMobileOverflow(page)
    await page.screenshot({ path: `output/playwright/admin-console/synthetic-payments-partial-${testInfo.project.name}.png`, fullPage: true })
})

test('conflicted reconciliation cannot inherit an older complete claim', async ({ page }, testInfo) => {
    await page.goto('/admin/payments?scenario=conflict', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/unresolved conflicting coverage intervals/)).toBeVisible()
    const net = page.locator('dl > div').filter({ has: page.getByText('Net collections', { exact: true }) })
    await expect(net).toContainText('Unavailable')
    await expect(page.getByText('₹11,998.00', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/older complete records do not override these conflicts/)).toBeVisible()
    await noMobileOverflow(page)
    await page.screenshot({ path: `output/playwright/admin-console/synthetic-payments-conflict-${testInfo.project.name}.png`, fullPage: true })
})

test('Today links exact supporting queues and distinguishes internal follow-up from public promises', async ({ page }, testInfo) => {
    await page.goto('/admin?scenario=partial', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View included factories' })).toHaveAttribute('href', '/admin/factories?cohort=production')
    await expect(page.getByRole('link', { name: 'Base 8', exact: true })).toHaveAttribute('href', '/admin/factories?cohort=production&plan=base')
    await expect(page.getByRole('link', { name: 'Review commitments' })).toHaveAttribute('href', '/admin/support?queue=updates_due')
    await expect(page.getByRole('link', { name: 'Review internal follow-ups' })).toHaveAttribute('href', '/admin/support?queue=followups_due')
    await expect(page.getByText('Internal customer follow-ups due · 1', { exact: true })).toBeVisible()
    await expect(page.getByText(/Reminders for the founder to chase customer input/)).toBeVisible()
    await expect(page.getByText('Internal customer follow-up due', { exact: true })).toBeVisible()
    await expect(page.getByText(/Promised customer update due:/)).toBeVisible()
    await noMobileOverflow(page)
    await page.screenshot({ path: `output/playwright/admin-console/synthetic-today-${testInfo.project.name}.png`, fullPage: true })
    await page.getByRole('link', { name: 'Base 8', exact: true }).click()
    await expect(page.getByText('8 matching factories', { exact: true })).toBeVisible()
})

test('System keeps backup, restore and unconnected monitoring unavailable', async ({ page }, testInfo) => {
    await page.goto('/admin/system', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'System', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Last successful backup · unavailable' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Last successful restore test · unavailable' })).toBeVisible()
    await expect(page.getByText('Source unavailable. This signal cannot establish health.')).toBeVisible()
    await expect(page.getByText(/No failures, or no traffic, does not establish a healthy service/)).toBeVisible()
    await noMobileOverflow(page)
    await page.screenshot({ path: `output/playwright/admin-console/synthetic-system-${testInfo.project.name}.png`, fullPage: true })
})

test('Audit shows safe values without mutation controls', async ({ page }, testInfo) => {
    await page.goto('/admin/audit', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Audit', exact: true })).toBeVisible()
    await page.getByText('Safe change values', { exact: true }).click()
    await expect(page.getByText(/"status": "in_progress"/)).toBeVisible()
    await expect(page.getByRole('button', { name: /edit|delete|export/i })).toHaveCount(0)
    await expect(page.getByText(/Ticket bodies, credentials, and complete customer records are excluded/)).toBeVisible()
    await noMobileOverflow(page)
    await page.screenshot({ path: `output/playwright/admin-console/synthetic-audit-${testInfo.project.name}.png`, fullPage: true })
})

test('unavailable payment source cannot show a successful report', async ({ page }) => {
    await page.goto('/admin/payments?scenario=unavailable', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Payment report could not be loaded', { exact: true })).toBeVisible()
    await expect(page.getByText('₹12,998.00', { exact: true })).toHaveCount(0)
})
