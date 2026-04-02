import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOnboardingStatus } from '@/app/(auth)/actions/auth'
import OnboardingChecklist from './checklist'

/**
 * /onboarding — Owner setup checklist (server component)
 *
 * This page is a BLOCKING GATE for owners. They cannot reach /owner/analytics
 * until at least 1 machine, 1 quality, and 1 worker exist in their org.
 *
 * Not dismissible. No skip button. An org with no data is broken downstream.
 */
export default async function OnboardingPage() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) redirect('/login')

    // If already complete, skip straight to dashboard
    // (This is a fast path using the JWT claim — avoids unnecessary DB check)
    const jwtPayload = (() => {
        try {
            const b64 = session.access_token.split('.')[1]
            return JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8'))
        } catch { return {} }
    })()

    if (jwtPayload.onboarding_complete === true) {
        redirect('/owner/analytics')
    }

    // Only owners can access onboarding
    if (jwtPayload.user_role !== 'owner') {
        redirect('/supervisor/production')
    }

    // Fetch real-time status (SSR — accurate on page load)
    const status = await getOnboardingStatus()

    // If everything is done (could happen if they return after completing), go to dashboard
    if (status.isComplete) {
        redirect('/owner/analytics')
    }

    return <OnboardingChecklist initialStatus={status} />
}
