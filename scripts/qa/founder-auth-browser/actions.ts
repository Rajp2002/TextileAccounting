import type { FounderAuthState } from '@/lib/admin/auth-input'
import type { FounderEnrollmentState } from '@/lib/admin/founder-mfa'
export async function founderSignIn(_previous: FounderAuthState, form: FormData): Promise<FounderAuthState> {
    return (await fetch('/fixture/sign-in', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) })).json()
}
export async function founderBeginEnrollment(restart = false): Promise<FounderEnrollmentState> {
    return (await fetch('/fixture/enroll', { method: 'POST', body: JSON.stringify({ restart }) })).json()
}
export async function founderVerify(_previous: FounderAuthState, form: FormData): Promise<FounderAuthState> {
    return (await fetch('/fixture/verify', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) })).json()
}
