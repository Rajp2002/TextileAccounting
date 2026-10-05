const wait = () => new Promise(resolve => setTimeout(resolve, 150))
export async function completePlanSelection() { await wait(); return { error: 'Unable to finish setup. Please try again.' } }
export async function signIn() { await wait(); return { error: 'Invalid email or password', redirectTo: '/free' } }
export async function createOrganizationAndRedirect() { await wait(); throw new Error('Synthetic lost response') }
export async function requestPasswordReset() { await wait(); return {} }
