import { headers } from 'next/headers'
import { IntroPrePaintScript } from '@/components/intro/intro-pre-paint-script'
import { WeavingIntro } from '@/components/intro/weaving-intro'
import { PWA_LOGIN_RECOVERY_HEADER } from '@/lib/pwa-auth-recovery'
import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
    const requestHeaders = await headers()
    const recoveryDestination = requestHeaders.get(PWA_LOGIN_RECOVERY_HEADER)

    return (
        <>
            {/* The installed app opens here: its first launch gets the woven intro. */}
            <IntroPrePaintScript surface="app-login" />
            <WeavingIntro surface="app-login" />
            <LoginForm recoveryDestination={recoveryDestination} />
        </>
    )
}
