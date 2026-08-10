import { headers } from 'next/headers'
import { PWA_LOGIN_RECOVERY_HEADER } from '@/lib/pwa-auth-recovery'
import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
    const requestHeaders = await headers()
    const recoveryDestination = requestHeaders.get(PWA_LOGIN_RECOVERY_HEADER)

    return <LoginForm recoveryDestination={recoveryDestination} />
}
