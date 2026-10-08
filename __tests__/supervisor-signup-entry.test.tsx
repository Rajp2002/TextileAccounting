import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AccountTypeSwitch } from '@/components/auth/AccountTypeSwitch'
import { supervisorText } from '@/lib/i18n/supervisor-access'
import { SUPERVISOR_JOIN_PATH } from '@/lib/supervisor-access'

const read = (path: string) => readFileSync(path, 'utf8')

// A supervisor must be able to tell, on the screen where accounts are created,
// that "Create your factory" is not their form and where theirs is.
describe('account type switch on the sign-up screens', () => {
    it('marks the owner form as current and sends supervisors to /join', () => {
        const html = renderToStaticMarkup(<AccountTypeSwitch current="owner" />)
        expect(html).toContain(`href="${SUPERVISOR_JOIN_PATH}"`)
        expect(html).not.toContain('href="/signup"')
        expect(html).toMatch(/aria-current="page"[^>]*>Factory owner</)
        expect(html).toContain('>Supervisor<')
    })

    it('marks the supervisor form as current and sends owners to /signup', () => {
        const html = renderToStaticMarkup(<AccountTypeSwitch current="supervisor" />)
        expect(html).toContain('href="/signup"')
        expect(html).not.toContain(`href="${SUPERVISOR_JOIN_PATH}"`)
        expect(html).toMatch(/aria-current="page"[^>]*>Supervisor</)
    })

    // Phones set the root font to 14px, so a rem height (min-h-11) renders 38.5px.
    it('keeps both options at least 44px tall in pixels, not rem', () => {
        const html = renderToStaticMarkup(<AccountTypeSwitch current="owner" />)
        expect(html.match(/min-h-\[44px\]/g)?.length).toBe(2)
        expect(html).not.toContain('min-h-11')
    })

    it('is translated, so Hindi and Gujarati users see their own words', () => {
        for (const key of ['accountTypeLabel', 'accountTypeOwner', 'accountTypeSupervisor'] as const) {
            for (const language of ['hi', 'gu'] as const) {
                expect(supervisorText(language, key)).not.toBe(supervisorText('en', key))
            }
        }
    })

    it('appears at the top of both the sign-up form and the join form', () => {
        expect(read('app/(auth)/signup/page.tsx')).toContain('<AccountTypeSwitch current="owner" />')
        expect(read('app/(auth)/join/join-form.tsx')).toContain('<AccountTypeSwitch current="supervisor" />')
    })

    it('leaves the login form alone: supervisors sign in there like everyone else', () => {
        expect(read('app/(auth)/login/login-form.tsx')).not.toContain('AccountTypeSwitch')
    })
})
