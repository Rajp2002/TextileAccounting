import { expect, test } from '@playwright/test'
import QRCode from 'qrcode'
const factorId = 'e73ba91a-2d52-4e93-8a39-bdb902757fe2'
const intentId = '71db586c-ae1e-4bba-9d16-1eae02d829ce'
test.beforeEach(async ({ page }) => {
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort('blockedbyclient'))
})
test('wrong email gives the requested toast and keeps the password step accessible', async ({ page }, info) => {
    await page.route('**/fixture/sign-in', route => route.fulfill({ json: { code: 'WRONG_EMAIL', message: 'Wrong email. Use the approved founder email to continue.', requestId: 'synthetic-attempt' } }))
    await page.goto('/')
    await page.getByLabel('Email address').fill('other@example.invalid')
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password-only')
    await page.getByRole('button', { name: 'Continue to verification' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Wrong email')
    await expect(page.locator('#founder-login-error')).toContainText('Wrong email')
    await expect(page.getByLabel('Password', { exact: true })).toBeEnabled()
    await page.screenshot({ path: `output/playwright/admin-console/auth-fixtures/wrong-email-${info.project.name}-synthetic.png`, fullPage: true })
})
test('first connection shows private QR, sends its bound intent, and stores no QR or code', async ({ page }, info) => {
    const qrCode = await QRCode.toDataURL('otpauth://totp/Weavly:Synthetic?secret=JBSWY3DPEHPK3PXP&issuer=Weavly')
    const enrollments: unknown[] = [], verifications: Record<string, unknown>[] = []
    await page.route('**/fixture/enroll', route => { enrollments.push(route.request().postDataJSON()); return route.fulfill({ json: { setup: { factorId, intentId, qrCode } } }) })
    await page.route('**/fixture/verify', route => { verifications.push(route.request().postDataJSON()); return route.fulfill({ json: { message: 'Synthetic verification accepted.' } }) })
    await page.goto('/?mode=new')
    await expect(page.getByRole('img', { name: /scan to connect/i })).toBeVisible()
    expect(enrollments).toHaveLength(1)
    await page.getByLabel('Authenticator code', { exact: true }).fill('123456')
    await page.getByRole('button', { name: 'Verify and open console' }).click()
    await expect(page.getByRole('alert')).toContainText('Synthetic verification accepted')
    expect(verifications).toEqual([{ factorId, enrollmentIntentId: intentId, code: '123456', returnTo: '/admin' }])
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))
    expect(stored).not.toMatch(/123456|data:image|JBSWY3DPEHPK3PXP/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `output/playwright/admin-console/auth-fixtures/first-qr-${info.project.name}-synthetic.png`, fullPage: true })
})
test('returning founder gets only the authenticator code step with no enrollment call', async ({ page }, info) => {
    let enrollments = 0
    await page.route('**/fixture/enroll', route => { enrollments++; return route.fulfill({ json: {} }) })
    await page.goto('/?mode=returning')
    await expect(page.getByLabel('Authenticator code', { exact: true })).toBeVisible()
    await expect(page.getByRole('img')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Restart interrupted setup' })).toHaveCount(0)
    expect(enrollments).toBe(0)
    await page.getByLabel('Authenticator code', { exact: true }).focus()
    await expect(page.getByLabel('Authenticator code', { exact: true })).toBeFocused()
    await page.screenshot({ path: `output/playwright/admin-console/auth-fixtures/returning-code-${info.project.name}-synthetic.png`, fullPage: true })
})
