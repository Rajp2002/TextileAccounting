import { expect, test } from '@playwright/test'

test('anonymous founder login is accessible and has no tenant data', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /forgot|recover/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /sign up/i })).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('Worker salary')
    await page.screenshot({ path: `output/playwright/admin-console/login-${test.info().project.name}.png`, fullPage: true })
})

test('every direct founder and support API denies an anonymous principal', async ({ request }) => {
    for (const path of ['/api/admin/overview','/api/admin/factories','/api/admin/factories/00000000-0000-4000-8000-000000000001','/api/admin/support','/api/admin/payments','/api/admin/system','/api/admin/audit','/api/admin/session','/api/support','/api/support/session','/api/support/00000000-0000-4000-8000-000000000001']) {
        const response = await request.get(path)
        expect(response.status(), path).toBe(401)
        expect(response.headers()['content-type']).toContain('application/json')
        const body = await response.json()
        expect(body).not.toHaveProperty('items')
        expect(body).not.toHaveProperty('messages')
    }
})

test('protected deep links return to login without a redirect loop', async ({ page }) => {
    for (const path of ['/admin','/admin/factories','/admin/support','/admin/payments','/admin/audit','/admin/verify']) {
        await page.goto(path)
        await expect(page).toHaveURL(/\/(?:admin\/)?login(?:\?|$)/)
        await expect(page.getByLabel(/email/i)).toBeVisible()
    }
})

test('forged actor, organization and assurance bodies do not authorize support writes', async ({ request }) => {
    const response = await request.post('/api/support', { data: {
        subject: 'Synthetic forged request', category: 'other', body: 'Synthetic fixture only',
        orgId: '00000000-0000-4000-8000-000000000001', requesterUserId: '00000000-0000-4000-8000-000000000002', aal: 'aal2', role: 'admin',
    } })
    expect(response.status()).toBe(401)
    expect(await response.json()).not.toHaveProperty('id')
})

test('disabled login displays its setup dependency and never follows an external return target', async ({ page }) => {
    await page.goto('/admin/login?next=https://attacker.invalid')
    await expect(page.getByLabel(/email/i)).toBeDisabled()
    await expect(page.getByRole('button', { name: /continue to verification/i })).toBeDisabled()
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3100\//)
    await expect(page.getByRole('status').filter({ hasText: /awaiting approved identity/i })).toBeVisible()
})

test('no private API/document response claims shared cacheability', async ({ request }) => {
    for (const path of ['/admin/login','/api/admin/factories','/api/support']) {
        const response = await request.get(path)
        expect(response.headers()['cache-control'], path).toContain('no-store')
    }
})

test('protected paths do not persist conversation/query data in browser storage', async ({ page }) => {
    await page.goto('/admin/login')
    await page.goto('/support')
    const storage = await page.evaluate(async () => ({
        local: Object.keys(localStorage), session: Object.keys(sessionStorage),
        caches: await caches.keys(),
    }))
    expect(storage.local.some(key => /admin|support|REACT_QUERY_OFFLINE_CACHE/i.test(key))).toBe(false)
    expect(storage.session.some(key => /admin|support|draft/i.test(key))).toBe(false)
    expect(storage.caches.some(key => /admin|support/i.test(key))).toBe(false)
})

test.skip('approved founder AAL2 and requester lifecycle in real Supabase Auth', async () => {
    // Release gate: requires a running isolated Supabase Auth service, approved
    // synthetic identities/factors and MFA recovery evidence. A skipped test
    // is recorded as blocked, never represented as a completed round trip.
})
