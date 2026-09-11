import { readBaseProductionNavigation } from './base-production-navigation'
/** Only the selectors actually supported by the old screens are carried forward. */
export function legacyManagementHref(source: 'setup' | 'operations', params: Pick<URLSearchParams, 'get'>) {
 const context = readBaseProductionNavigation(params)
 const target = source === 'operations' ? 'assignments' : params.get('section') === 'machines' || params.get('add') === 'machine' ? 'machines' : 'workers'
 const next = new URLSearchParams()
 if (target === 'machines') next.set('register', 'base')
 if ((target === 'workers' || target === 'assignments') && context.worker) next.set('worker', context.worker)
 if (target === 'assignments' && context.shift) next.set('shift', context.shift)
 if (target === 'assignments' && context.machine) next.set('machine', context.machine)
 if (source === 'setup') {
  if (params.get('add') === (target === 'machines' ? 'machine' : 'worker')) next.set('add', params.get('add')!)
  if (context.returnTo) next.set('returnTo', context.returnTo)
 }
 return `/owner/${target}${next.size ? `?${next}` : ''}`
}

export function managementReturnLabel(path: string) {
 const pathname = path.split('?')[0]
 const labels: Record<string, string> = {
  '/owner/assignments': 'Back to Machine Assignments', '/owner/workers': 'Back to Workers',
  '/owner/machines': 'Back to Machines', '/owner/payroll': 'Back to Payroll', '/owner/production': 'Back to Production',
 }
 return labels[pathname] ?? 'Back'
}
