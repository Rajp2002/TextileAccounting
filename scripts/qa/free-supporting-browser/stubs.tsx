import React from 'react'
export function useFreeWorkspace() { return { tier: new URL(location.href).searchParams.get('tier') ?? 'free', paid: false, activatePaid() {} } }
export function usePathname() { return location.pathname }
export function useRouter() { return { push: (href: string) => location.assign(href), refresh() {}, replace: (href: string) => location.replace(href) } }
export function useSearchParams() { return new URL(location.href).searchParams }
export async function updatePersonalInformation(input: { fullName: string }) {
  if (input.fullName === 'Synthetic rejected owner') {
    await new Promise(resolve => setTimeout(resolve, 300))
    return { error: 'Synthetic save could not be confirmed' }
  }
  return { success: true, fullName: input.fullName }
}
export async function updateFactoryDetails(input: { name: string }) { return { success: true, name: input.name } }
export async function requestSecurityPasswordReset() { return { success: true, email: 'synthetic@example.test' } }
export async function saveCostingDefaults() { return { error: 'Outside the Free fixture' } }
export async function updatePayrollCycle() { return { error: 'Outside the Free fixture' } }
export async function deleteAccountPermanently() {
  Reflect.set(window, '__supportingDeletionRequests', (Reflect.get(window, '__supportingDeletionRequests') ?? 0) + 1)
  throw new Error('Synthetic fixture cannot delete an account')
}
export function CostingDefaultsCard() { return null }
export function PayrollCycleSettingsCard() { return null }
export default function Link({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) { return <a href={href} {...props}>{children}</a> }
