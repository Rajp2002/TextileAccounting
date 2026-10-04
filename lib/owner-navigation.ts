import { Calculator, ClipboardList, CreditCard, DollarSign, FileText, MessageSquare, Settings, SlidersHorizontal, Tags, Truck, Users, Warehouse, Wrench, type LucideIcon } from 'lucide-react'
import { resolveStockKind } from './stock-navigation'
import { hasCapability, type PlanCapability, type SubscriptionTier } from './subscription-access'
import { type ProductionMode } from './production-mode'

type Context = { tier: SubscriptionTier; productionMode: ProductionMode }
export type OwnerNavigationItem = {
 id: string; translationKey: string; name: string; icon: LucideIcon; section: 'costing' | 'production_stock' | 'workforce' | 'utilities'; order: number;
 route: (context: Context) => string; active: (pathname: string, href: string) => boolean; allowed: (context: Context) => boolean
}
export function ownerRouteActive(pathname: string, href: string) {
 const path = href.split(/[?#]/)[0]
 return pathname === path || path !== '/free' && pathname.startsWith(`${path}/`)
}
const capability = (value: PlanCapability) => ({ tier }: Context) => hasCapability(tier, value)
function item(id: string, name: string, path: string, icon: LucideIcon, section: OwnerNavigationItem['section'], order: number, allowed: OwnerNavigationItem['allowed'], freePath?: string): OwnerNavigationItem {
 return { id, name, translationKey: `navigation.${id}`, route: ({ tier }) => tier === 'free' && freePath ? freePath : path, icon, section, order, active: id === 'stock' ? pathname => resolveStockKind(pathname) !== null : ownerRouteActive, allowed }
}
export const ownerNavigation: OwnerNavigationItem[] = [
 item('estimate', 'Cost Estimate', '/owner/estimator', Calculator, 'costing', 0, capability('estimator'), '/free'),
 item('costings', 'Saved Costings', '/owner/quotes', FileText, 'costing', 1, capability('saved_costings'), '/free/costings'),
 item('rates', 'Yarn Rate Book', '/owner/rates', Tags, 'costing', 2, capability('rate_book')),
 item('production', 'Production', '/owner/production', ClipboardList, 'production_stock', 0, capability('production_management')),
 item('assignments', 'Machine Assignments', '/owner/assignments', SlidersHorizontal, 'production_stock', 1, capability('production_management')),
 item('stock', 'Stock', '/owner/stock', Warehouse, 'production_stock', 2, capability('production')),
 item('dispatches', 'Dispatches', '/owner/dispatches', Truck, 'production_stock', 3, capability('production')),
 item('machines', 'Machines', '/owner/machines', Wrench, 'production_stock', 4, capability('production_management')),
 item('workers', 'Workers', '/owner/workers', Users, 'workforce', 0, capability('production_management')),
 item('payroll', 'Payroll', '/owner/payroll', DollarSign, 'workforce', 1, capability('production')),
 item('settings', 'Settings', '/owner/settings', Settings, 'utilities', 1, capability('account_settings'), '/free/account'),
 item('billing', 'Plan & Billing', '/owner/billing', CreditCard, 'utilities', 2, ({ tier }) => tier !== 'none', '/free/billing'),
 item('support', 'Support', '/support', MessageSquare, 'utilities', 3, () => true),
]
export function visibleOwnerNavigation(context: Context) {
 return (['costing', 'production_stock', 'workforce', 'utilities'] as const).map(id => ({
  id, translationKey: `navigation.sections.${id}`,
  items: ownerNavigation.filter(item => item.section === id && item.allowed(context)).sort((a,b) => a.order - b.order).map(item => ({ ...item, href: item.route(context) })),
 })).filter(group => group.items.length)
}
